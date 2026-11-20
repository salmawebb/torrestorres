-- Junta el saldo inicial (clientas importadas del Excel) con las reglas de
-- nivel configurables (niveles_por_compra y baja_al_vencer). La migración
-- reglas_nivel reescribió recorrer_cliente sin el saldo; esta versión hace las
-- dos cosas: arranca del saldo y aplica las reglas a lo posterior al corte.

create or replace function public.recorrer_cliente(
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
  v_subidos integer;
  v_desde timestamptz := '-infinity';
  s saldos_iniciales;
  e record;
begin
  select * into cfg from configuracion;
  select array_agg(n order by n.desde) into niv from niveles n;

  select * into s from saldos_iniciales where cliente_id = p_cliente and fecha <= p_hasta;
  if found then
    select k into i from generate_subscripts(niv, 1) k where (niv[k]).id = s.nivel_id;
    v_acum := s.acumulado;
    v_puntos := s.puntos;
    v_vence_desde := s.vence_desde;
    v_ultima := s.ultima_compra;
    v_desde := s.fecha;
  end if;

  for e in
    select 0 as orden, c.id, c.fecha, c.total, c.puntos
      from compras c where c.cliente_id = p_cliente and not c.cancelada and c.fecha > v_desde and c.fecha <= p_hasta
    union all
    select 1, k.id, k.fecha, null, k.puntos
      from canjes k where k.cliente_id = p_cliente and k.fecha > v_desde and k.fecha <= p_hasta
    order by fecha, orden, id
  loop
    if v_vence_desde is not null
       and v_vence_desde + make_interval(months => cfg.vigencia_meses) <= e.fecha
       and v_puntos + v_acum > 0 then
      v_puntos := 0;
      if cfg.baja_al_vencer and i > 1 then
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
      v_subidos := 0;
      while i < array_length(niv, 1) and v_acum >= (niv[i + 1]).desde
            and (cfg.niveles_por_compra = 0 or v_subidos < cfg.niveles_por_compra) loop
        i := i + 1;
        v_subidos := v_subidos + 1;
      end loop;
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
    if cfg.baja_al_vencer and i > 1 then
      i := i - 1;
      v_acum := (niv[i]).desde;
    end if;
  end if;

  return query select i, v_acum, v_puntos, v_ultima;
end;
$$;

revoke execute on function public.recorrer_cliente(bigint, timestamptz, timestamptz) from public, anon, authenticated;
