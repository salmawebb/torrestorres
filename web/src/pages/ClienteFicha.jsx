import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Aviso, Dato, Modal, NivelBadge, Tarjeta, useAviso, Vacio } from '../components/Comunes'
import { useDatos } from '../context/Datos'
import { useSesion } from '../context/Sesion'
import { fecha, pesos, telefono } from '../lib/formato'
import { enlaceTarjeta, enlaceWhatsApp, mensajeWhatsApp } from '../lib/lealtad'

export default function ClienteFicha() {
  const { id } = useParams()
  const { clientes, compras, canjes, resumenes, reglas, usuarios, agregarCanje, regenerarToken, cancelarCompra } = useDatos()
  const { usuario, sucursal, esAdmin } = useSesion()
  const [canjeando, setCanjeando] = useState(false)
  const [regenerando, setRegenerando] = useState(false)
  const [cancelando, setCancelando] = useState(null)
  const [aviso, setAviso, cerrarAviso] = useAviso()
  const [pestana, setPestana] = useState('compras')

  const c = clientes.find((x) => String(x.id) === id)
  if (!c) return <Vacio>No se encontró el cliente.</Vacio>
  const r = resumenes[c.id]
  const susCompras = compras.filter((v) => v.clienteId === c.id).sort((a, b) => b.fecha - a.fecha)
  const susCanjes = canjes.filter((v) => v.clienteId === c.id).sort((a, b) => b.fecha - a.fecha)
  const nombreEmpleada = (uid) => usuarios.find((u) => u.id === uid)?.nombre.split(' ')[0] ?? '—'
  const whatsapp = enlaceWhatsApp(
    c.telefono,
    mensajeWhatsApp({ nombre: c.nombre, puntos: r.puntos, nivel: r.nivel, vigencia: r.vigencia, enlace: enlaceTarjeta(c.token) }),
  )

  return (
    <div className="pagina">
      <Link to="/clientes" className="volver">← Clientes</Link>

      <Tarjeta className="ficha">
        <div className="ficha-encabezado">
          <div>
            <h1>{c.nombre} {c.apellidos}</h1>
            <p className="ficha-meta">
              #{c.id} · {telefono(c.telefono)} · 🎂 {c.cumpleanos}
            </p>
          </div>
          <NivelBadge nivel={r.nivel} />
        </div>

        <div className="ficha-puntos">
          <Dato etiqueta="Puntos disponibles" valor={r.puntos} detalle={`= ${pesos(r.pesosCanje)} para canjear`} />
          <Dato etiqueta="Vigencia" valor={fecha(r.vigencia)} detalle={r.vigencia ? 'Se renueva con cada compra' : 'Sin puntos vigentes'} />
          <Dato
            etiqueta="Compra acumulada"
            valor={pesos(r.acumulado)}
            detalle={r.siguienteNivel ? `Faltan ${pesos(r.faltaParaSiguiente)} para ${r.siguienteNivel}` : 'Nivel máximo'}
          />
        </div>

        {r.puedeCanjear ? (
          <p className="estado-ok">✓ Ya puede canjear sus puntos.</p>
        ) : (
          <p className="estado-pendiente">Le faltan {reglas.minimoCanje - r.puntos} puntos para poder canjear.</p>
        )}

        <div className="ficha-acciones">
          <Link to={`/clientes/${c.id}/compra`} className="btn btn-primario">Registrar compra</Link>
          <button className="btn btn-secundario" disabled={!r.puedeCanjear} onClick={() => setCanjeando(true)}>Canjear puntos</button>
          <a className="btn btn-whatsapp" href={whatsapp} target="_blank" rel="noreferrer">Enviar por WhatsApp</a>
        </div>

        <div className="ficha-tarjeta">
          <Link to={`/tarjeta/${c.token}`} target="_blank">Ver tarjeta del cliente ↗</Link>
          <button className="enlace" onClick={() => setRegenerando(true)}>Generar QR nuevo</button>
        </div>
        {c.notas && <p className="ficha-notas">📝 {c.notas}</p>}
      </Tarjeta>

      <div className="pestanas" role="tablist">
        <button role="tab" aria-selected={pestana === 'compras'} onClick={() => setPestana('compras')}>Compras ({susCompras.length})</button>
        <button role="tab" aria-selected={pestana === 'canjes'} onClick={() => setPestana('canjes')}>Canjes ({susCanjes.length})</button>
      </div>

      {pestana === 'compras' ? (
        <Tarjeta>
          {susCompras.length ? (
            <div className="tabla-envoltura">
              <table className="tabla">
                <thead>
                  <tr><th>Fecha</th><th>Sucursal</th><th>Ticket</th><th className="num">Total</th><th className="num">Puntos</th><th>Registró</th>{esAdmin && <th />}</tr>
                </thead>
                <tbody>
                  {susCompras.map((v) => (
                    <tr key={v.id} className={v.cancelada ? 'cancelada' : ''}>
                      <td>{fecha(v.fecha)}</td>
                      <td>{v.sucursal}</td>
                      <td>{v.ticket}</td>
                      <td className="num">{pesos(v.total)}</td>
                      <td className="num">{v.cancelada ? 'Cancelada' : `+${r.puntosPorCompraId[v.id]?.puntos ?? 0}`}</td>
                      <td>{nombreEmpleada(v.empleadaId)}</td>
                      {esAdmin && (
                        <td>{!v.cancelada && <button className="enlace peligro" onClick={() => setCancelando(v)}>Cancelar</button>}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Vacio>Sin compras registradas.</Vacio>
          )}
        </Tarjeta>
      ) : (
        <Tarjeta>
          {susCanjes.length ? (
            <ul className="lista-simple">
              {susCanjes.map((v) => (
                <li key={v.id}>
                  <span className="lista-hora">{fecha(v.fecha)}</span>
                  <span>{v.puntos} puntos · {v.sucursal}</span>
                  <span className="lista-monto">−{pesos(v.pesos)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Vacio>Sin canjes.</Vacio>
          )}
        </Tarjeta>
      )}

      <ModalCanje
        abierto={canjeando}
        disponibles={r.puntos}
        reglas={reglas}
        onCerrar={() => setCanjeando(false)}
        onCanjear={(puntos) => {
          agregarCanje({ clienteId: c.id, fecha: new Date(), sucursal, puntos, pesos: puntos * reglas.valorPunto, empleadaId: usuario.id })
          setCanjeando(false)
          setAviso(`Canje registrado: ${puntos} puntos = ${pesos(puntos * reglas.valorPunto)} de descuento.`)
        }}
      />

      <Modal abierto={regenerando} titulo="Generar QR nuevo" onCerrar={() => setRegenerando(false)}>
        <p>El QR que tiene el cliente dejará de funcionar al instante. Úsalo si perdió su celular o compartió su tarjeta por error. Después mándale la tarjeta nueva por WhatsApp.</p>
        <div className="modal-acciones">
          <button className="btn btn-secundario" onClick={() => setRegenerando(false)}>No, dejarlo</button>
          <button className="btn btn-primario" onClick={() => { regenerarToken(c.id); setRegenerando(false); setAviso('Se generó un QR nuevo.') }}>Generar QR nuevo</button>
        </div>
      </Modal>

      <Modal abierto={!!cancelando} titulo="Cancelar venta" onCerrar={() => setCancelando(null)}>
        {cancelando && (
          <>
            <p>Ticket <strong>{cancelando.ticket}</strong> de {cancelando.sucursal}, {fecha(cancelando.fecha)}, por {pesos(cancelando.total)}.</p>
            <p className="ayuda">Solo para errores de captura. Los puntos y el nivel del cliente se recalculan solos.</p>
            <div className="modal-acciones">
              <button className="btn btn-secundario" onClick={() => setCancelando(null)}>No cancelar</button>
              <button className="btn btn-peligro" onClick={() => { cancelarCompra(cancelando.id); setCancelando(null); setAviso('Venta cancelada.') }}>Cancelar venta</button>
            </div>
          </>
        )}
      </Modal>

      <Aviso mensaje={aviso} onCerrar={cerrarAviso} />
    </div>
  )
}

function ModalCanje({ abierto, disponibles, reglas, onCerrar, onCanjear }) {
  const [puntos, setPuntos] = useState(reglas.minimoCanje)
  const valido = puntos >= reglas.minimoCanje && puntos <= disponibles
  return (
    <Modal abierto={abierto} titulo="Canjear puntos" onCerrar={onCerrar}>
      <form className="formulario" onSubmit={(e) => { e.preventDefault(); if (valido) onCanjear(puntos) }}>
        <label>
          Puntos a canjear (tiene {disponibles})
          <input type="number" inputMode="numeric" min={reglas.minimoCanje} max={disponibles} value={puntos} onChange={(e) => setPuntos(Number(e.target.value))} />
        </label>
        <button type="button" className="enlace" onClick={() => setPuntos(disponibles)}>Usar todos</button>
        <p className="resaltado">Descuento: <strong>{pesos(Math.max(puntos, 0) * reglas.valorPunto)}</strong></p>
        {!valido && <p className="error">Debe ser entre {reglas.minimoCanje} y {disponibles} puntos.</p>}
        <button className="btn btn-primario btn-bloque" disabled={!valido}>Confirmar canje</button>
      </form>
    </Modal>
  )
}
