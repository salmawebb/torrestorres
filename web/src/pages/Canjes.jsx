import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BotonExportar, Tarjeta, Vacio } from '../components/Comunes'
import { desdeTexto, Filtros, FiltroFechas, FiltroSucursal, hastaTexto } from '../components/Filtros'
import { useDatos } from '../context/Datos'
import { useSesion } from '../context/Sesion'
import { fecha, pesos } from '../lib/formato'

export default function Canjes() {
  const { canjes, clientes, usuarios } = useDatos()
  const { esAdmin } = useSesion()
  const [sucursal, setSucursal] = useState('Todas')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [cliente, setCliente] = useState('')
  const cli = (id) => clientes.find((c) => c.id === id)

  const lista = canjes
    .filter((v) => sucursal === 'Todas' || v.sucursal === sucursal)
    .filter((v) => !desde || v.fecha >= desdeTexto(desde))
    .filter((v) => !hasta || v.fecha <= hastaTexto(hasta))
    .filter((v) => !cliente.trim() || `${cli(v.clienteId).nombre} ${cli(v.clienteId).apellidos}`.toLowerCase().includes(cliente.trim().toLowerCase()))
    .sort((a, b) => b.fecha - a.fecha)

  const columnas = [
    { titulo: 'Fecha', valor: (v) => v.fecha },
    { titulo: 'Sucursal', valor: (v) => v.sucursal },
    { titulo: 'Cliente', valor: (v) => `${cli(v.clienteId).nombre} ${cli(v.clienteId).apellidos}` },
    { titulo: 'Puntos', valor: (v) => v.puntos },
    { titulo: 'Descuento', valor: (v) => v.pesos },
    { titulo: 'Registró', valor: (v) => usuarios.find((u) => u.id === v.empleadaId)?.nombre },
  ]

  return (
    <div className="pagina">
      <div className="titulo-fila">
        <h1 className="titulo">Canjes</h1>
        {esAdmin && <BotonExportar nombre="canjes" columnas={columnas} filas={lista} />}
      </div>
      <Filtros>
        <FiltroSucursal valor={sucursal} onChange={setSucursal} />
        <FiltroFechas desde={desde} hasta={hasta} onDesde={setDesde} onHasta={setHasta} />
        <label>Cliente<input type="search" value={cliente} onChange={(e) => setCliente(e.target.value)} /></label>
      </Filtros>
      <Tarjeta>
        {lista.length ? (
          <div className="tabla-envoltura">
            <table className="tabla">
              <thead><tr><th>Fecha</th><th>Sucursal</th><th>Cliente</th><th className="num">Puntos</th><th className="num">Descuento</th><th>Registró</th></tr></thead>
              <tbody>
                {lista.map((v) => (
                  <tr key={v.id}>
                    <td>{fecha(v.fecha)}</td>
                    <td>{v.sucursal}</td>
                    <td><Link to={`/clientes/${v.clienteId}`}>{cli(v.clienteId).nombre} {cli(v.clienteId).apellidos}</Link></td>
                    <td className="num">{v.puntos}</td>
                    <td className="num">{pesos(v.pesos)}</td>
                    <td>{usuarios.find((u) => u.id === v.empleadaId)?.nombre.split(' ')[0]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Vacio>No hay canjes con esos filtros.</Vacio>
        )}
      </Tarjeta>
    </div>
  )
}
