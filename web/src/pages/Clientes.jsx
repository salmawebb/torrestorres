import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BotonExportar, NivelBadge, Tarjeta, Vacio } from '../components/Comunes'
import { filtrarClientes } from '../components/BuscarCliente'
import { Filtros, FiltroNivel, FiltroSucursal } from '../components/Filtros'
import { useDatos } from '../context/Datos'
import { useSesion } from '../context/Sesion'
import { fecha, pesos, sumarDias, telefono } from '../lib/formato'

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export default function Clientes() {
  const { clientes, compras, resumenes, reglas } = useDatos()
  const { esAdmin } = useSesion()
  const navigate = useNavigate()
  const [texto, setTexto] = useState('')
  const [nivel, setNivel] = useState('Todos')
  const [mes, setMes] = useState('')
  const [sucursal, setSucursal] = useState('Todas')
  const [sinComprar, setSinComprar] = useState('')

  const ultimaSucursal = (id) => {
    const suyas = compras.filter((v) => v.clienteId === id && !v.cancelada).sort((a, b) => b.fecha - a.fecha)
    return suyas[0]?.sucursal ?? '—'
  }

  let lista = texto.trim() ? filtrarClientes(clientes, texto) : clientes
  lista = lista.filter((c) => {
    const r = resumenes[c.id]
    if (nivel !== 'Todos' && r.nivel !== nivel) return false
    if (mes && c.cumpleanos.split('/')[1] !== mes.padStart(2, '0')) return false
    if (sucursal !== 'Todas' && ultimaSucursal(c.id) !== sucursal) return false
    if (sinComprar && r.ultimaCompra && r.ultimaCompra > sumarDias(new Date(), -Number(sinComprar))) return false
    return true
  })

  const columnas = [
    { titulo: 'Número', valor: (c) => c.id },
    { titulo: 'Nombre', valor: (c) => `${c.nombre} ${c.apellidos}` },
    { titulo: 'Teléfono', valor: (c) => c.telefono },
    { titulo: 'Cumpleaños', valor: (c) => c.cumpleanos },
    { titulo: 'Nivel', valor: (c) => resumenes[c.id].nivel },
    { titulo: 'Puntos', valor: (c) => resumenes[c.id].puntos },
    { titulo: 'Compra acumulada', valor: (c) => resumenes[c.id].acumulado },
    { titulo: 'Última compra', valor: (c) => fecha(resumenes[c.id].ultimaCompra) },
  ]

  return (
    <div className="pagina">
      <div className="titulo-fila">
        <h1 className="titulo">Clientes</h1>
        <div className="acciones-titulo">
          {esAdmin && <BotonExportar nombre="clientes" columnas={columnas} filas={lista} />}
          <Link to="/clientes/nuevo" className="btn btn-primario btn-chico">+ Cliente nuevo</Link>
        </div>
      </div>

      <Filtros>
        <label className="filtro-ancho">
          Buscar
          <input type="search" placeholder="Nombre, teléfono o número" value={texto} onChange={(e) => setTexto(e.target.value)} />
        </label>
        <FiltroNivel valor={nivel} onChange={setNivel} niveles={reglas.niveles} />
        <label>
          Cumpleaños
          <select value={mes} onChange={(e) => setMes(e.target.value)}>
            <option value="">Cualquier mes</option>
            {MESES.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
          </select>
        </label>
        <FiltroSucursal valor={sucursal} onChange={setSucursal} />
        <label>
          Sin comprar en
          <select value={sinComprar} onChange={(e) => setSinComprar(e.target.value)}>
            <option value="">—</option>
            <option value="30">30 días</option>
            <option value="90">3 meses</option>
            <option value="180">6 meses</option>
          </select>
        </label>
      </Filtros>

      <Tarjeta>
        <p className="conteo">{lista.length} clientes</p>
        {lista.length ? (
          <div className="tabla-envoltura">
            <table className="tabla tabla-clic">
              <thead>
                <tr><th>#</th><th>Nombre</th><th>Teléfono</th><th>Nivel</th><th className="num">Puntos</th><th className="num">Acumulado</th><th>Última compra</th></tr>
              </thead>
              <tbody>
                {lista.map((c) => {
                  const r = resumenes[c.id]
                  return (
                    <tr key={c.id} onClick={() => navigate(`/clientes/${c.id}`)}>
                      <td>{c.id}</td>
                      <td><Link to={`/clientes/${c.id}`}>{c.nombre} {c.apellidos}</Link></td>
                      <td>{telefono(c.telefono)}</td>
                      <td><NivelBadge nivel={r.nivel} /></td>
                      <td className="num">{r.puntos}</td>
                      <td className="num">{pesos(r.acumulado)}</td>
                      <td>{fecha(r.ultimaCompra)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Vacio>Ningún cliente coincide con los filtros.</Vacio>
        )}
      </Tarjeta>
    </div>
  )
}
