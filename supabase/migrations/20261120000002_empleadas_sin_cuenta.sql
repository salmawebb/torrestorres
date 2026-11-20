-- Un celular por sucursal: la sucursal entra con UNA cuenta compartida (rol
-- "sucursal") porque el WhatsApp Business vive en ese celular. Al entrar se
-- elige la sucursal y luego "¿Qué empleada eres?". Las empleadas ya no
-- necesitan correo ni contraseña: son solo un nombre en perfiles, sin cuenta
-- en auth.users, que el administrador da de alta en Usuarios.
--
-- | Rol      | Entra a la app        | Sale en "¿Qué empleada eres?" |
-- | admin    | Sí, con su correo     | No                            |
-- | sucursal | Sí, celular compartido | No                           |
-- | empleada | No (solo su nombre)   | Sí                            |
--
-- Permisos: la cuenta de sucursal es personal (es_personal) pero no admin,
-- así que tiene lo mismo que tenía una empleada con cuenta.

alter type public.rol add value if not exists 'sucursal';

-- Perfiles sin cuenta: id propio y correo opcional.
alter table public.perfiles drop constraint perfiles_id_fkey;
alter table public.perfiles alter column id set default gen_random_uuid();
alter table public.perfiles alter column correo drop not null;

-- Sin la llave foránea, al borrar una cuenta se borra su perfil a mano
-- (como hacía el on delete cascade).
create function public.borrar_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from perfiles where id = old.id;
  return old;
end;
$$;

create trigger borrar_perfil after delete on auth.users
for each row execute function public.borrar_perfil();

revoke execute on function public.borrar_perfil() from public, anon, authenticated;

-- El rol de app_metadata ahora también puede ser "sucursal". El texto se
-- convierte a rol al correr (no al crear la función), así sirve aunque el
-- valor nuevo del enum se agregue en esta misma migración.
create or replace function public.crear_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r text := new.raw_app_meta_data ->> 'rol';
begin
  insert into perfiles (id, nombre, correo, rol, activa)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'nombre', ''), split_part(new.email, '@', 1)),
    new.email,
    (case when r in ('admin', 'sucursal') then r else 'empleada' end)::rol,
    coalesce(r in ('admin', 'empleada', 'sucursal'), false)
  );
  return new;
end;
$$;

create or replace function public.actualizar_rol() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.raw_app_meta_data ->> 'rol' in ('admin', 'empleada', 'sucursal') then
    update perfiles set rol = (new.raw_app_meta_data ->> 'rol')::rol, activa = true where id = new.id;
  end if;
  return new;
end;
$$;

-- El administrador da de alta empleadas (solo nombre, sin correo).
create policy "admin agrega empleadas" on public.perfiles
  for insert to authenticated
  with check (public.es_admin() and rol = 'empleada' and correo is null);

-- Quien atiende una venta tiene que ser una persona: una empleada o una
-- administradora, nunca la cuenta compartida del celular.
create or replace function public.antes_de_guardar_compra_atendida() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    -- Sin elegir a nadie, la atendió quien tiene la sesión abierta.
    new.atendida_por := coalesce(new.atendida_por, new.registrada_por);
  elsif new.atendida_por is not distinct from old.atendida_por then
    return new;
  end if;
  if not exists (select 1 from perfiles where id = new.atendida_por and activa and rol::text <> 'sucursal') then
    raise exception 'Elige qué empleada atendió la venta' using errcode = '23503';
  end if;
  return new;
end;
$$;
