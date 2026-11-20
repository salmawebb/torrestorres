-- Pruebas de las migraciones: reglas de lealtad y permisos por rol.
-- Se corren con correr.sh; cualquier fallo detiene el script con error.

create schema pruebas;
grant usage on schema pruebas to anon, authenticated;

create function pruebas.verifica(condicion boolean, mensaje text) returns void
language plpgsql as $$
begin
  if condicion is not true then
    raise exception 'FALLÓ: %', mensaje;
  end if;
  raise notice 'ok: %', mensaje;
end;
$$;

-- Ejecuta una instrucción y verifica que falle.
create function pruebas.debe_fallar(instruccion text, mensaje text) returns void
language plpgsql as $$
begin
  execute instruccion;
  raise exception 'FALLÓ (no dio error): %', mensaje;
exception when others then
  if sqlerrm like 'FALLÓ%' then raise; end if;
  raise notice 'ok: % (%)', mensaje, sqlerrm;
end;
$$;

-- Entra como una persona (o sin sesión con null).
create function pruebas.como(p_correo text) returns void
language plpgsql security definer as $$
begin
  perform set_config('request.jwt.claims',
    coalesce(json_build_object('sub', (select id from auth.users where email = p_correo))::text, '{}'), false);
end;
$$;
grant execute on all functions in schema pruebas to anon, authenticated;

set client_min_messages = notice;

-- Cuentas: el perfil se crea solo, con el rol de app_metadata.
insert into auth.users (email, raw_user_meta_data, raw_app_meta_data) values
  ('admin@torrestorres.mx', '{"nombre":"Rosa Torres"}', '{"rol":"admin"}'),
  ('lupita@torrestorres.mx', '{"nombre":"Lupita Garza"}', '{"rol":"empleada"}'),
  ('karla@torrestorres.mx', '{"nombre":"Karla Méndez","rol":"admin"}', '{}'),
  ('monica@torrestorres.mx', '{"nombre":"Mónica Salas"}', '{"rol":"empleada"}');
update perfiles set activa = false where correo = 'monica@torrestorres.mx';

select pruebas.verifica((select rol from perfiles where correo = 'admin@torrestorres.mx') = 'admin', 'el admin se crea con rol admin');
select pruebas.verifica((select rol = 'empleada' and not activa from perfiles where correo = 'karla@torrestorres.mx'),
  'una cuenta sin rol en app_metadata (p. ej. registro por su cuenta) queda desactivada y sin admin');
insert into auth.users (email) values ('nueva@torrestorres.mx');
update auth.users set raw_app_meta_data = '{"provider":"email","rol":"admin"}' where email = 'nueva@torrestorres.mx';
select pruebas.verifica((select rol = 'admin' and activa from perfiles where correo = 'nueva@torrestorres.mx'),
  'el rol puesto después en app_metadata llega al perfil y la activa');
delete from auth.users where email = 'nueva@torrestorres.mx';

-- Empleada: registra cliente y compras --------------------------------------

set role authenticated;
select pruebas.como('lupita@torrestorres.mx');

insert into clientes (nombre, apellidos, telefono, cumple_dia, cumple_mes, registrado_por)
values (' María ', 'González López', '81 1234-5678', 5, 4, (select id from perfiles where rol = 'admin'));

select pruebas.verifica((select telefono from clientes where nombre = 'María') = '528112345678', 'el teléfono se guarda con lada 52 y sin espacios');
select pruebas.verifica((select registrado_por from clientes where nombre = 'María') = auth.uid(), 'el cliente queda registrado por la empleada en sesión');
select pruebas.verifica((select id from clientes where nombre = 'María') = 1001, 'los ID de cliente empiezan en 1001');

insert into compras (cliente_id, sucursal_id, total, ticket, fecha, registrada_por)
values (1001, 1, 308, '4211', now() - interval '3 minutes', (select id from perfiles where rol = 'admin'));
select pruebas.verifica((select puntos from compras where ticket = '4211') = 31, '$308 en Plata da 31 puntos');
select pruebas.verifica((select registrada_por from compras where ticket = '4211') = auth.uid(), 'la venta queda a nombre de la empleada aunque mande otro ID');
select pruebas.verifica((select atendida_por from compras where ticket = '4211') = auth.uid(), 'sin elegir quién atiende, la atendió quien tiene la sesión');

