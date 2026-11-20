import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const SesionContext = createContext(null)

// La sucursal y la empleada elegidas se guardan en sessionStorage para que no
// se pierdan al recargar la página.
//
// Cada sucursal entra con una cuenta compartida (rol "sucursal") desde su
// celular, porque ahí vive el WhatsApp Business. Después de la sucursal se
// elige "¿Qué empleada eres?"; esa empleada es `quien` y a su nombre quedan
// las ventas. Las administradoras son ellas mismas y no eligen.
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

const extras = (usuario, empleada) => ({
  esAdmin: usuario?.rol === 'admin',
  esCelular: usuario?.rol === 'sucursal',
  quien: usuario?.rol === 'sucursal' ? empleada : usuario,
})

export function SesionProvider({ children }) {
  return <SesionSupabase>{children}</SesionSupabase>
}

function SesionSupabase({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [sucursal, setSucursal] = useState(() => leer().sucursal ?? null)
  const [empleada, setEmpleada] = useState(() => leer().empleada ?? null)

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
    guardar({ sucursal: s, empleada })
  }
  const elegirEmpleada = (e) => {
    const elegida = e && { id: e.id, nombre: e.nombre }
    setEmpleada(elegida)
    guardar({ sucursal, empleada: elegida })
  }
  const olvidar = () => {
    setSucursal(null)
    setEmpleada(null)
    guardar({})
  }

  const valor = {
    usuario,
    sucursal,
    empleada,
    ...extras(usuario, empleada),
    cargando,
    async entrar(correo, contrasena) {
      const { data, error } = await supabase.auth.signInWithPassword({ email: correo, password: contrasena })
      if (error) return 'El correo, el usuario o la contraseña no son correctos.'
      const { data: perfil } = await supabase.from('perfiles').select('activa').eq('id', data.user.id).maybeSingle()
      if (!perfil?.activa) return 'Tu cuenta está desactivada. Habla con el administrador.'
      olvidar()
      return null
    },
    elegirSucursal,
    elegirEmpleada,
    async salir() {
      olvidar()
      await supabase.auth.signOut()
    },
  }
  return <SesionContext.Provider value={valor}>{children}</SesionContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useSesion = () => useContext(SesionContext)
