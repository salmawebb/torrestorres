# Página web · Joyería Torres Torres

Sistema de ventas y programa de lealtad, hecho con **React + Vite** y **Supabase**.
Sigue el documento *Propuesta: sistema de ventas y lealtad*. La base de datos está en
[`../supabase`](../supabase/README.md).

Necesita `web/.env.local` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
(copia `.env.example`). Sin ese archivo la página no arranca: ya no hay modo demo.

## Correr en tu computadora

```bash
cd web
npm install
npm run dev
```

Abre http://localhost:5173 y entra con una cuenta creada por el administrador.

## Publicar en GitHub Pages

Cada cambio en `main` se publica solo en https://salmawebb.github.io/torrestorres/
(workflow `.github/workflows/pages.yml`). Para que use la base de datos real, agrega en
GitHub los secretos `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
(Settings > Secrets and variables > Actions); sin ellos la página no arranca.

## Pantallas

| Ruta | Quién | Qué hace |
| --- | --- | --- |
| `/login` | Todos | Correo y contraseña, recuperar contraseña |
| `/sucursal` | Todos | Elegir Allende, Olmos o Hidalgo al entrar |
| `/` | Empleada | Cobrar: escanear QR o buscar por teléfono, cliente nuevo, mis ventas de hoy, mi total de la semana, cumpleaños |
| `/` | Administrador | Ventas de hoy y semana por sucursal, ranking semanal de ventas, puntos por vencer, cerca de subir de nivel, pendientes, accesos directos |
| `/clientes` | Todos | Lista con búsqueda y filtros (nivel, cumpleaños, sucursal, sin comprar) |
| `/clientes/:id` | Todos | Ficha: nivel, puntos, vigencia, registrar compra, canjear, WhatsApp, QR nuevo; el admin cancela ventas |
| `/clientes/:id/compra` | Todos | Total + ticket, aviso de ticket duplicado, puntos que ganará, aviso por WhatsApp |
| `/clientes/nuevo` | Todos | Registro con teléfono normalizado a 52 y envío de la tarjeta |
| `/ventas`, `/canjes` | Todos | Historial filtrable (la empleada solo ve sus ventas) |
| `/empleadas`, `/reportes`, `/administracion` | Administrador | Ventas por empleada, reportes, usuarios, reglas de lealtad, importar Excel, respaldo |
| `/tarjeta/:token` | Público | Tarjeta del cliente: nombre de pila, nivel, puntos, vigencia y QR |
| `/contrasena` | Público | Crear contraseña desde la invitación o el enlace de recuperación |

"Exportar a Excel" (solo administrador) descarga un archivo `.xlsx` con los filtros aplicados; las fechas y los montos quedan como fechas y números de Excel.

"Escanear QR" lee la tarjeta del cliente con la cámara (BarcodeDetector en Chrome de Android, jsQR en Safari y computadoras) y abre su ficha. La cámara necesita HTTPS, que GitHub Pages ya da.

## Estructura

- `src/lib/lealtad.js`: reglas del programa (puntos por cada $10, niveles de uno en uno, vencimiento a 6 meses, canje desde 200 puntos).
- `src/lib/supabase.js`, `src/lib/api.js`: conexión y consultas a Supabase.
- `src/context/`: datos y sesión (Supabase).
- `src/pages/`, `src/components/`: pantallas y piezas reutilizables.

## Pendiente

- Importar el Excel actual.
- Probar el escaneo en los celulares y tabletas de cada sucursal.
