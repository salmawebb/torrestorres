import { createClient } from '@supabase/supabase-js'

// Con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (archivo .env.local) la página
// usa la base de datos real. Sin ellas funciona en modo demo con datos de ejemplo.
const url = import.meta.env.VITE_SUPABASE_URL
const llave = import.meta.env.VITE_SUPABASE_ANON_KEY

// Aunque haya base real, se puede abrir la demostración (para enseñarla a un
// cliente) con el botón "Ver demostración" o con ?demo en la dirección.
// Queda activa en esa pestaña hasta salir; nunca toca la base real.
const CLAVE_DEMO = 'torres-demo'

function pideDemo() {
  try {
    if (new URLSearchParams(window.location.search).has('demo')) sessionStorage.setItem(CLAVE_DEMO, '1')
    return sessionStorage.getItem(CLAVE_DEMO) === '1'
  } catch {
    return false
  }
}

export const hayBaseReal = !!(url && llave)
export const supabase = hayBaseReal ? createClient(url, llave) : null
export const modoDemo = !hayBaseReal || pideDemo()

// Entra o sale de la demostración y vuelve a cargar la página desde el inicio.
export function cambiarDemo(activar) {
  try {
    if (activar) sessionStorage.setItem(CLAVE_DEMO, '1')
    else sessionStorage.removeItem(CLAVE_DEMO)
  } catch {
    // Sin sessionStorage la demo solo funciona con ?demo en la dirección.
  }
  window.location.href = import.meta.env.BASE_URL + (activar ? 'login?demo' : 'login')
}
