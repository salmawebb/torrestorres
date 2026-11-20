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

## Publicar en Cloudflare Pages

La página se publica en Cloudflare Pages (proyecto conectado a este repositorio). Cada
cambio en `main` se publica solo; las demás ramas reciben una dirección de prueba.

Configuración del proyecto en Cloudflare (Workers & Pages > Create > Pages > Connect to Git):

| Campo | Valor |
| --- | --- |
| Production branch | `main` |
| Root directory | `web` |
| Build command | `npm run build` |
| Build output directory | `dist` |

Variables (Settings > Variables and secrets, en *Production* y *Preview*):

- `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`: conexión a Supabase (sin ellas la página no arranca).
- `SITE_URL`: dirección completa de la página, por ejemplo `https://joyeriatorrestorres.pages.dev/`
  o el dominio propio. Sirve para que WhatsApp muestre el logo al mandar la tarjeta.

No se pone `BASE_PATH`: en Cloudflare la página vive en la raíz del dominio.
`public/_redirects` hace que rutas como `/tarjeta/...` abran la página. La versión de Node
sale de `.node-version`.

Los enlaces de las tarjetas, los QR y los correos de cuenta se arman con la dirección desde
donde se abre la página (`urlPagina` en `src/lib/formato.js`), así que no hay que cambiar
código si cambia el dominio. Lo que sí hay que hacer al cambiar de dominio:

1. En Supabase > Authentication > URL Configuration: poner el nuevo *Site URL* y agregar
   `https://<dominio>/contrasena` a *Redirect URLs*.
2. Cambiar `SITE_URL` en Cloudflare y volver a publicar.
3. Cambiar la dirección del logo en `supabase/templates/*.html`.

### GitHub Pages (anterior)

Mientras se hace el cambio, `main` también se sigue publicando en
https://salmawebb.github.io/torrestorres/ (workflow `.github/workflows/pages.yml`). Cuando
Cloudflare quede funcionando se borra ese workflow y se apaga Pages en GitHub.

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
| `/empleadas`, `/reportes`, `/administracion` | Administrador | Ventas por empleada, reportes, usuarios, reglas de lealtad, respaldo |
| `/tarjeta/:token` | Público | Tarjeta del cliente: nombre de pila, nivel, puntos, vigencia y QR |
| `/contrasena` | Público | Crear contraseña desde la invitación o el enlace de recuperación |

"Exportar a Excel" (solo administrador) descarga un archivo `.xlsx` con los filtros aplicados; las fechas y los montos quedan como fechas y números de Excel.

"Escanear QR" lee la tarjeta del cliente con la cámara (BarcodeDetector en Chrome de Android, jsQR en Safari y computadoras) y abre su ficha. La cámara necesita HTTPS, que Cloudflare Pages ya da.

## Estructura

- `src/lib/lealtad.js`: reglas del programa (puntos por cada $10, niveles de uno en uno, vencimiento a 6 meses, canje desde 200 puntos).
- `src/lib/supabase.js`, `src/lib/api.js`: conexión y consultas a Supabase.
- `src/context/`: datos y sesión (Supabase).
- `src/pages/`, `src/components/`: pantallas y piezas reutilizables.

## Pendiente

- Probar el escaneo en los celulares y tabletas de cada sucursal.
