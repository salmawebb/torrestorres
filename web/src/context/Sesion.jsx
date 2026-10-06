import { createContext, useContext, useState } from 'react'

const SesionContext = createContext(null)

// Mientras no hay login real, la sesión se guarda en sessionStorage para
// que no se pierda al recargar la página.
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
  const [sesion, setSesion] = useState(leer)
  const cambiar = (s) => {
    setSesion(s)
    guardar(s)
  }
  const { usuario = null, sucursal = null } = sesion

  const valor = {
    usuario,
    sucursal,
    esAdmin: usuario?.rol === 'admin',
    iniciar: (u) => cambiar({ usuario: u, sucursal: null }),
    elegirSucursal: (s) => cambiar({ usuario, sucursal: s }),
    salir: () => cambiar({}),
  }
  return <SesionContext.Provider value={valor}>{children}</SesionContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useSesion = () => useContext(SesionContext)
