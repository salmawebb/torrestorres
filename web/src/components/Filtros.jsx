import { useDatos } from '../context/Datos'

export function FiltroSucursal({ valor, onChange }) {
  const { sucursales } = useDatos()
  return (
    <label>
      Sucursal
      <select value={valor} onChange={(e) => onChange(e.target.value)}>
        <option>Todas</option>
        {sucursales.map((s) => <option key={s}>{s}</option>)}
      </select>
    </label>
  )
}

export function FiltroNivel({ valor, onChange, niveles }) {
  return (
    <label>
      Nivel
      <select value={valor} onChange={(e) => onChange(e.target.value)}>
        <option>Todos</option>
        {niveles.map((n) => <option key={n.nombre}>{n.nombre}</option>)}
      </select>
    </label>
  )
}

export function FiltroFechas({ desde, hasta, onDesde, onHasta }) {
  return (
    <>
      <label>Desde<input type="date" value={desde} onChange={(e) => onDesde(e.target.value)} /></label>
      <label>Hasta<input type="date" value={hasta} onChange={(e) => onHasta(e.target.value)} /></label>
    </>
  )
}

export function Filtros({ children }) {
  return <div className="filtros">{children}</div>
}

// "2026-10-06" -> rango de fechas locales
export const desdeTexto = (t) => (t ? new Date(`${t}T00:00:00`) : null)
export const hastaTexto = (t) => (t ? new Date(`${t}T23:59:59`) : null)
