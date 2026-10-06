import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BotonExportar, NivelBadge, Tarjeta, Vacio } from '../components/Comunes'
import { Filtros, FiltroSucursal } from '../components/Filtros'
import Ranking from '../components/Ranking'
import { useDatos } from '../context/Datos'
import { fecha, inicioDeSemana, pesos, sumarDias, telefono } from '../lib/formato'
import { cercaDeSubir, porVencer, ranking } from '../lib/reportes'

export default function Reportes() {
  const { compras, usuarios, clientes, resumenes } = useDatos()
  const [semanas, setSemanas] = useState(0)
  const [sucursal, setSucursal] = useState('Todas')
  const desde = sumarDias(inicioDeSemana(), -7 * semanas)
  const hasta = sumarDias(desde, 7)
  const filas = ranking(compras, usuarios, desde, hasta, sucursal)
  const vencer = porVencer(clientes, resumenes)
  const cerca = cercaDeSubir(clientes, resumenes)

  return (
    <div className="pagina">
      <h1 className="titulo">Reportes</h1>

      <Tarjeta
        titulo="Ranking semanal para el bono"
        accion={
          <BotonExportar
            nombre={`ranking-${desde.toISOString().slice(0, 10)}`}
            columnas={[
              { titulo: 'Empleada', valor: (f) => f.usuario.nombre },
              { titulo: 'Total vendido', valor: (f) => f.total },
              { titulo: 'Ventas', valor: (f) => f.ventas },
            ]}
            filas={filas}
          />
        }
      >
        <Filtros>
          <div className="selector-semana">
            <button className="btn-icono" onClick={() => setSemanas(semanas + 1)} aria-label="Semana anterior">‹</button>
            <span>{semanas === 0 ? 'Esta semana' : `${fecha(desde)} – ${fecha(sumarDias(hasta, -1))}`}</span>
            <button className="btn-icono" onClick={() => setSemanas(Math.max(semanas - 1, 0))} disabled={semanas === 0} aria-label="Semana siguiente">›</button>
          </div>
          <FiltroSucursal valor={sucursal} onChange={setSucursal} />
        </Filtros>
        <Ranking filas={filas} />
      </Tarjeta>

      <div className="rejilla-2">
        <Tarjeta titulo="Puntos por vencer (30 días)">
          {vencer.length ? (
            <ul className="lista-simple">
              {vencer.map((c) => (
                <li key={c.id}>
                  <Link to={`/clientes/${c.id}`}>{c.nombre} {c.apellidos.split(' ')[0]}</Link>
                  <span>{resumenes[c.id].puntos} pts · {telefono(c.telefono)}</span>
                  <span className="lista-monto">{fecha(resumenes[c.id].vigencia)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Vacio>Nadie tiene puntos por vencer.</Vacio>
          )}
        </Tarjeta>
        <Tarjeta titulo="Clientes cerca de subir de nivel">
          {cerca.length ? (
            <ul className="lista-simple">
              {cerca.map((c) => (
                <li key={c.id}>
                  <Link to={`/clientes/${c.id}`}>{c.nombre} {c.apellidos.split(' ')[0]}</Link>
                  <NivelBadge nivel={resumenes[c.id].nivel} />
                  <span className="lista-monto">faltan {pesos(resumenes[c.id].faltaParaSiguiente)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Vacio>Nadie está a menos de $500 de subir.</Vacio>
          )}
        </Tarjeta>
      </div>
    </div>
  )
}
