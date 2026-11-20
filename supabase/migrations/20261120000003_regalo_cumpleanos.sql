-- Regalo de cumpleaños: en su mes de cumpleaños la clienta tiene dinero para
-- canjear, según su nivel (al empezar: Plata $100, Oro $200, Diamante $300;
-- el administrador lo cambia en Programa de lealtad, y $0 = sin regalo). Cada
-- canje del regalo queda registrado con la fecha, la sucursal, la empleada que
-- lo dio y el monto, y solo se puede usar una vez por año. No toca los puntos.

alter table public.niveles add column regalo_cumple numeric(10, 2) not null default 0 check (regalo_cumple >= 0);
update public.niveles set regalo_cumple = case nombre when 'Plata' then 100 when 'Oro' then 200 when 'Diamante' then 300 else 0 end;
-- Ahora todos los niveles tienen regalo: se menciona también en Plata y Oro.
update public.niveles set beneficio = 'Acceso al programa, acumulación de puntos y regalo de cumpleaños'
  where nombre = 'Plata' and beneficio = 'Acceso al programa y acumulación de puntos';
update public.niveles set beneficio = 'Doble puntos, limpieza gratis, regalo de cumpleaños y promociones especiales'
  where nombre = 'Oro' and beneficio = 'Doble puntos, limpieza gratis y promociones especiales';

create table public.regalos_cumple (
  id bigint generated always as identity primary key,
  cliente_id bigint not null references public.clientes (id),
  anio smallint not null,
  fecha timestamptz not null default now(),
  sucursal_id smallint not null references public.sucursales (id),
  nivel_id smallint references public.niveles (id), -- nivel que tenía al recibirlo
  pesos numeric(10, 2) not null, -- monto del regalo de su nivel ese día
  entregado_por uuid not null references public.perfiles (id), -- la empleada que lo dio
  registrado_por uuid not null references public.perfiles (id), -- la cuenta con sesión abierta
  creado_en timestamptz not null default now(),
  unique (cliente_id, anio)
);

create index regalos_cumple_fecha_idx on public.regalos_cumple (fecha);

-- Revisa las reglas aunque alguien se salte la app.
create function public.antes_de_guardar_regalo() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cli clientes;
  r record;
  niv niveles;
  local timestamp;
begin
  if not es_admin() or new.registrado_por is null then
    new.registrado_por := auth.uid();
  end if;
  if not es_admin() then
    new.fecha := now();
  end if;
  new.entregado_por := coalesce(new.entregado_por, new.registrado_por);
  new.creado_en := now();

  -- Hora de Monterrey: el mes y el año del regalo son los de la sucursal.
  local := new.fecha at time zone 'America/Monterrey';
  new.anio := extract(year from local);

  select * into cli from clientes where id = new.cliente_id;
  if cli.cumple_mes is null then
    raise exception 'La clienta no tiene registrado su cumpleaños' using errcode = 'P0001';
  end if;
  if cli.cumple_mes <> extract(month from local) then
    raise exception 'El regalo se canjea solo en el mes de su cumpleaños' using errcode = 'P0001';
  end if;

  select * into r from recorrer_cliente(new.cliente_id, new.fecha);
  select * into niv from niveles order by desde offset r.nivel_indice - 1 limit 1;
  if niv.regalo_cumple <= 0 then
    raise exception 'El nivel % no incluye regalo de cumpleaños', niv.nombre using errcode = 'P0001';
  end if;
  new.nivel_id := niv.id;
  new.pesos := niv.regalo_cumple;

  if not exists (select 1 from perfiles where id = new.entregado_por and activa and rol::text <> 'sucursal') then
    raise exception 'Elige qué empleada atiende' using errcode = '23503';
  end if;
  if exists (select 1 from regalos_cumple where cliente_id = new.cliente_id and anio = new.anio) then
    raise exception 'Ya usó su regalo de cumpleaños de %', new.anio using errcode = '23505';
  end if;
  return new;
end;
$$;

create trigger antes_de_guardar_regalo before insert on public.regalos_cumple
for each row execute function public.antes_de_guardar_regalo();

revoke execute on function public.antes_de_guardar_regalo() from public, anon, authenticated;

-- Permisos: igual que los canjes. Todo el personal (también el celular de la
-- sucursal) lo consulta y lo registra; solo el administrador lo borra si se
-- registró por error.
alter table public.regalos_cumple enable row level security;

create policy "personal lee regalos" on public.regalos_cumple
  for select to authenticated using (public.es_personal());
create policy "personal registra regalos" on public.regalos_cumple
  for insert to authenticated
  with check (public.es_personal() and registrado_por = auth.uid() or public.es_admin());
create policy "admin borra regalos" on public.regalos_cumple
  for delete to authenticated using (public.es_admin());

revoke all on public.regalos_cumple from anon;
