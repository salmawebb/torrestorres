# Página web · Joyería Torres Torres

Interfaz (solo UI) del sistema de ventas y programa de lealtad, hecha con **React + Vite**.
Sigue el documento *Propuesta: sistema de ventas y lealtad*. Por ahora usa **datos de ejemplo
en memoria**; la base de datos (Supabase) y el login real se conectarán después.

## Correr en tu computadora

```bash
cd web
npm install
npm run dev
```

Abre http://localhost:5173 y entra con los botones de demo ("Entrar como empleada" o
"Entrar como administrador"), o con un correo de ejemplo como `lupita@torrestorres.mx`
y cualquier contraseña.

## Pantallas

| Ruta | Quién | Qué hace |
| --- | --- | --- |
| `/login` | Todos | Correo y contraseña, recuperar contraseña |
| `/sucursal` | Todos | Elegir Allende, Olmos o Hidalgo al entrar |
| `/` | Empleada | Cobrar: escanear QR o buscar por teléfono, cliente nuevo, mis ventas de hoy, mi total de la semana, cumpleaños |
| `/` | Administrador | Ventas de hoy y semana por sucursal, ranking del bono, puntos por vencer, cerca de subir de nivel, pendientes, accesos directos |
| `/clientes` | Todos | Lista con búsqueda y filtros (nivel, cumpleaños, sucursal, sin comprar) |
| `/clientes/:id` | Todos | Ficha: nivel, puntos, vigencia, registrar compra, canjear, WhatsApp, QR nuevo; el admin cancela ventas |
| `/clientes/:id/compra` | Todos | Total + ticket, aviso de ticket duplicado, puntos que ganará, aviso por WhatsApp |
| `/clientes/nuevo` | Todos | Registro con teléfono normalizado a 52 y envío de la tarjeta |
| `/ventas`, `/canjes` | Todos | Historial filtrable (la empleada solo ve sus ventas) |
| `/empleadas`, `/reportes`, `/administracion` | Administrador | Ventas por empleada, reportes, usuarios, reglas de lealtad, importar Excel, respaldo |
| `/tarjeta/:token` | Público | Tarjeta del cliente: nombre de pila, nivel, puntos, vigencia y QR |

"Exportar a Excel" (solo administrador) descarga por ahora un CSV con los filtros aplicados.

## Estructura

- `src/lib/lealtad.js`: reglas del programa (puntos por cada $10, niveles de uno en uno, vencimiento a 6 meses, canje desde 200 puntos).
- `src/data/mock.js`: datos de ejemplo.
- `src/context/`: datos en memoria y sesión.
- `src/pages/`, `src/components/`: pantallas y piezas reutilizables.

## Pendiente

- Conectar Supabase (tablas, login, permisos por rol con Row Level Security).
- Leer el QR con la cámara (hoy la vista de cámara está lista y la lectura se simula).
- Exportar en `.xlsx` e importar el Excel actual.
