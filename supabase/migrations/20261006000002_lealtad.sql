-- Reglas de negocio: roles, captura de clientes y compras, y cálculo del
-- programa de lealtad. Replica lo que hace web/src/lib/lealtad.js.

-- Quién está usando el sistema ----------------------------------------

create function public.es_personal() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = auth.uid() and activa);
$$;

create function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = auth.uid() and activa and rol = 'admin');
$$;

-- Perfil automático al crear una cuenta ---------------------------------
-- El nombre llega en user_metadata y el rol en app_metadata (este último
-- solo lo puede poner el administrador con la llave de servicio).

create function public.crear_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into perfiles (id, nombre, correo, rol)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'nombre', ''), split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_app_meta_data ->> 'rol')::rol, 'empleada')
  );
  return new;
end;
$$;

create trigger crear_perfil after insert on auth.users
for each row execute function public.crear_perfil();

-- Clientes -------------------------------------------------------------

create function public.normalizar_telefono(p text) returns text
language sql immutable as $$
  select case
    when length(d) = 10 then '52' || d
    when length(d) = 13 and d like '521%' then '52' || substr(d, 4) -- formato viejo de celular
    else d
  end
  from (select regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') as d) t;
$$;

create function public.antes_de_guardar_cliente() returns trigger
language plpgsql set search_path = public as $$
begin
  new.telefono := normalizar_telefono(new.telefono);
  new.nombre := btrim(new.nombre);
  new.apellidos := btrim(new.apellidos);
  if tg_op = 'INSERT' then
    if not es_admin() or new.registrado_por is null then
      new.registrado_por := auth.uid();
    end if;
    if not es_admin() then
      new.registro := now();
    end if;
  elsif not es_admin() then
    -- La empleada puede corregir datos, pero no quién ni cuándo lo registró.
    new.id := old.id;
    new.registro := old.registro;
    new.registrado_por := old.registrado_por;
  end if;
  return new;
end;
$$;

create trigger antes_de_guardar_cliente before insert or update on public.clientes
for each row execute function public.antes_de_guardar_cliente();

-- Crea un enlace nuevo para la tarjeta; el QR anterior deja de funcionar.
create function public.regenerar_token_tarjeta(p_cliente bigint) returns uuid
language sql security invoker set search_path = public as $$
  update clientes set token_tarjeta = gen_random_uuid() where id = p_cliente returning token_tarjeta;
$$;

-- Cálculo del programa de lealtad --------------------------------------
-- Recorre en orden las compras y canjes de un cliente y aplica:
-- - puntos = round(total / bloque) * puntos del nivel que tenía ANTES de la compra;
-- - sube un nivel por compra como máximo, sin saltarse ninguno;
-- - si pasan N meses sin comprar, los puntos vencen y baja un solo nivel,
--   con el acumulado reiniciado en el mínimo del nivel al que bajó.
-- Con p_recalcular_desde, vuelve a calcular y guarda los puntos y el nivel de
-- las compras desde esa fecha; las anteriores conservan lo que ya tenían.

create function public.recorrer_cliente(
  p_cliente bigint,
  p_hasta timestamptz default now(),
  p_recalcular_desde timestamptz default null
) returns table (nivel_indice integer, acumulado numeric, puntos integer, ultima_compra timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  cfg configuracion;
  niv niveles[];
  i integer := 1;
  v_acum numeric := 0;
  v_puntos integer := 0;
  v_vence_desde timestamptz; -- última compra que aún puede hacer vencer los puntos
  v_ultima timestamptz;
  v_ganados integer;
  e record;
begin
  select * into cfg from configuracion;
  select array_agg(n order by n.desde) into niv from niveles n;

  for e in
    select 0 as orden, c.id, c.fecha, c.total, c.puntos
      from compras c where c.cliente_id = p_cliente and not c.cancelada and c.fecha <= p_hasta
    union all
    select 1, k.id, k.fecha, null, k.puntos
      from canjes k where k.cliente_id = p_cliente and k.fecha <= p_hasta
    order by fecha, orden, id
  loop
    if v_vence_desde is not null
       and v_vence_desde + make_interval(months => cfg.vigencia_meses) <= e.fecha
       and v_puntos + v_acum > 0 then
      v_puntos := 0;
      if i > 1 then
        i := i - 1;
        v_acum := (niv[i]).desde;
      end if;
      v_vence_desde := null; -- baja solo la primera vez
    end if;

    if e.orden = 0 then
      if p_recalcular_desde is not null and e.fecha >= p_recalcular_desde then
        v_ganados := round(e.total / cfg.bloque_pesos)::integer * (niv[i]).puntos_por_bloque;
        update compras set puntos = v_ganados, nivel_id = (niv[i]).id
          where id = e.id and (compras.puntos <> v_ganados or compras.nivel_id is distinct from (niv[i]).id);
      else
        v_ganados := e.puntos;
      end if;
      v_puntos := v_puntos + v_ganados;
      v_acum := v_acum + e.total;
      if i < array_length(niv, 1) and v_acum >= (niv[i + 1]).desde then
        i := i + 1;
      end if;
      v_vence_desde := e.fecha;
      v_ultima := e.fecha;
    else
      v_puntos := v_puntos - e.puntos;
    end if;
  end loop;

  if v_vence_desde is not null
     and v_vence_desde + make_interval(months => cfg.vigencia_meses) <= p_hasta
     and v_puntos + v_acum > 0 then
    v_puntos := 0;
    if i > 1 then
      i := i - 1;
      v_acum := (niv[i]).desde;
    end if;
  end if;

  return query select i, v_acum, v_puntos, v_ultima;
end;
$$;

revoke execute on function public.recorrer_cliente(bigint, timestamptz, timestamptz) from public, anon, authenticated;

-- Estado actual de un cliente, como lo muestra su ficha.
create function public.estado_cliente(p_cliente bigint)
returns table (
  nivel_id smallint,
  nivel text,
  acumulado numeric,
  puntos integer,
  pesos_canje numeric,
  puede_canjear boolean,
  ultima_compra timestamptz,
  vigencia timestamptz,
  siguiente_nivel text,
  falta_para_siguiente numeric
)
language plpgsql stable security definer set search_path = public as $$
declare
  cfg configuracion;
  r record;
  actual niveles;
  sig niveles;
begin
  if not es_personal() then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  select * into cfg from configuracion;
  select * into r from recorrer_cliente(p_cliente);
  select * into actual from niveles order by desde offset r.nivel_indice - 1 limit 1;
  select * into sig from niveles order by desde offset r.nivel_indice limit 1;
  return query select
    actual.id,
    actual.nombre,
    r.acumulado,
    r.puntos,
    r.puntos * cfg.valor_punto,
    r.puntos >= cfg.minimo_canje,
    r.ultima_compra,
    case when r.puntos > 0 then r.ultima_compra + make_interval(months => cfg.vigencia_meses) end,
    sig.nombre,
    case when sig.id is not null then greatest(sig.desde - r.acumulado, 0) end;
end;
$$;

-- Clientes con su estado calculado, para listas y reportes.
create view public.resumen_clientes with (security_invoker = true) as
  select c.*, e.*
  from public.clientes c
  cross join lateral public.estado_cliente(c.id) e;

-- Compras ----------------------------------------------------------------

create function public.antes_de_guardar_compra() returns trigger
language plpgsql set search_path = public as $$
begin
  new.ticket := btrim(new.ticket);
  if tg_op = 'INSERT' then
    -- Cada venta queda ligada a quien inició sesión (dato del bono).
    -- Solo el administrador puede indicar otra persona, p. ej. al importar el Excel.
    if not es_admin() or new.registrada_por is null then
      new.registrada_por := auth.uid();
    end if;
    if not es_admin() then
      new.cancelada := false;
    end if;
    new.creada_en := now();
  end if;
  if new.cancelada and (tg_op = 'INSERT' or not old.cancelada) then
    new.cancelada_por := coalesce(new.cancelada_por, auth.uid());
    new.cancelada_en := coalesce(new.cancelada_en, now());
  elsif not new.cancelada then
    new.cancelada_por := null;
    new.cancelada_en := null;
  end if;
  return new;
end;
$$;

create trigger antes_de_guardar_compra before insert or update on public.compras
for each row execute function public.antes_de_guardar_compra();

-- Calcula los puntos de la compra nueva, o recalcula desde la fecha afectada
-- cuando se corrige o cancela una venta.
create function public.despues_de_guardar_compra() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform recorrer_cliente(old.cliente_id, 'infinity',
      case when tg_op = 'UPDATE' and new.cliente_id = old.cliente_id then least(old.fecha, new.fecha) else old.fecha end);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.cliente_id <> old.cliente_id) then
    perform recorrer_cliente(new.cliente_id, 'infinity', new.fecha);
  end if;
  return null;
end;
$$;

create trigger despues_de_guardar_compra
after insert or delete or update of cliente_id, fecha, total, cancelada on public.compras
for each row execute function public.despues_de_guardar_compra();

-- Canjes -----------------------------------------------------------------

create function public.antes_de_guardar_canje() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cfg configuracion;
  disponibles integer;
begin
  select * into cfg from configuracion;
  if not es_admin() or new.registrado_por is null then
    new.registrado_por := auth.uid();
  end if;
  if not es_admin() then
    new.fecha := now();
  end if;
  select r.puntos into disponibles from recorrer_cliente(new.cliente_id, new.fecha) r;
  if new.puntos < cfg.minimo_canje then
    raise exception 'El canje mínimo es de % puntos', cfg.minimo_canje using errcode = 'P0001';
  end if;
  if new.puntos > disponibles then
    raise exception 'El cliente solo tiene % puntos disponibles', disponibles using errcode = 'P0001';
  end if;
  new.pesos := new.puntos * cfg.valor_punto;
  new.creado_en := now();
  return new;
end;
$$;

create trigger antes_de_guardar_canje before insert on public.canjes
for each row execute function public.antes_de_guardar_canje();

-- Tarjeta digital pública -------------------------------------------------
-- Lo único abierto sin login: con el código del QR devuelve nombre de pila,
-- nivel, puntos y vigencia. Las tablas siguen cerradas.

create function public.tarjeta_publica(p_token uuid)
returns table (nombre text, nivel text, puntos integer, pesos_canje numeric, vigencia timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare
  cli clientes;
  cfg configuracion;
  r record;
begin
  select * into cli from clientes where token_tarjeta = p_token;
  if not found then
    return;
  end if;
  select * into cfg from configuracion;
  select * into r from recorrer_cliente(cli.id);
  return query
    select split_part(cli.nombre, ' ', 1), n.nombre, r.puntos, r.puntos * cfg.valor_punto,
      case when r.puntos > 0 then r.ultima_compra + make_interval(months => cfg.vigencia_meses) end
    from niveles n order by n.desde offset r.nivel_indice - 1 limit 1;
end;
$$;

revoke execute on function public.tarjeta_publica(uuid) from public;
grant execute on function public.tarjeta_publica(uuid) to anon, authenticated;
