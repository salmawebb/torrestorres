import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { DatosProvider } from './context/Datos'
import { SesionProvider } from './context/Sesion'
import './estilos.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <DatosProvider>
        <SesionProvider>
          <App />
        </SesionProvider>
      </DatosProvider>
    </BrowserRouter>
  </StrictMode>,
)
