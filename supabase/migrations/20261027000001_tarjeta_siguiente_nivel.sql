-- La tarjeta pública también dice cuánto le falta al cliente para el
-- siguiente nivel. Sigue sin mostrar teléfono, apellidos ni compras.

drop function public.tarjeta_publica(uuid);

create function public.tarjeta_publica(p_token uuid)
returns table (
  nombre text, nivel text, puntos integer, pesos_canje numeric, minimo_canje integer, vigencia timestamptz,
  siguiente_nivel text, falta_para_siguiente numeric
)
language plpgsql stable security definer set search_path = public as $$
declare
  cli clientes;
  cfg configuracion;
  r record;
  actual niveles;
  sig niveles;
begin
  select * into cli from clientes where token_tarjeta = p_token;
  if not found then
    return;
  end if;
  select * into cfg from configuracion;
  select * into r from recorrer_cliente(cli.id);
  select * into actual from niveles order by desde offset r.nivel_indice - 1 limit 1;
  select * into sig from niveles order by desde offset r.nivel_indice limit 1;
  return query select
    split_part(cli.nombre, ' ', 1), actual.nombre, r.puntos, r.puntos * cfg.valor_punto, cfg.minimo_canje,
    case when r.puntos > 0 then r.ultima_compra + make_interval(months => cfg.vigencia_meses) end,
    sig.nombre,
    case when sig.id is not null then greatest(sig.desde - r.acumulado, 0) end;
end;
$$;

revoke execute on function public.tarjeta_publica(uuid) from public;
grant execute on function public.tarjeta_publica(uuid) to anon, authenticated;
