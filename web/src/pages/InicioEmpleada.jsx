import { Link } from 'react-router-dom'
import BuscarCliente from '../components/BuscarCliente'
import { Dato, NivelBadge, Tarjeta, Vacio } from '../components/Comunes'
import { useDatos } from '../context/Datos'
import { useSesion } from '../context/Sesion'
import { cumpleEnSemana, hora, inicioDeSemana, inicioDelDia, pesos } from '../lib/formato'

export default function InicioEmpleada() {
  const { usuario } = useSesion()
  const { compras, clientes, resumenes } = useDatos()
  const mias = compras.filter((c) => c.empleadaId === usuario.id && !c.cancelada)
  const hoy = mias.filter((c) => c.fecha >= inicioDelDia()).sort((a, b) => b.fecha - a.fecha)
  const semana = mias.filter((c) => c.fecha >= inicioDeSemana())
  const cliente = (id) => clientes.find((c) => c.id === id)
  const cumpleaneros = clientes
    .map((c) => ({ c, dia: cumpleEnSemana(c.cumpleanos) }))
    .filter((x) => x.dia)
    .sort((a, b) => a.dia - b.dia)

  return (
    <div className="pagina">
      <h1 className="titulo">Cobrar</h1>

      <Tarjeta className="destacada">
        <BuscarCliente />
        <Link to="/clientes/nuevo" className="btn btn-secundario btn-bloque">+ Cliente nuevo</Link>
      </Tarjeta>

      <div className="rejilla-2">
        <Tarjeta titulo="Mis ventas de hoy">
          {hoy.length ? (
            <ul className="lista-simple">
              {hoy.map((v) => (
                <li key={v.id}>
                  <span className="lista-hora">{hora(v.fecha)}</span>
                  <Link to={`/clientes/${v.clienteId}`}>{cliente(v.clienteId).nombre} {cliente(v.clienteId).apellidos.split(' ')[0]}</Link>
                  <span className="lista-monto">{pesos(v.total)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Vacio>Todavía no registras ventas hoy.</Vacio>
          )}
        </Tarjeta>

        <div className="columna">
          <Tarjeta titulo="Mi total de la semana">
            <div className="datos-fila">
              <Dato etiqueta="Vendido" valor={pesos(semana.reduce((s, v) => s + v.total, 0))} />
              <Dato etiqueta="Ventas" valor={semana.length} />
            </div>
          </Tarjeta>

          <Tarjeta titulo="Cumpleaños de la semana">
            {cumpleaneros.length ? (
              <ul className="lista-simple">
                {cumpleaneros.map(({ c, dia }) => (
                  <li key={c.id}>
                    <span className="lista-hora">{dia.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' })}</span>
                    <Link to={`/clientes/${c.id}`}>{c.nombre} {c.apellidos.split(' ')[0]}</Link>
                    <NivelBadge nivel={resumenes[c.id].nivel} />
                  </li>
                ))}
              </ul>
            ) : (
              <Vacio>Nadie cumple años esta semana.</Vacio>
            )}
          </Tarjeta>
        </div>
      </div>
    </div>
  )
}