-- Celular compartido: Lupita tiene la sesión y la venta la atendió Rosa.
insert into compras (cliente_id, sucursal_id, total, ticket, atendida_por)
values (1001, 2, 10, 'AT1', (select id from perfiles where correo = 'admin@torrestorres.mx'));
select pruebas.verifica((select atendida_por = (select id from perfiles where correo = 'admin@torrestorres.mx') and registrada_por = auth.uid()
  from compras where ticket = 'AT1'), 'la venta queda a nombre de quien atendió y se sabe desde qué cuenta se registró');
select pruebas.debe_fallar($$insert into compras (cliente_id, sucursal_id, total, ticket, atendida_por)
  values (1001, 2, 10, 'AT2', (select id from perfiles where correo = 'monica@torrestorres.mx'))$$,
  'no se puede poner como quien atendió a una empleada desactivada');

select pruebas.debe_fallar($$insert into compras (cliente_id, sucursal_id, total, ticket) values (1001, 1, 50, ' 4211 ')$$,
  'no se puede repetir el ticket en la misma sucursal');
insert into compras (cliente_id, sucursal_id, total, ticket) values (1001, 2, 50, '4211');
select pruebas.verifica(true, 'el mismo número de ticket sí se puede en otra sucursal');
reset role;
delete from compras where sucursal_id = 2;
set role authenticated;

insert into compras (cliente_id, sucursal_id, total, ticket, fecha) values (1001, 1, 1800, '4212', now() - interval '2 minutes');
insert into compras (cliente_id, sucursal_id, total, ticket, fecha) values (1001, 1, 100, '4213', now() - interval '1 minute');
select pruebas.verifica((select puntos from compras where ticket = '4212') = 180, 'la compra que sube de nivel usa el nivel anterior (Plata)');
select pruebas.verifica((select n.nombre from compras c join niveles n on n.id = c.nivel_id where ticket = '4213') = 'Oro', 'la siguiente compra ya es en Oro');
select pruebas.verifica((select puntos from compras where ticket = '4213') = 20, 'en Oro cada $10 da 2 puntos');

select pruebas.verifica((select nivel = 'Oro' and acumulado = 2208 and puntos = 231 and puede_canjear and pesos_canje = 57.75
  and siguiente_nivel = 'Diamante' and falta_para_siguiente = 2792 from estado_cliente(1001)), 'estado del cliente: Oro, $2,208, 231 puntos');
select pruebas.verifica((select vigencia::date from estado_cliente(1001)) = (now() + interval '6 months')::date, 'los puntos vencen 6 meses después de la última compra');
select pruebas.verifica((select count(*) from resumen_clientes) = 1, 'la empleada ve la vista resumen_clientes');

-- La empleada no edita ni cancela ventas guardadas.
update compras set cancelada = true where ticket = '4212';
select pruebas.verifica((select not cancelada from compras where ticket = '4212'), 'la empleada no puede cancelar una venta');
delete from compras where ticket = '4212';
select pruebas.verifica((select count(*) from compras where ticket = '4212') = 1, 'la empleada no puede borrar una venta');
select pruebas.debe_fallar($$select * from recorrer_cliente(1001, now(), now() - interval '1 year')$$, 'la empleada no puede forzar un recálculo');

-- La empleada puede corregir datos del cliente, pero no quién lo registró.
update clientes set notas = 'Prefiere oro blanco.', registrado_por = null, registro = '2020-01-01' where id = 1001;
select pruebas.verifica((select notas = 'Prefiere oro blanco.' and registrado_por = auth.uid() and registro > '2026-01-01' from clientes where id = 1001),
  'la empleada corrige notas, pero no el registro');
select pruebas.verifica((select token_tarjeta from clientes where id = 1001) <> regenerar_token_tarjeta(1001)
  and (select token_tarjeta from clientes where id = 1001) is not null, 'regenerar el QR cambia el código');

-- Reglas: solo lectura para la empleada.
update configuracion set minimo_canje = 500;
update niveles set puntos_por_bloque = 10;
select pruebas.verifica((select minimo_canje from configuracion) = 1 and (select max(puntos_por_bloque) from niveles) = 2,
  'la empleada no cambia las reglas de lealtad');
update perfiles set rol = 'admin' where id = auth.uid();
select pruebas.verifica((select rol from perfiles where id = auth.uid()) = 'empleada', 'la empleada no se puede hacer admin');

-- Administrador: cancelar recalcula -----------------------------------------

