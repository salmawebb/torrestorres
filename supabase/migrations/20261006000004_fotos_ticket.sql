-- Fotos de los tickets, en un bucket privado de Supabase Storage.
-- Ruta sugerida: <sucursal>/<ticket>-<fecha>.jpg; se guarda en compras.foto_ticket.

insert into storage.buckets (id, name, public) values ('tickets', 'tickets', false)
on conflict (id) do nothing;

create policy "personal sube fotos de ticket" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'tickets' and public.es_personal());
create policy "personal ve fotos de ticket" on storage.objects
  for select to authenticated
  using (bucket_id = 'tickets' and public.es_personal());
create policy "admin borra fotos de ticket" on storage.objects
  for delete to authenticated
  using (bucket_id = 'tickets' and public.es_admin());
