import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Marca } from '../components/Layout'
import { useDatos } from '../context/Datos'
import { useSesion } from '../context/Sesion'

export default function Login() {
  const { usuarios } = useDatos()
  const { iniciar } = useSesion()
  const navigate = useNavigate()
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState('')
  const [recuperar, setRecuperar] = useState(false)
  const [enviado, setEnviado] = useState(false)

  const entrar = (u) => {
    iniciar(u)
    navigate('/sucursal')
  }

  const enviar = (e) => {
    e.preventDefault()
    const u = usuarios.find((x) => x.correo === correo.trim().toLowerCase() && x.activa)
    if (!u || !contrasena) return setError('Correo o contraseña incorrectos.')
    entrar(u)
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
            <button className="btn btn-primario btn-bloque" type="submit">Entrar</button>
            <button type="button" className="enlace" onClick={() => setRecuperar(true)}>¿Olvidaste tu contraseña?</button>
          </form>
        ) : (
          <form className="formulario" onSubmit={(e) => { e.preventDefault(); setEnviado(true) }}>
            <h1>Recuperar contraseña</h1>
            {enviado ? (
              <p className="ayuda">Si el correo está registrado, te llegará un enlace para crear una contraseña nueva. También puedes pedirle al administrador que la restablezca.</p>
            ) : (
              <label>
                Correo
                <input type="email" required value={correo} onChange={(e) => setCorreo(e.target.value)} />
              </label>
            )}
            {!enviado && <button className="btn btn-primario btn-bloque" type="submit">Enviar enlace</button>}
            <button type="button" className="enlace" onClick={() => { setRecuperar(false); setEnviado(false) }}>Volver</button>
          </form>
        )}

        <div className="demo">
          <span>Demo sin datos reales:</span>
          <button className="btn btn-secundario btn-chico" onClick={() => entrar(usuarios[1])}>Entrar como empleada</button>
          <button className="btn btn-secundario btn-chico" onClick={() => entrar(usuarios[0])}>Entrar como administrador</button>
        </div>
      </div>
    </div>
  )
}
