-- Canje abierto: el cliente puede canjear desde 1 punto (antes el mínimo era
-- 200). El administrador puede volver a subir el mínimo en Administración >
-- Lealtad si algún día lo necesita.

alter table public.configuracion alter column minimo_canje set default 1;
update public.configuracion set minimo_canje = 1;
