import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useSesion } from '../context/Sesion'
import logo from '../assets/logo-torres-torres.jpg'
import logoHorizontal from '../assets/logo-horizontal.jpg'
import logoClaro from '../assets/logo-torres-torres-claro.png'

const MENU = [
  { a: '/', texto: 'Inicio', icono: '⌂', fin: true },
  { a: '/clientes', texto: 'Clientes', icono: '☺' },
  { a: '/ventas', texto: 'Ventas', icono: '▤' },
  { a: '/canjes', texto: 'Canjes', icono: '★' },
  { a: '/empleadas', texto: 'Empleadas', icono: '◉', admin: true },
  { a: '/reportes', texto: 'Reportes', icono: '▲', admin: true },
  { a: '/administracion', texto: 'Administración', icono: '⚙', admin: true },
]

// Logo oficial de la joyería. En la barra negra va la versión horizontal
// (torre · TORRES TORRES · torre) para que se lea en poco espacio; en la tarjeta
// del cliente, el original chico; en las pantallas de acceso, sin fondo.
export function Marca({ chica, original }) {
  const src = chica ? logoHorizontal : original ? logo : logoClaro
  const clase = chica ? 'marca-chica' : original ? 'marca-original' : ''
  return (
    <div className={`marca ${clase}`}>
      <img src={src} alt="Torres Torres · Joyería y Relojería" />
    </div>
  )
}

export default function Layout() {
  const { usuario, sucursal, esAdmin, salir } = useSesion()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const navigate = useNavigate()
  const opciones = MENU.filter((m) => !m.admin || esAdmin)

  return (
    <div className="app">
      <header className="barra">
        <button className="btn-icono solo-movil" onClick={() => setMenuAbierto(true)} aria-label="Abrir menú">☰</button>
        <Marca chica />
        <div className="barra-derecha">
          <button className="chip-sucursal" onClick={() => navigate('/sucursal')} title="Cambiar sucursal">
            📍 {sucursal}
          </button>
          <span className="barra-usuario solo-escritorio">{usuario.nombre}</span>
        </div>
      </header>

      <div className="cuerpo">
        <nav className={`menu ${menuAbierto ? 'abierto' : ''}`} onClick={() => setMenuAbierto(false)}>
          <div className="menu-panel" onClick={(e) => e.stopPropagation()}>
            <div className="menu-usuario">
              <strong>{usuario.nombre}</strong>
              <span>{esAdmin ? 'Administrador' : 'Empleada'} · {sucursal}</span>
            </div>
            {opciones.map((m) => (
              <NavLink key={m.a} to={m.a} end={m.fin} onClick={() => setMenuAbierto(false)}>
                <span className="menu-icono" aria-hidden="true">{m.icono}</span>
                {m.texto}
              </NavLink>
            ))}
            <button className="menu-salir" onClick={salir}>Cerrar sesión</button>
          </div>
        </nav>

        <main className="contenido">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
