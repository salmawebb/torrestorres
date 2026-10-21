import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { DatosProvider } from './context/Datos'
import { SesionProvider } from './context/Sesion'
import './estilos.css'

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
