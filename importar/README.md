# Importar el Excel de clientes a Supabase

Pasa los clientes y las compras del Excel de la joyería al sistema. Se corre
una sola vez (o las veces que haga falta: lo que ya está no se repite).

## Qué hace

1. Lee la hoja de **clientes** y la de **compras** (las encuentra sola por sus
   encabezados; si no, se indican con `--hoja-clientes` y `--hoja-compras`).
2. Revisa cada fila y arma un **reporte** (`reporte_importacion.xlsx`):
   - **Problemas**: filas que no se pueden importar (sin teléfono, ID o folio
     repetido, sucursal desconocida, compra de un cliente que no existe...) y
     avisos para revisar.
   - **Comparación**: lo que dice el Excel (total, nivel, puntos, pesos) junto a
     lo que calcula el sistema con las reglas del programa de lealtad.
3. Con `--aplicar`, guarda en Supabase y verifica que el nivel y los puntos de
   cada cliente quedaron como se calcularon.

## Cómo pasa cada dato

| Excel (clientes) | Sistema |
| --- | --- |
| ID Cliente `TT.1105` | `clientes.id` = 1105 (se conserva; los nuevos siguen después del más alto) |
| Nombre | `nombre` (con mayúscula inicial; `--sin-corregir-nombres` lo deja igual) |
| Teléfono | `telefono` con lada 52 |
| Cumpleaños | `cumple_dia` y `cumple_mes` |
| Fecha registro | `registro` |
| Registró (empleada) | `registrado_por` si ya existe su cuenta con ese nombre; si no, queda en `notas` |
| Notas | `notas` |
| Total, nivel, última compra, puntos, pesos | No se guardan: el sistema los calcula de las compras. Solo se comparan. |

| Excel (compras) | Sistema |
| --- | --- |
| ID cliente, fecha, sucursal, monto, folio | `compras` (fecha a mediodía, hora de Monterrey) |
| Nivel usado, puntos generados, sube de nivel | No se guardan: los calcula el sistema. Solo se comparan. |

Las compras importadas quedan registradas por la cuenta de administrador que
hace la importación, porque el Excel no dice qué empleada hizo cada venta.

## Cómo correrlo

Necesitas Python 3.10 o más nuevo.

```bash
cd importar
python -m venv .venv
source .venv/bin/activate        # en Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # y llena SUPABASE_ANON_KEY y ADMIN_CORREO

# 1) Solo revisar (no guarda nada). Abre reporte_importacion.xlsx.
python importar_excel.py "C:/ruta/al/Excel de clientes.xlsx"

# 2) Cuando el reporte esté bien, guardar en Supabase:
python importar_excel.py "C:/ruta/al/Excel de clientes.xlsx" --aplicar
```

Se entra con una cuenta de **administrador** (la contraseña se pide en
pantalla), no con la llave secreta de Supabase. El `.env` y los Excel no se
suben al repositorio.
