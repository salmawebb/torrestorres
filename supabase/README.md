# Base de datos (Supabase)

Base de datos PostgreSQL del sistema de ventas y lealtad, pensada para Supabase.
Todo está en migraciones SQL; nada se crea a mano desde el panel.

| Archivo | Qué crea |
| --- | --- |
| `migrations/…01_tablas.sql` | Sucursales, perfiles, configuración, niveles, clientes, compras y canjes, con los valores iniciales |
| `migrations/…02_lealtad.sql` | Cálculo de puntos, niveles y vigencia; validación de canjes; tarjeta pública |
| `migrations/…03_permisos.sql` | Permisos por rol (Row Level Security) |
| `migrations/…04_fotos_ticket.sql` | Bucket privado `tickets` para las fotos |

## Cómo funciona el programa de lealtad

- Cada compra guarda sus `puntos` y el `nivel_id` con que se calcularon. La base de
  datos los llena sola al registrar la compra; la página no los manda.
- El nivel actual, el acumulado, los puntos disponibles y la vigencia no se guardan:
  se calculan con `estado_cliente(id)` o la vista `resumen_clientes`.
- Cancelar una venta o capturarla con fecha atrasada recalcula las compras de ese
  cliente desde esa fecha. Cambiar las reglas no altera compras ya registradas.
- Los canjes se validan en la base: mínimo de la configuración y no más de lo
  disponible. Los pesos se calculan con el valor del punto.
- Las reglas son las mismas de `web/src/lib/lealtad.js`; se compararon ambos cálculos
  con 200 clientes al azar y dieron igual.

## Permisos

- Sin sesión no se lee ninguna tabla. Lo único público es `tarjeta_publica(token)`,
  que devuelve nombre de pila, nivel, puntos y vigencia para la página del QR.
- Empleada: registra y consulta clientes, compras y canjes; corrige datos de clientes
  y genera un QR nuevo. No edita, cancela ni borra ventas ni cambia reglas.
- Administrador: todo lo anterior, más cancelar o corregir ventas, cambiar reglas,
  sucursales y perfiles.
- Las ventas y canjes quedan a nombre de quien inició sesión, aunque la página mande
  otro ID. Solo el administrador puede indicar otra persona (para importar el Excel).
- Una cuenta desactivada (`perfiles.activa = false`) ya no ve ni registra nada.

## Cuentas

Cada cuenta de Supabase Auth crea su perfil sola. El nombre se toma de
`user_metadata.nombre` y el rol de `app_metadata.rol` (`admin` o `empleada`, por
omisión `empleada`). Para el primer administrador, después de crear su cuenta en el
panel de Supabase:

```sql
update perfiles set rol = 'admin' where correo = 'correo@del-admin';
```

## Pruebas

```sh
supabase/pruebas/correr.sh
```

Levanta un Postgres temporal (necesita PostgreSQL 15 o más), simula lo mínimo de
Supabase, aplica las migraciones y revisa reglas de lealtad y permisos.

## Subir a Supabase

```sh
npx supabase link --project-ref <ref-del-proyecto>
npx supabase db push
```

Al importar el Excel con los ID de cliente originales, ajusta después el contador:
`select setval(pg_get_serial_sequence('clientes', 'id'), (select max(id) from clientes));`
