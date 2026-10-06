import { createContext, useContext, useEffect, useState } from 'react'
import { modoDemo, supabase } from '../lib/supabase'

const SesionContext = createContext(null)

// La sucursal elegida se guarda en sessionStorage para que no se pierda al
// recargar la página. En modo demo también el usuario.
const leer = () => {
  try {
    return JSON.parse(sessionStorage.getItem('sesion')) ?? {}
  } catch {
    return {}
  }
}
const guardar = (s) => {
  try {
    sessionStorage.setItem('sesion', JSON.stringify(s))
  } catch {
    // sin almacenamiento: la sesión dura hasta recargar
  }
}

export function SesionProvider({ children }) {
  return modoDemo ? <SesionDemo>{children}</SesionDemo> : <SesionSupabase>{children}</SesionSupabase>
}

function SesionDemo({ children }) {
  const [sesion, setSesion] = useState(leer)
  const cambiar = (s) => {
    setSesion(s)
    guardar(s)
  }
  const { usuario = null, sucursal = null } = sesion

  const valor = {
    usuario,
    sucursal,
    cargando: false,
    esAdmin: usuario?.rol === 'admin',
    iniciar: (u) => cambiar({ usuario: u, sucursal: null }),
    entrar: async () => 'Correo o contraseña incorrectos.',
    elegirSucursal: (s) => cambiar({ usuario, sucursal: s }),
    salir: () => cambiar({}),
  }
  return <SesionContext.Provider value={valor}>{children}</SesionContext.Provider>
}

function SesionSupabase({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [sucursal, setSucursal] = useState(() => leer().sucursal ?? null)

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_evento, sesion) => {
      const id = sesion?.user?.id
      if (!id) {
        setUsuario(null)
        setCargando(false)
        return
      }
      // Fuera del callback: Supabase no permite otras llamadas dentro de él.
      setTimeout(async () => {
        const { data: perfil } = await supabase.from('perfiles').select('id, nombre, correo, rol, activa').eq('id', id).maybeSingle()
        if (!perfil?.activa) {
          await supabase.auth.signOut()
          setUsuario(null)
        } else {
          setUsuario(perfil)
        }
        setCargando(false)
      }, 0)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const elegirSucursal = (s) => {
    setSucursal(s)
    guardar({ sucursal: s })
  }

  const valor = {
    usuario,
    sucursal,
    cargando,
    esAdmin: usuario?.rol === 'admin',
    async entrar(correo, contrasena) {
      const { data, error } = await supabase.auth.signInWithPassword({ email: correo, password: contrasena })
      if (error) return 'Correo o contraseña incorrectos.'
      const { data: perfil } = await supabase.from('perfiles').select('activa').eq('id', data.user.id).maybeSingle()
      if (!perfil?.activa) return 'Tu cuenta está desactivada. Habla con el administrador.'
      elegirSucursal(null)
      return null
    },
    elegirSucursal,
    async salir() {
      elegirSucursal(null)
      await supabase.auth.signOut()
    },
  }
  return <SesionContext.Provider value={valor}>{children}</SesionContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useSesion = () => useContext(SesionContext)
