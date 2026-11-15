import { Link } from 'react-router-dom'
import BuscarCliente from '../components/BuscarCliente'
import { Dato, Tarjeta, Vacio } from '../components/Comunes'
import CumpleanosSemana from '../components/CumpleanosSemana'
import { useDatos } from '../context/Datos'
import { useSesion } from '../context/Sesion'
import { hora, inicioDeSemana, inicioDelDia } from '../lib/formato'

export default function InicioEmpleada() {
  const { usuario } = useSesion()
  const { compras, clientes } = useDatos()
  const mias = compras.filter((c) => c.empleadaId === usuario.id && !c.cancelada)
  const hoy = mias.filter((c) => c.fecha >= inicioDelDia()).sort((a, b) => b.fecha - a.fecha)
  const semana = mias.filter((c) => c.fecha >= inicioDeSemana())
  const cliente = (id) => clientes.find((c) => c.id === id)

  return (
    <div className="pagina">
      <h1 className="titulo">Cobrar</h1>

      <Tarjeta className="destacada">
        <BuscarCliente />
        <Link to="/clientes/nuevo" className="btn btn-secundario btn-bloque">+ Cliente nuevo</Link>
      </Tarjeta>

      <div className="rejilla-2">
        <Tarjeta titulo={`Mis registros de hoy (${hoy.length})`}>
          {hoy.length ? (
            <ul className="lista-simple">
              {hoy.map((v) => (
                <li key={v.id}>
                  <span className="lista-hora">{hora(v.fecha)}</span>
                  <Link to={`/clientes/${v.clienteId}`}>{cliente(v.clienteId).nombre} {cliente(v.clienteId).apellidos.split(' ')[0]}</Link>
                </li>
              ))}
            </ul>
          ) : (
            <Vacio>Todavía no tienes registros hoy.</Vacio>
          )}
        </Tarjeta>

        <div className="columna">
          <Tarjeta titulo="Mi total de la semana">
            <div className="datos-fila">
              <Dato etiqueta="Registros" valor={semana.length} />
            </div>
          </Tarjeta>

          <CumpleanosSemana />
        </div>
      </div>
    </div>
  )
}
