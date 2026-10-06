-- Permisos por rol con Row Level Security. Sin sesión (anon) no se ve
-- ninguna tabla; lo único público es la función tarjeta_publica.
--
-- | Acción                                  | Empleada | Administrador |
-- | Registrar clientes, compras y canjes    | Sí       | Sí            |
-- | Consultar clientes, compras y canjes    | Sí       | Sí            |
-- | Corregir datos de un cliente / nuevo QR | Sí       | Sí            |
-- | Editar, cancelar o borrar ventas        | No       | Sí            |
-- | Cambiar reglas de lealtad y sucursales  | No       | Sí            |
-- | Activar, desactivar o cambiar roles     | No       | Sí            |

alter table public.sucursales enable row level security;
alter table public.perfiles enable row level security;
alter table public.configuracion enable row level security;
alter table public.niveles enable row level security;
alter table public.clientes enable row level security;
alter table public.compras enable row level security;
alter table public.canjes enable row level security;

-- Catálogos y reglas: todo el personal los lee, solo el administrador los cambia.

create policy "personal lee sucursales" on public.sucursales
  for select to authenticated using (public.es_personal());
create policy "admin cambia sucursales" on public.sucursales
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

create policy "personal lee configuracion" on public.configuracion
  for select to authenticated using (public.es_personal());
create policy "admin cambia configuracion" on public.configuracion
  for update to authenticated using (public.es_admin()) with check (public.es_admin());

create policy "personal lee niveles" on public.niveles
  for select to authenticated using (public.es_personal());
create policy "admin cambia niveles" on public.niveles
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- Perfiles: cada quien ve el suyo aunque esté inactiva (para mostrar el
-- aviso); el personal activo ve los nombres de todas para los historiales.
-- Las cuentas se crean desde el login de Supabase, no con insert directo.

create policy "personal lee perfiles" on public.perfiles
  for select to authenticated using (id = auth.uid() or public.es_personal());
create policy "admin cambia perfiles" on public.perfiles
  for update to authenticated using (public.es_admin()) with check (public.es_admin());

-- Clientes

create policy "personal lee clientes" on public.clientes
  for select to authenticated using (public.es_personal());
create policy "personal registra clientes" on public.clientes
  for insert to authenticated with check (public.es_personal());
create policy "personal corrige clientes" on public.clientes
  for update to authenticated using (public.es_personal()) with check (public.es_personal());
create policy "admin borra clientes" on public.clientes
  for delete to authenticated using (public.es_admin());

-- Compras: la empleada registra y consulta (la ficha del cliente muestra todo
-- su historial), pero no edita ni cancela lo ya guardado.

create policy "personal lee compras" on public.compras
  for select to authenticated using (public.es_personal());
create policy "personal registra compras" on public.compras
  for insert to authenticated
  with check (public.es_personal() and registrada_por = auth.uid() or public.es_admin());
create policy "admin corrige compras" on public.compras
  for update to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "admin borra compras" on public.compras
  for delete to authenticated using (public.es_admin());

-- Canjes

create policy "personal lee canjes" on public.canjes
  for select to authenticated using (public.es_personal());
create policy "personal registra canjes" on public.canjes
  for insert to authenticated
  with check (public.es_personal() and registrado_por = auth.uid() or public.es_admin());
create policy "admin corrige canjes" on public.canjes
  for update to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "admin borra canjes" on public.canjes
  for delete to authenticated using (public.es_admin());

-- Sin sesión no hay acceso directo a nada.
revoke all on all tables in schema public from anon;
revoke execute on function public.estado_cliente(bigint) from public, anon;
revoke execute on function public.regenerar_token_tarjeta(bigint) from public, anon;
grant execute on function public.estado_cliente(bigint) to authenticated;
grant execute on function public.regenerar_token_tarjeta(bigint) to authenticated;
