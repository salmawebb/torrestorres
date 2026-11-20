import { Link } from 'react-router-dom'
import { NivelBadge, Tarjeta, Vacio } from './Comunes'
import { useDatos } from '../context/Datos'
import { cumpleEnSemana, pesos } from '../lib/formato'
import { enlaceTarjeta, enlaceWhatsApp, mensajeRecordatorioCumple } from '../lib/lealtad'

// Clientes que cumplen años en los próximos 7 días. Se muestra en el inicio de
// la empleada y en el resumen del administrador, con el botón para mandarles
// por WhatsApp el recordatorio de su regalo de cumpleaños.
export default function CumpleanosSemana() {
  const { clientes, resumenes, reglas, regalos } = useDatos()
  const cumpleaneros = clientes
    .map((c) => ({ c, dia: cumpleEnSemana(c.cumpleanos) }))
    .filter((x) => x.dia)
    .sort((a, b) => a.dia - b.dia)

  return (
    <Tarjeta titulo="Cumpleaños de la semana">
      {cumpleaneros.length ? (
        <ul className="lista-simple">
          {cumpleaneros.map(({ c, dia }) => {
            const r = resumenes[c.id]
            const monto = reglas.niveles[r.indiceNivel]?.regaloCumple ?? 0
            const usado = regalos.some((g) => g.clienteId === c.id && g.fecha.getFullYear() === dia.getFullYear())
            const mensaje = mensajeRecordatorioCumple({ nombre: c.nombre, monto, nivel: r.nivel, enlace: enlaceTarjeta(c.token) })
            return (
              <li key={c.id}>
                <span className="lista-hora">{dia.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' })}</span>
                <Link to={`/clientes/${c.id}`}>{c.nombre} {c.apellidos.split(' ')[0]}</Link>
                <NivelBadge nivel={r.nivel} />
                <span className="cumple-acciones">
                  {usado ? (
                    <span title="Ya usó su regalo de cumpleaños">✓ Regalo usado</span>
                  ) : monto > 0 && <span title="Regalo de cumpleaños">🎁 {pesos(monto)}</span>}
                  {c.telefono && !usado && (
                    <a className="btn btn-whatsapp btn-chico" href={enlaceWhatsApp(c.telefono, mensaje)} target="_blank" rel="noreferrer">Recordarle</a>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      ) : (
        <Vacio>Nadie cumple años esta semana.</Vacio>
      )}
    </Tarjeta>
  )
}
