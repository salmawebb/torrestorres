import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useSesion } from '../context/Sesion'
import logo from '../assets/logo-torres-torres.jpg'

const MENU = [
  { a: '/', texto: 'Inicio', icono: '⌂', fin: true },
  { a: '/clientes', texto: 'Clientes', icono: '☺' },
  { a: '/ventas', texto: 'Ventas', icono: '▤', admin: true },
  { a: '/canjes', texto: 'Canjes', icono: '★' },
  { a: '/empleadas', texto: 'Empleadas', icono: '◉', admin: true },
  { a: '/reportes', texto: 'Reportes', icono: '▲', admin: true },
  { a: '/administracion', texto: 'Administración', icono: '⚙', admin: true },
]

// Logo oficial de la joyería: grande en las pantallas de acceso y chico en la
// barra de arriba y en la tarjeta del cliente.
export function Marca({ chica, mini }) {
  const clase = chica ? 'marca-chica' : mini ? 'marca-mini' : ''
  return (
    <div className={`marca ${clase}`}>
      <img src={logo} alt="Torres Torres · Joyería y Relojería" />
    </div>
  )
}

export default function Layout() {
  const { quien, sucursal, esAdmin, esCelular, salir } = useSesion()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const navigate = useNavigate()
  const opciones = MENU.filter((m) => !m.admin || esAdmin)
  // En el celular: barra fija abajo con lo que más se usa; lo demás en "Más".
  const abajo = opciones.filter((m) => ['/', '/clientes', '/canjes'].includes(m.a))

  return (
    <div className="app">
      <header className="barra">
                <Marca chica />
        <div className="barra-derecha">
          <button className="chip-sucursal" onClick={() => navigate('/sucursal')} title="Cambiar sucursal">
            📍 {sucursal}
          </button>
          {esCelular ? (
            <button className="chip-sucursal" onClick={() => navigate('/empleada')} title="Cambiar de empleada">
              👤 {quien.nombre.split(' ')[0]}
            </button>
          ) : (
            <span className="barra-usuario solo-escritorio">{quien.nombre}</span>
          )}
        </div>
      </header>

      <div className="cuerpo">
        <nav className={`menu ${menuAbierto ? 'abierto' : ''}`} onClick={() => setMenuAbierto(false)}>
          <div className="menu-panel" onClick={(e) => e.stopPropagation()}>
            <div className="menu-usuario">
              <strong>{quien.nombre}</strong>
              <span>{esAdmin ? 'Administrador' : 'Empleada'} · {sucursal}</span>
            </div>
            {opciones.map((m) => (
              <NavLink key={m.a} to={m.a} end={m.fin} onClick={() => setMenuAbierto(false)}>
                <span className="menu-icono" aria-hidden="true">{m.icono}</span>
                {m.texto}
              </NavLink>
            ))}
            {esCelular && <button className="menu-salir" onClick={() => navigate('/empleada')}>Cambiar de empleada</button>}
            <button className="menu-salir" onClick={salir}>Cerrar sesión</button>
          </div>
        </nav>

        <main className="contenido">
          <Outlet />
        </main>
      </div>

      <nav className="barra-abajo solo-movil" aria-label="Menú principal">
        {abajo.map((m) => (
          <NavLink key={m.a} to={m.a} end={m.fin}>
            <span className="menu-icono" aria-hidden="true">{m.icono}</span>
            {m.a === '/' && !esAdmin ? 'Cobrar' : m.texto}
          </NavLink>
        ))}
        <button onClick={() => setMenuAbierto(true)}>
          <span className="menu-icono" aria-hidden="true">☰</span>
          Más
        </button>
      </nav>
    </div>
  )
}
