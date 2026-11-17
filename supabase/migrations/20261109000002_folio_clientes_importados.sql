-- Al importar el Excel, los clientes conservan su ID (TT.1105 -> 1105).
-- El contador de ID nuevos se adelanta solo para que el próximo cliente
-- capturado en la página no choque con un ID importado.

create function public.ajustar_folio_clientes() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  secuencia text := pg_get_serial_sequence('public.clientes', 'id');
  maximo bigint;
  ultimo bigint;
  usado boolean;
begin
  select max(id) into maximo from clientes;
  execute format('select last_value, is_called from %s', secuencia) into ultimo, usado;
  if maximo > ultimo or (maximo = ultimo and not usado) then
    perform setval(secuencia, maximo, true);
  end if;
  return null;
end;
$$;

revoke execute on function public.ajustar_folio_clientes() from public, anon, authenticated;

create trigger ajustar_folio_clientes after insert on public.clientes
for each statement execute function public.ajustar_folio_clientes();
