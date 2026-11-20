import { Navigate, useNavigate } from 'react-router-dom'
import { Marca } from '../components/Layout'
import { useDatos } from '../context/Datos'
import { useSesion } from '../context/Sesion'

// Segundo paso en el celular de la sucursal: quién lo está usando. Las ventas
// que registre quedan a su nombre (se puede cambiar en cada venta).
export default function ElegirEmpleada() {
  const { sucursal, esCelular, empleada, elegirEmpleada, salir } = useSesion()
  const { usuarios } = useDatos()
  const navigate = useNavigate()
  const empleadas = usuarios.filter((u) => u.rol === 'empleada' && u.activa)
  if (!sucursal) return <Navigate to="/sucursal" replace />
  if (!esCelular) return <Navigate to="/" replace />
  const elegir = (u) => {
    elegirEmpleada(u)
    navigate('/')
  }
  return (
    <div className="pantalla-acceso">
      <div className="acceso-caja">
        <Marca />
        <h1>¿Qué empleada eres?</h1>
        <p className="ayuda">Sucursal {sucursal}. Toca tu nombre: las ventas que registres quedarán a tu nombre.</p>
        {empleadas.length ? (
          <div className="lista-sucursales">
            {empleadas.map((u) => (
              <button key={u.id} className={`btn-sucursal ${u.id === empleada?.id ? 'activa' : ''}`} onClick={() => elegir(u)}>
                <span aria-hidden="true">👤</span> {u.nombre}
              </button>
            ))}
          </div>
        ) : (
          <p className="error">Todavía no hay empleadas dadas de alta. Pídele al administrador que las agregue en Administración › Usuarios.</p>
        )}
        <button className="enlace" onClick={() => navigate('/sucursal')}>Cambiar sucursal</button>
        <button className="enlace" onClick={salir}>Cerrar sesión</button>
      </div>
    </div>
  )
}
