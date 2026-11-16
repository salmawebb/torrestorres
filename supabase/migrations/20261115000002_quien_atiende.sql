-- "¿Quién atiende?": en una sucursal puede haber un solo celular con una
-- sesión abierta y dos o más empleadas. Cada venta guarda, además de la cuenta
-- con la que se registró (registrada_por), la empleada que la atendió
-- (atendida_por). Los registros y reportes por empleada usan atendida_por.

alter table public.compras add column atendida_por uuid references public.perfiles (id);

-- Las ventas que ya existen las atendió quien las registró.
update public.compras set atendida_por = registrada_por where atendida_por is null;

alter table public.compras alter column atendida_por set not null;

create index compras_atendida_idx on public.compras (atendida_por, fecha);

-- Se valida en un trigger aparte para no tocar antes_de_guardar_compra.
-- Corre después de él (orden alfabético): registrada_por ya está puesto.
create function public.antes_de_guardar_compra_atendida() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    -- Sin elegir a nadie, la atendió quien tiene la sesión abierta.
    new.atendida_por := coalesce(new.atendida_por, new.registrada_por);
  elsif new.atendida_por is not distinct from old.atendida_por then
    return new;
  end if;
  if not exists (select 1 from perfiles where id = new.atendida_por and activa) then
    raise exception 'La empleada que atendió no existe o está desactivada' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger antes_de_guardar_compra_atendida before insert or update on public.compras
for each row execute function public.antes_de_guardar_compra_atendida();

revoke execute on function public.antes_de_guardar_compra_atendida() from public, anon, authenticated;
