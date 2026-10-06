import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Marca } from '../components/Layout'
import { useDatos } from '../context/Datos'
import { useSesion } from '../context/Sesion'
import { modoDemo } from '../lib/supabase'

export default function Login() {
  const { usuarios, enviarRecuperacion } = useDatos()
  const { iniciar, entrar: entrarConCorreo } = useSesion()
  const navigate = useNavigate()
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState('')
  const [recuperar, setRecuperar] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  const entrar = (u) => {
    iniciar(u)
    navigate('/sucursal')
  }

  const enviar = async (e) => {
    e.preventDefault()
    if (modoDemo) {
      const u = usuarios.find((x) => x.correo === correo.trim().toLowerCase() && x.activa)
      if (!u || !contrasena) return setError('Correo o contraseña incorrectos.')
      return entrar(u)
    }
    setOcupado(true)
    const fallo = await entrarConCorreo(correo.trim().toLowerCase(), contrasena)
    setOcupado(false)
    if (fallo) setError(fallo)
    else navigate('/sucursal')
  }

  const recuperarContrasena = async (e) => {
    e.preventDefault()
    setOcupado(true)
    try {
      await enviarRecuperacion(correo.trim().toLowerCase())
    } catch {
      // No se dice si el correo existe; el mensaje es el mismo.
    }
    setOcupado(false)
    setEnviado(true)
  }

  return (
    <div className="pantalla-acceso">
      <div className="acceso-caja">
        <Marca />
        {!recuperar ? (
          <form onSubmit={enviar} className="formulario">
            <h1>Iniciar sesión</h1>
            <label>
              Correo
              <input type="email" autoComplete="username" value={correo} onChange={(e) => setCorreo(e.target.value)} required />
            </label>
            <label>
              Contraseña
              <input type="password" autoComplete="current-password" value={contrasena} onChange={(e) => setContrasena(e.target.value)} required />
            </label>
            {error && <p className="error">{error}</p>}
            <button className="btn btn-primario btn-bloque" type="submit" disabled={ocupado}>{ocupado ? 'Entrando…' : 'Entrar'}</button>
            <button type="button" className="enlace" onClick={() => setRecuperar(true)}>¿Olvidaste tu contraseña?</button>
          </form>
        ) : (
          <form className="formulario" onSubmit={recuperarContrasena}>
            <h1>Recuperar contraseña</h1>
            {enviado ? (
              <p className="ayuda">Si el correo está registrado, te llegará un enlace para crear una contraseña nueva. También puedes pedirle al administrador que la restablezca.</p>
            ) : (
              <label>
                Correo
                <input type="email" required value={correo} onChange={(e) => setCorreo(e.target.value)} />
              </label>
            )}
            {!enviado && <button className="btn btn-primario btn-bloque" type="submit" disabled={ocupado}>Enviar enlace</button>}
            <button type="button" className="enlace" onClick={() => { setRecuperar(false); setEnviado(false) }}>Volver</button>
          </form>
        )}

        {modoDemo && (
          <div className="demo">
            <span>Demo sin datos reales:</span>
            <button className="btn btn-secundario btn-chico" onClick={() => entrar(usuarios[1])}>Entrar como empleada</button>
            <button className="btn btn-secundario btn-chico" onClick={() => entrar(usuarios[0])}>Entrar como administrador</button>
          </div>
        )}
      </div>
    </div>
  )
}