select pruebas.como('admin@torrestorres.mx');
update compras set cancelada = true, motivo_cancelacion = 'Error de captura' where ticket = '4212';
select pruebas.verifica((select puntos from compras where ticket = '4213') = 10, 'al cancelar, la compra siguiente se recalcula en Plata');
select pruebas.verifica((select cancelada_por = auth.uid() and cancelada_en is not null from compras where ticket = '4212'), 'se guarda quién y cuándo canceló');
select pruebas.verifica((select nivel = 'Plata' and puntos = 41 from estado_cliente(1001)), 'sin la venta cancelada: Plata con 41 puntos');
select pruebas.verifica((select count(*) from compras c where not cancelada and ticket = '4212') = 0, 'la venta cancelada no cuenta');
update compras set cancelada = false where ticket = '4212';
select pruebas.verifica((select puntos from compras where ticket = '4213') = 20 and (select cancelada_por from compras where ticket = '4212') is null,
  'al reactivarla vuelve a contar');

-- Historial estable: cambiar las reglas no altera compras ya registradas.
update niveles set puntos_por_bloque = 3 where nombre = 'Oro';
select pruebas.verifica((select puntos from compras where ticket = '4213') = 20, 'cambiar reglas no altera puntos ya guardados');
update niveles set puntos_por_bloque = 2 where nombre = 'Oro';

-- Canjes --------------------------------------------------------------------

-- El canje es abierto (mínimo 1); se prueba el mínimo poniéndolo en 200.
reset role;
update configuracion set minimo_canje = 200;
set role authenticated;
select pruebas.como('lupita@torrestorres.mx');
select pruebas.debe_fallar($$insert into canjes (cliente_id, sucursal_id, puntos) values (1001, 1, 0)$$, 'no se puede canjear menos del mínimo (1 punto)');
insert into canjes (cliente_id, sucursal_id, puntos, pesos) values (1001, 1, 200, 999);
select pruebas.verifica((select pesos from canjes) = 50, '200 puntos = $50, calculado por la base de datos');
select pruebas.verifica((select puntos from estado_cliente(1001)) = 31, 'el canje descuenta los puntos');
select pruebas.debe_fallar($$insert into canjes (cliente_id, sucursal_id, puntos) values (1001, 1, 200)$$, 'no se puede canjear más de lo disponible');
reset role;
update configuracion set minimo_canje = 1;
set role authenticated;

-- Vencimiento y baja de nivel ---------------------------------------------------

select pruebas.como('admin@torrestorres.mx');
insert into clientes (nombre, telefono) values ('Ana Sofía', '5281 0000 0001'), ('Laura', '8100000002'), ('Diana', '8100000003');
-- Ana: Diamante hace 10 meses; vence, baja solo a Oro y queda en $2,000.
insert into compras (cliente_id, sucursal_id, total, ticket, fecha) values
  (1002, 2, 3000, 'A1', now() - interval '10 months'),
  (1002, 2, 3000, 'A2', now() - interval '10 months' + interval '1 day');
select pruebas.verifica((select puntos from compras where ticket = 'A2') = 600, 'la segunda compra es en Oro');
select pruebas.verifica((select nivel = 'Oro' and acumulado = 2000 and puntos = 0 and vigencia is null
  and falta_para_siguiente = 3000 from estado_cliente(1002)), 'tras 6 meses sin comprar: baja un nivel, $2,000 y 0 puntos');
-- Una compra posterior vuelve a sumar desde Oro.
insert into compras (cliente_id, sucursal_id, total, ticket) values (1002, 2, 500, 'A3');
select pruebas.verifica((select puntos from compras where ticket = 'A3') = 100 and (select acumulado from estado_cliente(1002)) = 2500,
  'al volver a comprar sigue en Oro con su acumulado reiniciado');
-- Una venta capturada con fecha anterior recalcula las siguientes.
insert into compras (cliente_id, sucursal_id, total, ticket, fecha) values (1002, 2, 100, 'A0', now() - interval '3 months');
select pruebas.verifica((select puntos from compras where ticket = 'A0') = 20 and (select puntos from compras where ticket = 'A3') = 100,
  'una venta con fecha atrasada se calcula con el nivel que tenía ese día');
select pruebas.verifica((select nivel = 'Oro' and acumulado = 2600 and puntos = 120 from estado_cliente(1002)),
  'con la venta atrasada: Oro, $2,600 y 120 puntos');

-- Laura: una sola compra grande sube solo un nivel.
insert into compras (cliente_id, sucursal_id, total, ticket) values (1003, 3, 6000, 'L1');
select pruebas.verifica((select nivel from estado_cliente(1003)) = 'Oro' and (select puntos from compras where ticket = 'L1') = 600,
  'una compra de $6,000 en Plata sube solo a Oro y da 600 puntos');

