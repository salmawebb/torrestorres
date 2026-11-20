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

// Verificación en dos pasos (solo administradoras): además de la contraseña,
// el código de 6 números de su app autenticadora. `dosPasos` es null cuando
// ya no falta nada; { tipo: 'activar' } la primera vez (escanea el QR) y
// { tipo: 'codigo' } en cada entrada. Mientras falte, `usuario` es null y la
// base de datos no le deja ver nada (migración dos_pasos_admin).
const EMISOR = 'Joyería Torres Torres'

const extras = (usuario, empleada) => ({
  esAdmin: usuario?.rol === 'admin',
  esCelular: usuario?.rol === 'sucursal',
  quien: usuario?.rol === 'sucursal' ? empleada : usuario,
})

export function SesionProvider({ children }) {
  return <SesionSupabase>{children}</SesionSupabase>
}

function SesionSupabase({ children }) {
  const [cuenta, setCuenta] = useState(null)
  const [dosPasos, setDosPasos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const usuario = dosPasos ? null : cuenta
  const [sucursal, setSucursal] = useState(() => leer().sucursal ?? null)
  const [empleada, setEmpleada] = useState(() => leer().empleada ?? null)

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_evento, sesion) => {
      const id = sesion?.user?.id
      if (!id) {
        setCuenta(null)
        setDosPasos(null)
        setCargando(false)
        return
      }
      // Fuera del callback: Supabase no permite otras llamadas dentro de él.
      setTimeout(async () => {
        const { data: perfil } = await supabase.from('perfiles').select('id, nombre, correo, rol, activa').eq('id', id).maybeSingle()
        if (!perfil?.activa) {
          await supabase.auth.signOut()
          setCuenta(null)
          setDosPasos(null)
        } else {
          setDosPasos(perfil.rol === 'admin' ? await faltaDosPasos() : null)
          setCuenta(perfil)
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
    dosPasos,
    cuentaPendiente: dosPasos ? cuenta : null,
    // Primera vez: da de alta la app autenticadora y regresa lo que va en el QR.
    async prepararDosPasos() {
      // Un intento anterior que no se terminó estorbaría al crear uno nuevo.
      const { data: antes } = await supabase.auth.mfa.listFactors()
      for (const f of antes?.all ?? []) {
        if (f.factor_type === 'totp' && f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id })
      }
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', issuer: EMISOR, friendlyName: 'App autenticadora' })
      if (error) throw new Error(error.message)
      setDosPasos({ tipo: 'activar', factorId: data.id })
      return { uri: data.totp.uri, secreto: data.totp.secret, factorId: data.id }
    },
    async verificarCodigo(codigo, factorId = dosPasos?.factorId) {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: codigo })
      if (error) return 'El código no es correcto o ya cambió. Escribe el que se ve ahora en la app.'
      // Supabase avisa el cambio de sesión y se vuelve a revisar el perfil.
      return null
    },
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

// Qué le falta a una administradora con solo la contraseña.
async function faltaDosPasos() {
  const { data: nivel } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (nivel?.currentLevel === 'aal2') return null
  const { data } = await supabase.auth.mfa.listFactors()
  const activa = data?.totp?.find((f) => f.status === 'verified')
  return activa ? { tipo: 'codigo', factorId: activa.id } : { tipo: 'activar' }
}

// eslint-disable-next-line react-refresh/only-export-components
export const useSesion = () => useContext(SesionContext)
