import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Layout, { Marca } from './components/Layout'
import { useDatos } from './context/Datos'
import { useSesion } from './context/Sesion'
import Administracion from './pages/Administracion'
import Canjes from './pages/Canjes'
import ClienteFicha from './pages/ClienteFicha'
import ClienteNuevo from './pages/ClienteNuevo'
import Contrasena from './pages/Contrasena'
import Clientes from './pages/Clientes'
import ElegirSucursal from './pages/ElegirSucursal'
import Empleadas from './pages/Empleadas'
import InicioAdmin from './pages/InicioAdmin'
import InicioEmpleada from './pages/InicioEmpleada'
import Login from './pages/Login'
import RegistrarCompra from './pages/RegistrarCompra'
import Reportes from './pages/Reportes'
import TarjetaCliente from './pages/Tarjeta'
import Ventas from './pages/Ventas'

function Protegida({ children, admin }) {
  const { usuario, sucursal, esAdmin } = useSesion()
  if (!usuario) return <Navigate to="/login" replace />
  if (!sucursal) return <Navigate to="/sucursal" replace />
  if (admin && !esAdmin) return <Navigate to="/" replace />
  return children
}

function Espera({ children }) {
  return (
    <div className="pantalla-acceso">
      <div className="acceso-caja">
        <Marca />
        {children}
      </div>
    </div>
  )
}

export default function App() {
  const { usuario, esAdmin, cargando: entrando } = useSesion()
  const { cargando, error } = useDatos()
  const { pathname } = useLocation()
  const publica = /^\/(tarjeta|contrasena)\b/.test(pathname)
  if (!publica && (entrando || cargando)) return <Espera><p className="ayuda">Cargando…</p></Espera>
  if (!publica && error) {
    return (
      <Espera>
        <p className="error">No se pudieron cargar los datos: {error}</p>
        <button className="btn btn-primario btn-bloque" onClick={() => window.location.reload()}>Intentar de nuevo</button>
      </Espera>
    )
  }
  return (
    <Routes>
      <Route path="/login" element={usuario ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/sucursal" element={usuario ? <ElegirSucursal /> : <Navigate to="/login" replace />} />
      <Route path="/tarjeta/:token" element={<TarjetaCliente />} />
      <Route path="/contrasena" element={<Contrasena />} />
      <Route element={<Protegida><Layout /></Protegida>}>
        <Route index element={esAdmin ? <InicioAdmin /> : <InicioEmpleada />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="clientes/nuevo" element={<ClienteNuevo />} />
        <Route path="clientes/:id" element={<ClienteFicha />} />
        <Route path="clientes/:id/compra" element={<RegistrarCompra />} />
        <Route path="ventas" element={<Ventas />} />
        <Route path="canjes" element={<Canjes />} />
        <Route path="empleadas" element={<Protegida admin><Empleadas /></Protegida>} />
        <Route path="reportes" element={<Protegida admin><Reportes /></Protegida>} />
        <Route path="administracion" element={<Protegida admin><Administracion /></Protegida>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
