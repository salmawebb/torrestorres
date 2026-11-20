import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { DatosProvider } from './context/Datos'
import { SesionProvider } from './context/Sesion'
import { configurada } from './lib/supabase'
import './estilos.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {configurada ? (
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <SesionProvider>
          <DatosProvider>
            <App />
          </DatosProvider>
        </SesionProvider>
      </BrowserRouter>
    ) : (
      // Sin las llaves de Supabase no hay datos que mostrar.
      <p style={{ padding: 24 }}>Falta configurar la conexión con la base de datos (VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY).</p>
    )}
  </StrictMode>,
)
