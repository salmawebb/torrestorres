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
export function BotonExportar({ nombre, columnas, filas }) {
  const exportar = () => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const csv = [columnas.map((c) => esc(c.titulo)), ...filas.map((f) => columnas.map((c) => esc(c.valor(f))))]
      .map((r) => r.join(','))
      .join('\r\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${nombre}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  return (
    <button className="btn btn-secundario btn-chico" onClick={exportar}>
      ⤓ Exportar a Excel
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
