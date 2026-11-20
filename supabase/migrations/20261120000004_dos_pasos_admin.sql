-- Verificación en dos pasos para administradoras (20 nov 2026).
--
-- Una administradora entra con contraseña y además el código de 6 números de
-- su app autenticadora (Google o Microsoft Authenticator). Supabase marca esa
-- sesión con aal = 'aal2'; con solo la contraseña queda en 'aal1'.
--
-- Con solo la contraseña una administradora no ve ni cambia nada: ni como
-- administradora ni como personal. Solo puede leer su propio perfil y
-- activar o confirmar la verificación. El celular de sucursal no cambia.
--
-- Recuperación: si pierde su celular, otra administradora le quita la
-- verificación desde Usuarios (función crear-cuenta, accion 'quitar-dos-pasos')
-- y al volver a entrar la activa con un QR nuevo.

create or replace function public.con_dos_pasos() returns boolean
language sql stable set search_path = public as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;
revoke execute on function public.con_dos_pasos() from public, anon;
grant execute on function public.con_dos_pasos() to authenticated;

create or replace function public.es_personal() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from perfiles
    where id = auth.uid() and activa and (rol <> 'admin' or con_dos_pasos())
  );
$$;

create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from perfiles
    where id = auth.uid() and activa and rol = 'admin' and con_dos_pasos()
  );
$$;
