import { useNavigate } from 'react-router-dom'
import { Marca } from '../components/Layout'
import { useDatos } from '../context/Datos'
import { useSesion } from '../context/Sesion'

export default function ElegirSucursal() {
  const { usuario, sucursal, elegirSucursal, salir } = useSesion()
  const { sucursales } = useDatos()
  const navigate = useNavigate()
  const elegir = (s) => {
    elegirSucursal(s)
    navigate('/')
  }
  return (
    <div className="pantalla-acceso">
      <div className="acceso-caja">
        <Marca />
        <h1>Hola, {usuario.nombre.split(' ')[0]}</h1>
        <p className="ayuda">¿En qué sucursal estás hoy? Las ventas que registres quedarán en esa sucursal.</p>
        <div className="lista-sucursales">
          {sucursales.map((s) => (
            <button key={s} className={`btn-sucursal ${s === sucursal ? 'activa' : ''}`} onClick={() => elegir(s)}>
              <span aria-hidden="true">📍</span> {s}
            </button>
          ))}
        </div>
        <button className="enlace" onClick={salir}>Cerrar sesión</button>
      </div>
    </div>
  )
}