-- Diana: en Plata no hay a dónde bajar; solo vencen los puntos.
insert into compras (cliente_id, sucursal_id, total, ticket, fecha) values (1004, 3, 900, 'D1', now() - interval '7 months');
select pruebas.verifica((select nivel = 'Plata' and puntos = 0 from estado_cliente(1004)), 'en Plata solo vencen los puntos');

-- Reglas de nivel configurables ---------------------------------------------------

select pruebas.como('lupita@torrestorres.mx');
update configuracion set niveles_por_compra = 0, baja_al_vencer = false;
select pruebas.verifica((select niveles_por_compra = 1 and baja_al_vencer from configuracion),
  'la empleada no cambia las reglas de nivel');

select pruebas.como('admin@torrestorres.mx');
update configuracion set niveles_por_compra = 0;
select pruebas.verifica((select nivel from estado_cliente(1003)) = 'Diamante',
  'sin límite por compra: $6,000 en una compra llega a Diamante');
select pruebas.verifica((select puntos from compras where ticket = 'L1') = 600, 'los puntos ya ganados no cambian');
update configuracion set niveles_por_compra = 1, baja_al_vencer = false;
select pruebas.verifica((select nivel = 'Diamante' and acumulado = 6600 and puntos = 120 from estado_cliente(1002)),
  'sin baja al vencer: Ana conserva Diamante y su acumulado; solo vencieron los puntos');
select pruebas.verifica((select nivel = 'Plata' and puntos = 0 from estado_cliente(1004)), 'sin baja al vencer: los puntos vencen igual');
update configuracion set baja_al_vencer = true;
select pruebas.verifica((select nivel from estado_cliente(1002)) = 'Oro' and (select nivel from estado_cliente(1003)) = 'Oro',
  'con las reglas por defecto todo vuelve a como estaba');

-- Celular de sucursal y empleadas sin cuenta ---------------------------------

-- El administrador da de alta a una empleada solo con su nombre.
insert into perfiles (nombre, rol) values ('Ana Pérez', 'empleada');
select pruebas.verifica((select id is not null and correo is null and activa from perfiles where nombre = 'Ana Pérez'),
  'el administrador da de alta una empleada sin correo ni cuenta');
select pruebas.debe_fallar($$insert into perfiles (nombre, rol) values ('Otra', 'admin')$$,
  'sin cuenta solo se dan de alta empleadas, no administradoras');

reset role;
insert into auth.users (email, raw_user_meta_data, raw_app_meta_data) values
  ('allende@torrestorres.mx', '{"nombre":"Sucursal Allende"}', '{"rol":"sucursal"}');
select pruebas.verifica((select rol::text = 'sucursal' and activa from perfiles where correo = 'allende@torrestorres.mx'),
  'la cuenta del celular se crea con rol sucursal');
set role authenticated;

select pruebas.como('allende@torrestorres.mx');
select pruebas.verifica(not es_admin() and es_personal(), 'la cuenta del celular es personal pero no admin');
select pruebas.debe_fallar($$insert into perfiles (nombre, rol) values ('Intrusa', 'empleada')$$,
  'la cuenta del celular no da de alta empleadas');
insert into compras (cliente_id, sucursal_id, total, ticket, atendida_por)
values (1001, 2, 10, 'SU1', (select id from perfiles where nombre = 'Ana Pérez'));
select pruebas.verifica((select atendida_por = (select id from perfiles where nombre = 'Ana Pérez') and registrada_por = auth.uid()
  from compras where ticket = 'SU1'), 'desde el celular, la venta queda a nombre de la empleada elegida');
select pruebas.debe_fallar($$insert into compras (cliente_id, sucursal_id, total, ticket) values (1001, 2, 10, 'SU2')$$,
  'desde el celular hay que decir qué empleada atendió');
select pruebas.verifica((select count(*) from perfiles where nombre = 'Ana Pérez') = 1, 'la cuenta del celular ve los nombres de las empleadas');
reset role;
delete from compras where ticket = 'SU1';
set role authenticated;
select pruebas.como('admin@torrestorres.mx');

-- Saldo inicial (clientes importados del Excel) -------------------------------
-- Arranca con el nivel y puntos del Excel; lo anterior al corte es historial.

select pruebas.como('admin@torrestorres.mx');
set role authenticated;
insert into clientes (id, nombre, telefono, registro) values (5001, 'Elena', '8100005001', now() - interval '8 months');
insert into saldos_iniciales (cliente_id, fecha, nivel_id, acumulado, puntos, ultima_compra, vence_desde)
  values (5001, now() - interval '1 day', (select id from niveles where nombre = 'Diamante'), 6000, 0, now() - interval '7 months', null);
