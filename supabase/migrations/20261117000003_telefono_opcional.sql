-- El teléfono del cliente es opcional (hay clientas sin número). Si se
-- escribe, sigue siendo único y con el formato 52 + 10 dígitos. Se puede
-- agregar o corregir después desde "Editar datos" en la ficha.

alter table public.clientes alter column telefono drop not null;

create or replace function public.normalizar_telefono(p text) returns text
language sql immutable set search_path = public as $$
  select case
    when d = '' then null
    when length(d) = 10 then '52' || d
    when length(d) = 13 and d like '521%' then '52' || substr(d, 4) -- formato viejo de celular
    else d
  end
  from (select regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') as d) t;
$$;
