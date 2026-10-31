import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BotonExportar, NivelBadge, Tarjeta, Vacio } from '../components/Comunes'
import { desdeTexto, Filtros, FiltroFechas, FiltroNivel, FiltroSucursal, hastaTexto } from '../components/Filtros'
import { useDatos } from '../context/Datos'
import { useSesion } from '../context/Sesion'
import { fecha, hora, pesos } from '../lib/formato'

export default function Ventas() {
  const { compras, clientes, usuarios, resumenes, reglas } = useDatos()
  const { usuario, esAdmin } = useSesion()
  const [sucursal, setSucursal] = useState('Todas')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [cliente, setCliente] = useState('')
  const [empleada, setEmpleada] = useState('Todas')
  const [nivel, setNivel] = useState('Todos')

  const cli = (id) => clientes.find((c) => c.id === id)
  const nombreEmpleada = (id) => usuarios.find((u) => u.id === id)?.nombre ?? '—'
  const nivelUsado = (v) => resumenes[v.clienteId].puntosPorCompraId[v.id]?.nivel ?? '—'

  const lista = compras
    .filter((v) => esAdmin || v.empleadaId === usuario.id)
    .filter((v) => sucursal === 'Todas' || v.sucursal === sucursal)
    .filter((v) => !desde || v.fecha >= desdeTexto(desde))
    .filter((v) => !hasta || v.fecha <= hastaTexto(hasta))
    .filter((v) => !cliente.trim() || `${cli(v.clienteId).nombre} ${cli(v.clienteId).apellidos}`.toLowerCase().includes(cliente.trim().toLowerCase()))
    .filter((v) => empleada === 'Todas' || v.empleadaId === empleada)
    .filter((v) => nivel === 'Todos' || nivelUsado(v) === nivel)
    .sort((a, b) => b.fecha - a.fecha)

  const activas = lista.filter((v) => !v.cancelada)
  const columnas = [
    { titulo: 'Fecha', valor: (v) => v.fecha },
    { titulo: 'Sucursal', valor: (v) => v.sucursal },
    { titulo: 'Ticket', valor: (v) => v.ticket },
    { titulo: 'Cliente', valor: (v) => `${cli(v.clienteId).nombre} ${cli(v.clienteId).apellidos}` },
    { titulo: 'Total', valor: (v) => v.total },
    { titulo: 'Puntos', valor: (v) => resumenes[v.clienteId].puntosPorCompraId[v.id]?.puntos ?? 0 },
    { titulo: 'Nivel usado', valor: nivelUsado },
    { titulo: 'Registró', valor: (v) => nombreEmpleada(v.empleadaId) },
    { titulo: 'Estado', valor: (v) => (v.cancelada ? 'Cancelada' : 'Activa') },
  ]

  return (
    <div className="pagina">
      <div className="titulo-fila">
        <h1 className="titulo">{esAdmin ? 'Ventas' : 'Mis ventas'}</h1>
        {esAdmin && <BotonExportar nombre="ventas" columnas={columnas} filas={lista} />}
      </div>

      <Filtros>
        <FiltroSucursal valor={sucursal} onChange={setSucursal} />
        <FiltroFechas desde={desde} hasta={hasta} onDesde={setDesde} onHasta={setHasta} />
        <label>Cliente<input type="search" value={cliente} onChange={(e) => setCliente(e.target.value)} /></label>
        {esAdmin && (
          <label>
            Empleada
            <select value={empleada} onChange={(e) => setEmpleada(e.target.value)}>
              <option>Todas</option>
              {usuarios.filter((u) => u.rol === 'empleada').map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          </label>
        )}
        <FiltroNivel valor={nivel} onChange={setNivel} niveles={reglas.niveles} />
      </Filtros>

      <Tarjeta>
        <p className="conteo">{activas.length} ventas · {pesos(activas.reduce((s, v) => s + v.total, 0))}</p>
        {lista.length ? (
          <div className="tabla-envoltura">
            <table className="tabla">
              <thead>
                <tr><th>Fecha</th><th>Sucursal</th><th>Ticket</th><th>Cliente</th><th className="num">Total</th><th className="num">Puntos</th><th>Nivel</th>{esAdmin && <th>Registró</th>}</tr>
              </thead>
              <tbody>
                {lista.map((v) => (
                  <tr key={v.id} className={v.cancelada ? 'cancelada' : ''}>
                    <td>{fecha(v.fecha)} <small>{hora(v.fecha)}</small></td>
                    <td>{v.sucursal}</td>
                    <td>{v.ticket}</td>
                    <td><Link to={`/clientes/${v.clienteId}`}>{cli(v.clienteId).nombre} {cli(v.clienteId).apellidos.split(' ')[0]}</Link></td>
                    <td className="num">{pesos(v.total)}</td>
                    <td className="num">{v.cancelada ? 'Cancelada' : resumenes[v.clienteId].puntosPorCompraId[v.id]?.puntos ?? 0}</td>
                    <td>{nivelUsado(v) !== '—' ? <NivelBadge nivel={nivelUsado(v)} /> : '—'}</td>
                    {esAdmin && <td>{nombreEmpleada(v.empleadaId).split(' ')[0]}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Vacio>No hay ventas con esos filtros.</Vacio>
        )}
      </Tarjeta>
    </div>
  )
}
