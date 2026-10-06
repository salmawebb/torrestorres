import { useState } from 'react'
import { pesos } from '../lib/formato'

export default function Ranking({ filas }) {
  const [orden, setOrden] = useState({ col: 'total', desc: true })
  const ordenadas = [...filas].sort((a, b) => (orden.desc ? b[orden.col] - a[orden.col] : a[orden.col] - b[orden.col]))
  const max = Math.max(...filas.map((f) => f.total), 1)
  const encabezado = (col, texto) => (
    <th className="num">
      <button className="orden" onClick={() => setOrden({ col, desc: orden.col === col ? !orden.desc : true })}>
        {texto} {orden.col === col ? (orden.desc ? '↓' : '↑') : ''}
      </button>
    </th>
  )
  return (
    <div className="tabla-envoltura">
      <table className="tabla ranking">
        <thead>
          <tr><th>#</th><th>Empleada</th>{encabezado('total', 'Total vendido')}{encabezado('ventas', 'Ventas')}</tr>
        </thead>
        <tbody>
          {ordenadas.map((f, i) => (
            <tr key={f.usuario.id}>
              <td>{i + 1}</td>
              <td>
                {f.usuario.nombre}
                <div className="barra-ranking"><span style={{ width: `${(f.total / max) * 100}%` }} /></div>
              </td>
              <td className="num">{pesos(f.total)}</td>
              <td className="num">{f.ventas}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
