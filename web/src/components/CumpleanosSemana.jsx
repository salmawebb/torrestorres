import { Link } from 'react-router-dom'
import { NivelBadge, Tarjeta, Vacio } from './Comunes'
import { useDatos } from '../context/Datos'
import { cumpleEnSemana } from '../lib/formato'

// Clientes que cumplen años esta semana. Se muestra en el inicio de la
// empleada y en el resumen del administrador.
export default function CumpleanosSemana() {
  const { clientes, resumenes } = useDatos()
  const cumpleaneros = clientes
    .map((c) => ({ c, dia: cumpleEnSemana(c.cumpleanos) }))
    .filter((x) => x.dia)
    .sort((a, b) => a.dia - b.dia)

  return (
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
  )
}
