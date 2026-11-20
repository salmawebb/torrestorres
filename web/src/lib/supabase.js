import { createClient } from '@supabase/supabase-js'

// La página necesita VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (archivo .env.local
// o secretos de GitHub). Sin ellas no arranca: ya no hay modo demo.
const url = import.meta.env.VITE_SUPABASE_URL
const llave = import.meta.env.VITE_SUPABASE_ANON_KEY

export const configurada = Boolean(url && llave)
export const supabase = configurada ? createClient(url, llave) : null
