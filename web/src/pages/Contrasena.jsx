import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Marca } from '../components/Layout'
import { supabase } from '../lib/supabase'

// Llegan aquí el enlace de invitación de una cuenta nueva y el de
// "olvidé mi contraseña". Supabase abre la sesión con el enlace del correo.
export default function Contrasena() {
  const navigate = useNavigate()
  const [conSesion, setConSesion] = useState(supabase ? null : false)
  const [contrasena, setContrasena] = useState('')
  const [repetir, setRepetir] = useState('')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setConSesion(!!data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, sesion) => setConSesion(!!sesion))
    return () => data.subscription.unsubscribe()
  }, [])

  const guardar = async (e) => {
    e.preventDefault()
    if (contrasena.length < 8) return setError('Usa al menos 8 caracteres.')
    if (contrasena !== repetir) return setError('Las contraseñas no coinciden.')
    setOcupado(true)
    const { error: fallo } = await supabase.auth.updateUser({ password: contrasena })
    setOcupado(false)
    if (fallo) return setError('No se pudo guardar. Pide un enlace nuevo.')
    navigate('/sucursal')
  }

  return (
    <div className="pantalla-acceso">
      <div className="acceso-caja">
        <Marca />
        {conSesion === false ? (
          <>
            <h1>Enlace vencido</h1>
            <p className="ayuda">Este enlace ya no es válido. Pide uno nuevo desde "¿Olvidaste tu contraseña?" o al administrador.</p>
            <button className="btn btn-primario btn-bloque" onClick={() => navigate('/login')}>Ir a iniciar sesión</button>
          </>
        ) : (
          <form className="formulario" onSubmit={guardar}>
            <h1>Crea tu contraseña</h1>
            <label>
              Contraseña nueva
              <input type="password" autoComplete="new-password" required value={contrasena} onChange={(e) => setContrasena(e.target.value)} />
            </label>
            <label>
              Repite la contraseña
              <input type="password" autoComplete="new-password" required value={repetir} onChange={(e) => setRepetir(e.target.value)} />
            </label>
            {error && <p className="error">{error}</p>}
            <button className="btn btn-primario btn-bloque" disabled={ocupado || !conSesion}>Guardar y entrar</button>
          </form>
        )}
      </div>
    </div>
  )
}
