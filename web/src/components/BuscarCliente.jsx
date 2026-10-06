import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDatos } from '../context/Datos'
import { telefono as fmtTel } from '../lib/formato'
import EscanerQR from './EscanerQR'
import { NivelBadge } from './Comunes'

export function filtrarClientes(clientes, texto) {
  const q = texto.trim().toLowerCase()
  if (!q) return []
  const digitos = q.replace(/\D/g, '')
  return clientes.filter(
    (c) =>
      `${c.nombre} ${c.apellidos}`.toLowerCase().includes(q) ||
      (digitos.length >= 3 && c.telefono.includes(digitos)) ||
      String(c.id) === q,
  )
}

// Escanear QR (tableta y celular) o escribir teléfono / número (computadora).
export default function BuscarCliente({ destino = (c) => `/clientes/${c.id}` }) {
  const { clientes, resumenes } = useDatos()
  const [texto, setTexto] = useState('')
  const [escaneando, setEscaneando] = useState(false)
  const navigate = useNavigate()
  const resultados = filtrarClientes(clientes, texto).slice(0, 6)

  return (
    <div className="buscar-cliente">
      <div className="buscar-fila">
        <button className="btn btn-primario btn-escanear" onClick={() => setEscaneando(true)}>
          <span aria-hidden="true">▣</span> Escanear QR
        </button>
        <input
          type="search"
          inputMode="search"
          placeholder="Teléfono, nombre o número de cliente"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          aria-label="Buscar cliente"
        />
      </div>
      {texto.trim() && (
        <ul className="resultados">
          {resultados.map((c) => (
            <li key={c.id}>
              <button onClick={() => navigate(destino(c))}>
                <span>
                  <strong>{c.nombre} {c.apellidos}</strong>
                  <small>#{c.id} · {fmtTel(c.telefono)}</small>
                </span>
                <span className="resultado-derecha">
                  <NivelBadge nivel={resumenes[c.id].nivel} />
                  <small>{resumenes[c.id].puntos} pts</small>
                </span>
              </button>
            </li>
          ))}
          {!resultados.length && (
            <li className="sin-resultados">
              No hay clientes con ese dato.{' '}
              <button className="enlace" onClick={() => navigate(`/clientes/nuevo?telefono=${encodeURIComponent(texto)}`)}>
                Registrar cliente nuevo
              </button>
            </li>
          )}
        </ul>
      )}
      <EscanerQR
        abierto={escaneando}
        onCerrar={() => setEscaneando(false)}
        onEncontrado={(c) => {
          setEscaneando(false)
          navigate(destino(c))
        }}
      />
    </div>
  )
}
