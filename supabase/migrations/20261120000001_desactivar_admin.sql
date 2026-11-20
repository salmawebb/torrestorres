-- Las administradoras también se pueden desactivar desde Usuarios, con dos
-- candados que la base revisa aunque alguien se salte la app:
-- 1. Nadie puede desactivarse a sí misma.
-- 2. Siempre queda al menos una administradora activa.

create or replace function public.cuidar_administradoras()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.activa and not new.activa and new.id = auth.uid() then
    raise exception 'No puedes desactivar tu propia cuenta.';
  end if;

  -- Si este cambio deja de contar una administradora activa (por
  -- desactivarla o por cambiarle el rol), tiene que quedar otra.
  if old.rol = 'admin' and old.activa and not (new.rol = 'admin' and new.activa) then
    perform pg_advisory_xact_lock(hashtext('cuidar_administradoras'));
    if not exists (
      select 1 from public.perfiles
      where rol = 'admin' and activa and id <> old.id
    ) then
      raise exception 'Debe quedar al menos una administradora activa.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.cuidar_administradoras() from public, anon, authenticated;

create trigger cuidar_administradoras
  before update on public.perfiles
  for each row execute function public.cuidar_administradoras();
