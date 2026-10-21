import { createClient } from '@supabase/supabase-js'

// Con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (archivo .env.local) la página
// usa la base de datos real. Sin ellas funciona en modo demo con datos de ejemplo.
const url = import.meta.env.VITE_SUPABASE_URL
const llave = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = url && llave ? createClient(url, llave) : null
export const modoDemo = !supabase
