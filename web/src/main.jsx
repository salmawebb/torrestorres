import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { DatosProvider } from './context/Datos'
import { SesionProvider } from './context/Sesion'
import './estilos.css'

// Si GitHub Pages mandó aquí una ruta que no existe como archivo (ver 404.html),
// llega como ?ruta=/clientes/12; se pone de nuevo en la dirección.
const ruta = new URLSearchParams(window.location.search).get('ruta')
if (ruta?.startsWith('/')) window.history.replaceState(null, '', import.meta.env.BASE_URL.replace(/\/$/, '') + ruta)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <SesionProvider>
        <DatosProvider>
          <App />
        </DatosProvider>
      </SesionProvider>
    </BrowserRouter>
  </StrictMode>,
)
