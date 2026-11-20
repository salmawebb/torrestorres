import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useState } from 'react'
import { Marca } from '../components/Layout'
import { useSesion } from '../context/Sesion'

// Verificación en dos pasos de las administradoras: la primera vez se escanea
// un QR con Google Authenticator o Microsoft Authenticator; después, en cada
// entrada se escribe el código de 6 números que muestra la app.
export default function DosPasos() {
  const { dosPasos, cuentaPendiente, prepararDosPasos, verificarCodigo, salir } = useSesion()
  const activar = dosPasos?.tipo === 'activar'
  const [alta, setAlta] = useState(null)
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [verClave, setVerClave] = useState(false)

  useEffect(() => {
    if (!activar || alta) return
    prepararDosPasos()
      .then(setAlta)
      .catch((e) => setError(`No se pudo preparar el QR: ${e.message}`))
    // Solo una vez al abrir la pantalla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activar])

  const enviar = async (e) => {
    e.preventDefault()
    setOcupado(true)
    setError('')
    const fallo = await verificarCodigo(codigo.replace(/\s/g, ''), alta?.factorId)
    setOcupado(false)
    if (fallo) {
      setError(fallo)
      setCodigo('')
    }
  }

  return (
    <div className="pantalla-acceso">
      <div className="acceso-caja">
        <Marca />
        <form className="formulario" onSubmit={enviar}>
          <h1>Verificación en dos pasos</h1>
          {activar ? (
            <>
              <p className="ayuda">
                Las cuentas de administradora piden, además de la contraseña, un código de tu celular. Se activa una sola vez:
              </p>
              <ol className="pasos-lista">
                <li>Instala en tu celular <strong>Google Authenticator</strong> o <strong>Microsoft Authenticator</strong> (gratis).</li>
                <li>En la app toca <strong>+</strong> y escanea este código:</li>
              </ol>
              <div className="qr-dos-pasos">
                {alta ? <QRCodeSVG value={alta.uri} size={180} fgColor="#111111" /> : <span className="ayuda">Preparando…</span>}
              </div>
              {alta && (
                verClave
                  ? <p className="ayuda clave-dos-pasos">Clave para escribirla a mano: <strong>{alta.secreto}</strong></p>
                  : <button type="button" className="enlace" onClick={() => setVerClave(true)}>¿No puedes escanear? Ver la clave</button>
              )}
              <ol className="pasos-lista" start={3}>
                <li>Escribe aquí el código de 6 números que aparece en la app:</li>
              </ol>
            </>
          ) : (
            <p className="ayuda">
              Abre tu app autenticadora (Google o Microsoft Authenticator) y escribe el código de 6 números de <strong>Joyería Torres Torres</strong>.
            </p>
          )}
          <label>
            Código
            <input
              className="codigo-dos-pasos"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]{6,7}"
              maxLength={7}
              required
              autoFocus={!activar}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="btn btn-primario btn-bloque" type="submit" disabled={ocupado || (activar && !alta)}>
            {ocupado ? 'Revisando…' : activar ? 'Activar y entrar' : 'Entrar'}
          </button>
          <p className="ayuda">
            {cuentaPendiente?.nombre && <>Cuenta: {cuentaPendiente.nombre}. </>}
            ¿Perdiste o cambiaste tu celular? Pídele a otra administradora que te quite la verificación en Administración › Usuarios y vuelve a entrar.
          </p>
          <button type="button" className="enlace" onClick={salir}>Salir</button>
        </form>
      </div>
    </div>
  )
}
