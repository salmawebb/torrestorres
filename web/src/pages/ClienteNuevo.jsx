import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import CamposCliente, { datosCliente, formularioCliente, revisarCliente } from '../components/CamposCliente'
import { Tarjeta } from '../components/Comunes'
import BotonImagenTarjeta from '../components/ImagenTarjeta'
import { useDatos } from '../context/Datos'
import { useSesion } from '../context/Sesion'
import { enlaceTarjeta, enlaceWhatsApp } from '../lib/lealtad'

export default function ClienteNuevo() {
  const [params] = useSearchParams()
  const { clientes, agregarCliente } = useDatos()
  const { usuario } = useSesion()
  const navigate = useNavigate()
  const inicial = params.get('telefono') ?? ''
  const [f, setF] = useState(() => formularioCliente(null, /\d/.test(inicial) ? inicial : ''))
  const [creado, setCreado] = useState(null)
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const revision = revisarCliente(f, clientes)

  const guardar = async (e) => {
    e.preventDefault()
    if (!revision.valido || ocupado) return
    setOcupado(true)
    setError('')
    try {
      const nuevo = await agregarCliente(datosCliente(f, revision.tel), usuario.id)
      setCreado(nuevo)
    } catch (err) {
      setError(`No se pudo registrar: ${err.message}`)
    }
    setOcupado(false)
  }

  if (creado) {
    const enlace = enlaceTarjeta(creado.token)
    const texto = `Hola ${creado.nombre}, ¡bienvenida al programa de lealtad de Joyería Torres Torres! Con cada compra ganas puntos. Consulta tu tarjeta aquí: ${enlace}`
    return (
      <div className="pagina pagina-angosta">
        <Tarjeta className="exito">
          <div className="exito-icono" aria-hidden="true">✓</div>
          <h1>Cliente registrado</h1>
          <p>{creado.nombre} {creado.apellidos} · #{creado.id}</p>
          <div className="qr-chico"><QRCodeSVG value={enlace} size={140} /></div>
          {creado.telefono ? (
            <a className="btn btn-whatsapp btn-bloque" href={enlaceWhatsApp(creado.telefono, texto)} target="_blank" rel="noreferrer">Enviar tarjeta por WhatsApp</a>
          ) : (
            <p className="ayuda">Sin teléfono: puedes darle la tarjeta con el QR o la imagen.</p>
          )}
          <BotonImagenTarjeta nombre={creado.nombre} enlace={enlace} className="btn btn-secundario btn-bloque" />
          <div className="modal-acciones">
            <Link to={`/clientes/${creado.id}`} className="btn btn-secundario">Ver ficha</Link>
            <button className="btn btn-primario" onClick={() => navigate(`/clientes/${creado.id}/compra`)}>Seguir con la venta</button>
          </div>
        </Tarjeta>
      </div>
    )
  }

  return (
    <div className="pagina pagina-angosta">
      <Link to="/" className="volver">← Inicio</Link>
      <h1 className="titulo">Cliente nuevo</h1>
      <Tarjeta>
        <form className="formulario" onSubmit={guardar}>
          <CamposCliente f={f} setF={setF} revision={revision} autoFocus />
          {error && <p className="error">{error}</p>}
          <button className="btn btn-primario btn-bloque btn-grande" disabled={!revision.valido || ocupado}>Registrar cliente</button>
        </form>
      </Tarjeta>
    </div>
  )
}
