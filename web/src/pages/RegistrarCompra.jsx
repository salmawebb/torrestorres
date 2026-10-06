import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Dato, NivelBadge, Tarjeta, Vacio } from '../components/Comunes'
import { useDatos } from '../context/Datos'
import { useSesion } from '../context/Sesion'
import { fecha, pesos } from '../lib/formato'
import { enlaceTarjeta, enlaceWhatsApp, mensajeWhatsApp, puntosPorCompra, resumenCliente } from '../lib/lealtad'

const paraInput = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)

export default function RegistrarCompra() {
  const { id } = useParams()
  const { clientes, compras, canjes, resumenes, reglas, agregarCompra } = useDatos()
  const { usuario, sucursal } = useSesion()
  const navigate = useNavigate()
  const [total, setTotal] = useState('')
  const [ticket, setTicket] = useState('')
  const [cambiarFecha, setCambiarFecha] = useState(false)
  const [cuando, setCuando] = useState(paraInput(new Date()))
  const [foto, setFoto] = useState(null)
  const [guardada, setGuardada] = useState(null)

  const c = clientes.find((x) => String(x.id) === id)
  if (!c) return <Vacio>No se encontró el cliente.</Vacio>
  const r = resumenes[c.id]
  const monto = Number(total) || 0
  const ganara = monto > 0 ? puntosPorCompra(monto, r.indiceNivel, reglas) : 0
  const duplicado = ticket && compras.some((v) => !v.cancelada && v.sucursal === sucursal && v.ticket === ticket.trim())
  const sube = r.siguienteNivel && monto >= r.faltaParaSiguiente

  const guardar = (e) => {
    e.preventDefault()
    if (monto <= 0 || !ticket.trim() || duplicado) return
    const nueva = agregarCompra({
      clienteId: c.id,
      fecha: cambiarFecha ? new Date(cuando) : new Date(),
      sucursal,
      total: monto,
      ticket: ticket.trim(),
      empleadaId: usuario.id,
    })
    // Resumen con la compra nueva, para el mensaje de WhatsApp.
    const despues = resumenCliente(
      [...compras.filter((v) => v.clienteId === c.id), nueva],
      canjes.filter((v) => v.clienteId === c.id),
      reglas,
    )
    setGuardada({ compra: nueva, despues, ganados: despues.puntosPorCompraId[nueva.id].puntos })
  }

  if (guardada) {
    const { despues, ganados, compra } = guardada
    const texto = mensajeWhatsApp({ nombre: c.nombre, ganados, puntos: despues.puntos, nivel: despues.nivel, vigencia: despues.vigencia, enlace: enlaceTarjeta(c.token) })
    return (
      <div className="pagina pagina-angosta">
        <Tarjeta className="exito">
          <div className="exito-icono" aria-hidden="true">✓</div>
          <h1>Venta guardada</h1>
          <p>{c.nombre} ganó <strong>{ganados} puntos</strong> con el ticket {compra.ticket} ({pesos(compra.total)}).</p>
          <div className="datos-fila centrado">
            <Dato etiqueta="Puntos" valor={despues.puntos} />
            <Dato etiqueta="Nivel" valor={<NivelBadge nivel={despues.nivel} />} />
            <Dato etiqueta="Vigencia" valor={fecha(despues.vigencia)} />
          </div>
          {despues.nivel !== r.nivel && <p className="estado-ok">🎉 ¡Subió a nivel {despues.nivel}!</p>}
          <a className="btn btn-whatsapp btn-bloque" href={enlaceWhatsApp(c.telefono, texto)} target="_blank" rel="noreferrer">Avisar por WhatsApp</a>
          <details className="mensaje-previo">
            <summary>Ver mensaje</summary>
            <p>{texto}</p>
          </details>
          <div className="modal-acciones">
            <Link to={`/clientes/${c.id}`} className="btn btn-secundario">Ver ficha</Link>
            <button className="btn btn-primario" onClick={() => navigate('/')}>Nueva venta</button>
          </div>
        </Tarjeta>
      </div>
    )
  }

  return (
    <div className="pagina pagina-angosta">
      <Link to={`/clientes/${c.id}`} className="volver">← {c.nombre} {c.apellidos}</Link>
      <h1 className="titulo">Registrar compra</h1>

      <Tarjeta className="resumen-cliente">
        <div>
          <strong>{c.nombre} {c.apellidos}</strong>
          <small>{r.puntos} puntos · vigencia {fecha(r.vigencia)}</small>
        </div>
        <NivelBadge nivel={r.nivel} />
      </Tarjeta>

      <Tarjeta>
        <form className="formulario" onSubmit={guardar}>
          <label>
            Total del ticket (ya con descuento)
            <div className="input-pesos">
              <span>$</span>
              <input type="number" inputMode="decimal" min="1" step="0.01" required autoFocus value={total} onChange={(e) => setTotal(e.target.value)} />
            </div>
          </label>
          <label>
            Número de ticket
            <input inputMode="numeric" required value={ticket} onChange={(e) => setTicket(e.target.value)} />
          </label>
          {duplicado && <p className="error">El ticket {ticket} ya está registrado en {sucursal}. Revisa el número.</p>}

          <label className="archivo">
            Foto del ticket (opcional)
            <input type="file" accept="image/*" capture="environment" onChange={(e) => setFoto(e.target.files[0]?.name ?? null)} />
            {foto && <small>📎 {foto}</small>}
          </label>

          <div className="fila-fecha">
            <span>Fecha: {cambiarFecha ? '' : 'ahora'}</span>
            {cambiarFecha ? (
              <input type="datetime-local" value={cuando} onChange={(e) => setCuando(e.target.value)} />
            ) : (
              <button type="button" className="enlace" onClick={() => setCambiarFecha(true)}>Cambiar (venta de otro día)</button>
            )}
          </div>

          <div className="previo">
            <span>Ganará</span>
            <strong>{ganara} puntos</strong>
            <small>Sucursal {sucursal} · registra {usuario.nombre.split(' ')[0]}</small>
            {sube && <small className="estado-ok">Con esta compra sube a {r.siguienteNivel}.</small>}
          </div>

          <button className="btn btn-primario btn-bloque btn-grande" disabled={monto <= 0 || !ticket.trim() || duplicado}>Guardar venta</button>
        </form>
      </Tarjeta>
    </div>
  )
}
