import { useState } from 'react'
import { BotonExportar, Dato, Tarjeta } from '../components/Comunes'
import { useDatos } from '../context/Datos'
import { fecha, inicioDeSemana, pesos, sumarDias } from '../lib/formato'

const inicioDeMes = () => {
  const f = new Date()
  return new Date(f.getFullYear(), f.getMonth(), 1)
}

export default function Empleadas() {
  const { usuarios, compras } = useDatos()
  const empleadas = usuarios.filter((u) => u.rol === 'empleada')
  const [elegida, setElegida] = useState(empleadas[0].id)
  const suma = (lista) => ({ total: lista.reduce((s, v) => s + v.total, 0), ventas: lista.length })
  const deEmpleada = (id) => compras.filter((v) => v.empleadaId === id && !v.cancelada)

  const ventas = deEmpleada(elegida)
  const semanas = Array.from({ length: 8 }, (_, i) => {
    const desde = sumarDias(inicioDeSemana(), -7 * i)
    const hasta = sumarDias(desde, 7)
    return { desde, ...suma(ventas.filter((v) => v.fecha >= desde && v.fecha < hasta)) }
  })
  const meses = Array.from({ length: 6 }, (_, i) => {
    const m = inicioDeMes()
    const desde = new Date(m.getFullYear(), m.getMonth() - i, 1)
    const hasta = new Date(m.getFullYear(), m.getMonth() - i + 1, 1)
    return { desde, ...suma(ventas.filter((v) => v.fecha >= desde && v.fecha < hasta)) }
  })
  const u = usuarios.find((x) => x.id === elegida)

  return (
    <div className="pagina">
      <h1 className="titulo">Empleadas</h1>
      <div className="chips" role="tablist">
        {empleadas.map((e) => (
          <button key={e.id} role="tab" aria-selected={e.id === elegida} className={`chip ${e.id === elegida ? 'activo' : ''}`} onClick={() => setElegida(e.id)}>
            {e.nombre}{!e.activa && ' (inactiva)'}
          </button>
        ))}
      </div>

      <Tarjeta titulo={u.nombre} accion={
        <BotonExportar
          nombre={`empleada-${u.nombre.split(' ')[0].toLowerCase()}`}
          columnas={[{ titulo: 'Semana desde', valor: (s) => fecha(s.desde) }, { titulo: 'Total', valor: (s) => s.total }, { titulo: 'Ventas', valor: (s) => s.ventas }]}
          filas={semanas}
        />
      }>
        <div className="datos-fila">
          <Dato etiqueta="Esta semana" valor={pesos(semanas[0].total)} detalle={`${semanas[0].ventas} ventas`} />
          <Dato etiqueta="Este mes" valor={pesos(meses[0].total)} detalle={`${meses[0].ventas} ventas`} />
        </div>
      </Tarjeta>

      <div className="rejilla-2">
        <Tarjeta titulo="Por semana">
          <table className="tabla">
            <thead><tr><th>Semana</th><th className="num">Total</th><th className="num">Ventas</th></tr></thead>
            <tbody>
              {semanas.map((s) => (
                <tr key={s.desde.getTime()}><td>{fecha(s.desde)}</td><td className="num">{pesos(s.total)}</td><td className="num">{s.ventas}</td></tr>
              ))}
            </tbody>
          </table>
        </Tarjeta>
        <Tarjeta titulo="Por mes">
          <table className="tabla">
            <thead><tr><th>Mes</th><th className="num">Total</th><th className="num">Ventas</th></tr></thead>
            <tbody>
              {meses.map((s) => (
                <tr key={s.desde.getTime()}>
                  <td>{s.desde.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}</td>
                  <td className="num">{pesos(s.total)}</td>
                  <td className="num">{s.ventas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Tarjeta>
      </div>
    </div>
  )
}