insert into compras (cliente_id, sucursal_id, total, ticket, fecha, puntos) values
  (5001, 1, 6000, 'EX1', now() - interval '7 months', 650);
select pruebas.verifica((select puntos from compras where ticket = 'EX1') = 650, 'la compra anterior al corte conserva los puntos del Excel');
select pruebas.verifica((select nivel = 'Diamante' and puntos = 0 from estado_cliente(5001)),
  'con saldo vencido en el Excel conserva el nivel del Excel y no vuelve a bajar');
insert into compras (cliente_id, sucursal_id, total, ticket) values (5001, 1, 100, 'EX2');
select pruebas.verifica((select puntos from compras where ticket = 'EX2') = 20, 'la compra nueva gana puntos con el nivel del saldo');
select pruebas.verifica((select nivel = 'Diamante' and puntos = 20 from estado_cliente(5001)), 'el saldo más la compra nueva');

insert into clientes (id, nombre, telefono) values (5002, 'Fany', '8100005002');
insert into saldos_iniciales (cliente_id, fecha, nivel_id, acumulado, puntos, ultima_compra, vence_desde)
  values (5002, now() - interval '1 day', (select id from niveles where nombre = 'Oro'), 3000, 150, now() - interval '6 months 1 day', now() - interval '6 months 1 day');
select pruebas.verifica((select nivel = 'Plata' and puntos = 0 from estado_cliente(5002)),
  'si los puntos del saldo vencen después del corte, se aplican las reglas (pierde puntos y baja un nivel)');
update configuracion set baja_al_vencer = false;
select pruebas.verifica((select nivel = 'Oro' and puntos = 0 from estado_cliente(5002)),
  'con saldo y sin baja al vencer: pierde los puntos pero conserva el nivel del Excel');
update configuracion set baja_al_vencer = true;

-- Teléfono opcional y editar datos ----------------------------------------------

select pruebas.como('lupita@torrestorres.mx');
insert into clientes (id, nombre, telefono) values (5003, 'Gina', ''), (5004, 'Hilda', null);
select pruebas.verifica((select count(*) from clientes where id in (5003, 5004) and telefono is null) = 2,
  'se puede registrar a varias clientas sin teléfono');
update clientes set nombre = 'Gina Ruiz', telefono = '81 0000 5003' where id = 5003;
select pruebas.verifica((select nombre = 'Gina Ruiz' and telefono = '528100005003' from clientes where id = 5003),
  'la empleada puede agregar el teléfono y corregir el nombre después');
select pruebas.debe_fallar($$update clientes set telefono = '8100005002' where id = 5004$$, 'el teléfono sigue siendo único');
select pruebas.debe_fallar($$update clientes set telefono = '123' where id = 5004$$, 'un teléfono incompleto no se acepta');

-- Persona inactiva y público ---------------------------------------------------

select pruebas.como('monica@torrestorres.mx');
select pruebas.verifica((select count(*) from clientes) = 0, 'una cuenta desactivada no ve clientes');
select pruebas.debe_fallar($$insert into clientes (nombre, telefono) values ('X', '8100000009')$$, 'una cuenta desactivada no registra clientes');
select pruebas.debe_fallar($$select * from estado_cliente(1001)$$, 'una cuenta desactivada no consulta puntos');

reset role;
set role anon;
select pruebas.como(null);
select pruebas.debe_fallar('select * from clientes', 'sin sesión no se leen los clientes');
select pruebas.debe_fallar('select * from compras', 'sin sesión no se leen las compras');
select pruebas.debe_fallar('select * from estado_cliente(1001)', 'sin sesión no se consulta estado_cliente');
reset role;
create temp table token_maria as select token_tarjeta from clientes where id = 1001;
grant select on token_maria to anon;
set role anon;
select pruebas.verifica((select nombre = 'María' and nivel = 'Oro' and puntos = 31 and pesos_canje = 7.75
  from tarjeta_publica((select token_tarjeta from token_maria))), 'la tarjeta pública muestra nombre de pila, nivel y puntos');
select pruebas.verifica((select siguiente_nivel = 'Diamante' and falta_para_siguiente > 0
  from tarjeta_publica((select token_tarjeta from token_maria))), 'la tarjeta pública dice cuánto falta para el siguiente nivel');
select pruebas.verifica((select numero = 1001
  from tarjeta_publica((select token_tarjeta from token_maria))), 'la tarjeta pública muestra el número de cliente');
select pruebas.verifica((select count(*) from tarjeta_publica(gen_random_uuid())) = 0, 'un código inventado no muestra nada');
reset role;

\echo 'Todas las pruebas pasaron.'
