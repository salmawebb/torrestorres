import { useEffect, useState } from 'react'

export function NivelBadge({ nivel }) {
  return <span className={`nivel nivel-${nivel.toLowerCase()}`}>{nivel}</span>
}

export function Tarjeta({ titulo, accion, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(titulo || accion) && (
        <header className="card-header">
          {titulo && <h2>{titulo}</h2>}
          {accion}
        </header>
      )}
      {children}
    </section>
  )
}

export function Dato({ etiqueta, valor, detalle }) {
  return (
    <div className="dato">
      <span className="dato-etiqueta">{etiqueta}</span>
      <span className="dato-valor">{valor}</span>
      {detalle && <span className="dato-detalle">{detalle}</span>}
    </div>
  )
}

export function Vacio({ children }) {
  return <p className="vacio">{children}</p>
}

export function Modal({ abierto, titulo, onCerrar, children }) {
  useEffect(() => {
    if (!abierto) return
    const esc = (e) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [abierto, onCerrar])
  if (!abierto) return null
  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>{titulo}</h2>
          <button className="btn-icono" onClick={onCerrar} aria-label="Cerrar">✕</button>
        </header>
        {children}
      </div>
    </div>
  )
}

// Exporta a Excel lo que se ve en pantalla (con filtros). Por ahora genera un CSV
// que Excel abre directo; con datos reales se cambiará a .xlsx.
// Celda de Excel según el tipo del valor: números y fechas quedan como tales
// para que se puedan sumar y ordenar en Excel.
function celda(v) {
  if (v instanceof Date) {
    const conHora = v.getHours() || v.getMinutes()
    // La librería escribe la hora en UTC; se corre para que salga la hora local.
    const local = new Date(v.getTime() - v.getTimezoneOffset() * 60000)
    return { value: local, type: Date, format: conHora ? 'dd/mm/yyyy hh:mm' : 'dd/mm/yyyy' }
  }
  if (typeof v === 'number' && Number.isFinite(v)) return { value: v, type: Number }
  if (v === null || v === undefined || v === '') return null
  return { value: String(v), type: String }
}

export function BotonExportar({ nombre, columnas, filas }) {
  const [ocupado, setOcupado] = useState(false)
  const exportar = async () => {
    setOcupado(true)
    try {
      // Se carga solo al exportar, para no hacer más pesada la página.
      const { default: writeExcelFile } = await import('write-excel-file/browser')
      const encabezado = columnas.map((c) => ({ value: c.titulo, type: String, fontWeight: 'bold' }))
      const datos = filas.map((f) => columnas.map((c) => celda(c.valor(f))))
      const anchos = columnas.map((c, i) => ({
        width: Math.min(40, Math.max(10, c.titulo.length + 2, ...datos.slice(0, 200).map((r) => String(r[i]?.value ?? '').length + 2))),
      }))
      await writeExcelFile([encabezado, ...datos], { columns: anchos, stickyRowsCount: 1 }).toFile(`${nombre}.xlsx`)
    } catch {
      alert('No se pudo crear el archivo de Excel. Intenta de nuevo.')
    } finally {
      setOcupado(false)
    }
  }
  return (
    <button className="btn btn-secundario btn-chico" onClick={exportar} disabled={ocupado}>
      {ocupado ? 'Preparando…' : '⤓ Exportar a Excel'}
    </button>
  )
}

export function Aviso({ mensaje, onCerrar }) {
  useEffect(() => {
    if (!mensaje) return
    const t = setTimeout(onCerrar, 3500)
    return () => clearTimeout(t)
  }, [mensaje, onCerrar])
  if (!mensaje) return null
  return <div className="aviso" role="status">{mensaje}</div>
}

export function useAviso() {
  const [mensaje, setMensaje] = useState('')
  return [mensaje, setMensaje, () => setMensaje('')]
}
