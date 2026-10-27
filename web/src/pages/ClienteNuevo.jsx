import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { Tarjeta } from '../components/Comunes'
import BotonImagenTarjeta from '../components/ImagenTarjeta'
import { useDatos } from '../context/Datos'
import { useSesion } from '../context/Sesion'
import { normalizarTelefono } from '../lib/formato'
import { enlaceTarjeta, enlaceWhatsApp } from '../lib/lealtad'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export default function ClienteNuevo() {
  const [params] = useSearchParams()
  const { clientes, agregarCliente } = useDatos()
  const { usuario } = useSesion()
  const navigate = useNavigate()
  const inicial = params.get('telefono') ?? ''
  const [f, setF] = useState({ nombre: '', apellidos: '', telefono: /\d/.test(inicial) ? inicial : '', dia: '', mes: '', notas: '' })
  const [creado, setCreado] = useState(null)
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const cambiar = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const tel = normalizarTelefono(f.telefono)
  const telValido = tel.length === 12
  const existente = telValido && clientes.find((c) => c.telefono === tel)

  const guardar = async (e) => {
    e.preventDefault()
    if (!telValido || existente || ocupado) return
    setOcupado(true)
    setError('')
    try {
      const nuevo = await agregarCliente(
        {
          nombre: f.nombre.trim(),
          apellidos: f.apellidos.trim(),
          telefono: tel,
          cumpleanos: f.dia && f.mes ? `${f.dia.padStart(2, '0')}/${f.mes.padStart(2, '0')}` : '—',
          notas: f.notas.trim(),
        },
        usuario.id,
      )
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
          <a className="btn btn-whatsapp btn-bloque" href={enlaceWhatsApp(creado.telefono, texto)} target="_blank" rel="noreferrer">Enviar tarjeta por WhatsApp</a>
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
          <div className="fila-2">
            <label>Nombre<input required autoFocus value={f.nombre} onChange={cambiar('nombre')} /></label>
            <label>Apellidos<input required value={f.apellidos} onChange={cambiar('apellidos')} /></label>
          </div>
          <label>
            Teléfono (WhatsApp)
            <input type="tel" inputMode="tel" required placeholder="81 1234 5678" value={f.telefono} onChange={cambiar('telefono')} />
          </label>
          {f.telefono && !telValido && <p className="error">Escribe los 10 dígitos del celular.</p>}
          {existente && (
            <p className="error">
              Ese teléfono ya es de {existente.nombre} {existente.apellidos}. <Link to={`/clientes/${existente.id}`}>Abrir su ficha</Link>
            </p>
          )}
          <fieldset className="fila-2">
            <legend>Cumpleaños</legend>
            <label>Día<input type="number" min="1" max="31" inputMode="numeric" value={f.dia} onChange={cambiar('dia')} /></label>
            <label>
              Mes
              <select value={f.mes} onChange={cambiar('mes')}>
                <option value="">—</option>
                {MESES.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
              </select>
            </label>
          </fieldset>
          <label>Notas<textarea rows="2" value={f.notas} onChange={cambiar('notas')} /></label>
          {error && <p className="error">{error}</p>}
          <button className="btn btn-primario btn-bloque btn-grande" disabled={!telValido || !!existente || ocupado}>Registrar cliente</button>
        </form>
      </Tarjeta>
    </div>
  )
}
