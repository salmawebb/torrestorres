import { Link } from 'react-router-dom'
import BuscarCliente from '../components/BuscarCliente'
import { Dato, NivelBadge, Tarjeta, Vacio } from '../components/Comunes'
import Ranking from '../components/Ranking'
import { useDatos } from '../context/Datos'
import { fecha, inicioDeSemana, inicioDelDia, pesos, sumarDias } from '../lib/formato'
import { cercaDeSubir, duplicados, porVencer, ranking } from '../lib/reportes'

export default function InicioAdmin() {
  const { compras, usuarios, clientes, resumenes, sucursales } = useDatos()
  const activas = compras.filter((v) => !v.cancelada)
  const suma = (l) => ({ total: l.reduce((s, v) => s + v.total, 0), n: l.length })
  const hoy = inicioDelDia()
  const semana = inicioDeSemana()
  const porSucursal = sucursales.map((s) => ({
    s,
    hoy: suma(activas.filter((v) => v.sucursal === s && v.fecha >= hoy)),
    semana: suma(activas.filter((v) => v.sucursal === s && v.fecha >= semana)),
  }))
  const totHoy = suma(activas.filter((v) => v.fecha >= hoy))
  const totSemana = suma(activas.filter((v) => v.fecha >= semana))
  const vencer = porVencer(clientes, resumenes)
  const cerca = cercaDeSubir(clientes, resumenes)
  const dups = duplicados(compras)
  const cli = (id) => clientes.find((c) => c.id === id)

  return (
    <div className="pagina">
      <h1 className="titulo">Resumen</h1>

      <div className="rejilla-kpi">
        <Tarjeta className="kpi"><Dato etiqueta="Ventas de hoy" valor={pesos(totHoy.total)} detalle={`${totHoy.n} ventas`} /></Tarjeta>
        <Tarjeta className="kpi"><Dato etiqueta="Ventas de la semana" valor={pesos(totSemana.total)} detalle={`${totSemana.n} ventas`} /></Tarjeta>
        <Tarjeta className="kpi"><Dato etiqueta="Clientes" valor={clientes.length} detalle={`${clientes.filter((c) => resumenes[c.id].puedeCanjear).length} pueden canjear`} /></Tarjeta>
      </div>

      <div className="rejilla-2">
        <Tarjeta titulo="Por sucursal">
          <table className="tabla">
            <thead><tr><th>Sucursal</th><th className="num">Hoy</th><th className="num">Semana</th></tr></thead>
            <tbody>
              {porSucursal.map((x) => (
                <tr key={x.s}>
                  <td>{x.s}</td>
                  <td className="num">{pesos(x.hoy.total)} <small>({x.hoy.n})</small></td>
                  <td className="num">{pesos(x.semana.total)} <small>({x.semana.n})</small></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Tarjeta>
        <Tarjeta titulo="Ranking de la semana" accion={<Link to="/reportes" className="enlace">Ver reporte</Link>}>
          <Ranking filas={ranking(compras, usuarios, semana, sumarDias(semana, 7))} />
        </Tarjeta>
      </div>

      <Tarjeta titulo="Registrar una venta">
        <BuscarCliente />
      </Tarjeta>

      <div className="rejilla-3">
        <Tarjeta titulo="Puntos por vencer">
          {vencer.length ? (
            <ul className="lista-simple">
              {vencer.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <Link to={`/clientes/${c.id}`}>{c.nombre} {c.apellidos.split(' ')[0]}</Link>
                  <span className="lista-monto">{fecha(resumenes[c.id].vigencia)}</span>
                </li>
              ))}
            </ul>
          ) : <Vacio>Ninguno en 30 días.</Vacio>}
        </Tarjeta>
        <Tarjeta titulo="Cerca de subir de nivel">
          {cerca.length ? (
            <ul className="lista-simple">
              {cerca.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <Link to={`/clientes/${c.id}`}>{c.nombre} {c.apellidos.split(' ')[0]}</Link>
                  <NivelBadge nivel={resumenes[c.id].siguienteNivel} />
                  <span className="lista-monto">{pesos(resumenes[c.id].faltaParaSiguiente)}</span>
                </li>
              ))}
            </ul>
          ) : <Vacio>Nadie por ahora.</Vacio>}
        </Tarjeta>
        <Tarjeta titulo="Pendientes de revisión">
          {dups.length ? (
            <ul className="lista-simple">
              {dups.map(([a, b]) => (
                <li key={b.id}>
                  <span className="alerta">Ticket duplicado</span>
                  <span>{a.sucursal} #{a.ticket}: {cli(a.clienteId).nombre} y {cli(b.clienteId).nombre}</span>
                </li>
              ))}
            </ul>
          ) : <Vacio>Todo en orden.</Vacio>}
        </Tarjeta>
      </div>

      <Tarjeta titulo="Accesos directos">
        <div className="accesos">
          <Link to="/administracion?tab=usuarios" className="acceso">👤 Usuarios</Link>
          <Link to="/administracion?tab=lealtad" className="acceso">⭐ Configuración de lealtad</Link>
          <Link to="/ventas" className="acceso">✕ Cancelar ventas</Link>
          <Link to="/administracion?tab=importar" className="acceso">⤒ Importar Excel</Link>
        </div>
      </Tarjeta>
    </div>
  )
}
