import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Aviso, BotonExportar, Modal, Tarjeta, useAviso } from '../components/Comunes'
import { useDatos } from '../context/Datos'
import { fecha, pesos } from '../lib/formato'

const PESTANAS = [
  { id: 'usuarios', texto: 'Usuarios' },
  { id: 'lealtad', texto: 'Programa de lealtad' },
  { id: 'importar', texto: 'Importar Excel' },
  { id: 'respaldo', texto: 'Respaldo' },
]

export default function Administracion() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') ?? 'usuarios'
  const [aviso, setAviso, cerrarAviso] = useAviso()
  return (
    <div className="pagina">
      <h1 className="titulo">Administración</h1>
      <div className="pestanas" role="tablist">
        {PESTANAS.map((p) => (
          <button key={p.id} role="tab" aria-selected={tab === p.id} onClick={() => setParams({ tab: p.id })}>{p.texto}</button>
        ))}
      </div>
      {tab === 'usuarios' && <Usuarios setAviso={setAviso} />}
      {tab === 'lealtad' && <Lealtad setAviso={setAviso} />}
      {tab === 'importar' && <Importar />}
      {tab === 'respaldo' && <Respaldo />}
      <Aviso mensaje={aviso} onCerrar={cerrarAviso} />
    </div>
  )
}

function Usuarios({ setAviso }) {
  const { usuarios, crearCuenta, cambiarActiva, enviarRecuperacion } = useDatos()
  const [nuevo, setNuevo] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const intentar = async (accion, mensaje) => {
    try {
      await accion()
      setAviso(mensaje)
    } catch (e) {
      setAviso(`No se pudo completar: ${e.message}`)
    }
  }
  const alternar = (u) => intentar(() => cambiarActiva(u.id, !u.activa), u.activa ? `${u.nombre} ya no puede entrar.` : `${u.nombre} puede entrar de nuevo.`)
  const restablecer = (u) => intentar(() => enviarRecuperacion(u.correo), `Se envió a ${u.correo} un enlace para restablecer la contraseña.`)
  const crear = async (e) => {
    e.preventDefault()
    setOcupado(true)
    await intentar(
      () => crearCuenta({ nombre: nuevo.nombre.trim(), correo: nuevo.correo.trim().toLowerCase(), rol: nuevo.rol }),
      `Se creó la cuenta de ${nuevo.nombre}. Le llegará un correo para poner su contraseña.`,
    )
    setOcupado(false)
    setNuevo(null)
  }
  return (
    <Tarjeta titulo="Cuentas" accion={<button className="btn btn-primario btn-chico" onClick={() => setNuevo({ nombre: '', correo: '', rol: 'empleada' })}>+ Nueva cuenta</button>}>
      <p className="ayuda">No hay registro público: solo aquí se crean las cuentas. Cada empleada debe tener la suya para que el reporte del bono sea confiable.</p>
      <div className="tabla-envoltura">
        <table className="tabla">
          <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th /></tr></thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className={u.activa ? '' : 'cancelada'}>
                <td>{u.nombre}</td>
                <td>{u.correo}</td>
                <td>{u.rol === 'admin' ? 'Administrador' : 'Empleada'}</td>
                <td>{u.activa ? 'Activa' : 'Desactivada'}</td>
                <td className="acciones-fila">
                  <button className="enlace" onClick={() => restablecer(u)}>Restablecer contraseña</button>
                  {u.rol !== 'admin' && <button className="enlace" onClick={() => alternar(u)}>{u.activa ? 'Desactivar' : 'Activar'}</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal abierto={!!nuevo} titulo="Nueva cuenta" onCerrar={() => setNuevo(null)}>
        {nuevo && (
          <form className="formulario" onSubmit={crear}>
            <label>Nombre<input required value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} /></label>
            <label>Correo<input type="email" required value={nuevo.correo} onChange={(e) => setNuevo({ ...nuevo, correo: e.target.value })} /></label>
            <label>
              Rol
              <select value={nuevo.rol} onChange={(e) => setNuevo({ ...nuevo, rol: e.target.value })}>
                <option value="empleada">Empleada</option>
                <option value="admin">Administrador</option>
              </select>
            </label>
            <button className="btn btn-primario btn-bloque" disabled={ocupado}>Crear cuenta</button>
          </form>
        )}
      </Modal>
    </Tarjeta>
  )
}

function Lealtad({ setAviso }) {
  const { reglas, guardarReglas } = useDatos()
  const [f, setF] = useState(reglas)
  const num = (k) => (e) => setF({ ...f, [k]: Number(e.target.value) })
  const nivel = (i, k) => (e) => setF({ ...f, niveles: f.niveles.map((n, j) => (j === i ? { ...n, [k]: Number(e.target.value) } : n)) })
  return (
    <Tarjeta titulo="Reglas del programa">
      <form className="formulario" onSubmit={async (e) => {
        e.preventDefault()
        try {
          await guardarReglas(f)
          setAviso('Reglas guardadas. Las compras ya registradas conservan sus puntos.')
        } catch (err) {
          setAviso(`No se pudieron guardar las reglas: ${err.message}`)
        }
      }}>
        <div className="fila-4">
          <label>Bloque de compra ($)<input type="number" min="1" value={f.bloquePesos} onChange={num('bloquePesos')} /></label>
          <label>Valor del punto ($)<input type="number" min="0" step="0.01" value={f.valorPunto} onChange={num('valorPunto')} /></label>
          <label>Mínimo para canjear (pts)<input type="number" min="1" value={f.minimoCanje} onChange={num('minimoCanje')} /></label>
          <label>Vigencia (meses)<input type="number" min="1" value={f.vigenciaMeses} onChange={num('vigenciaMeses')} /></label>
        </div>
        <p className="resaltado">{f.minimoCanje} puntos = {pesos(f.minimoCanje * f.valorPunto)} de descuento</p>
        <div className="tabla-envoltura">
          <table className="tabla">
            <thead><tr><th>Nivel</th><th>Desde compra acumulada ($)</th><th>Puntos por cada ${f.bloquePesos}</th><th>Beneficio</th></tr></thead>
            <tbody>
              {f.niveles.map((n, i) => (
                <tr key={n.nombre}>
                  <td><strong>{n.nombre}</strong></td>
                  <td><input type="number" min="0" disabled={i === 0} value={n.desde} onChange={nivel(i, 'desde')} /></td>
                  <td><input type="number" min="1" value={n.puntosPorBloque} onChange={nivel(i, 'puntosPorBloque')} /></td>
                  <td className="beneficio">{n.beneficio}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="ayuda">Si cambias las reglas, las compras ya registradas conservan los puntos que ganaron.</p>
        <button className="btn btn-primario">Guardar cambios</button>
      </form>
    </Tarjeta>
  )
}

function Importar() {
  const [archivo, setArchivo] = useState(null)
  return (
    <Tarjeta titulo="Importar el Excel actual">
      <ol className="pasos">
        <li>Sube el archivo de Excel con las hojas de <strong>clientes</strong> y <strong>compras</strong>.</li>
        <li>El sistema muestra una vista previa y marca las filas con errores (teléfonos incompletos, tickets repetidos).</li>
        <li>Los puntos y niveles se recalculan a partir de las compras, en lugar de copiarse tal cual.</li>
        <li>Confirmas y se cargan los datos.</li>
      </ol>
      <label className="zona-archivo">
        <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setArchivo(e.target.files[0] ?? null)} />
        <span>{archivo ? `📄 ${archivo.name}` : 'Toca para elegir el archivo de Excel'}</span>
      </label>
      {archivo && <p className="ayuda">La lectura del archivo se conectará cuando esté lista la base de datos.</p>}
    </Tarjeta>
  )
}

function Respaldo() {
  const { compras, clientes, canjes } = useDatos()
  const cli = (id) => clientes.find((c) => c.id === id)
  return (
    <Tarjeta titulo="Copia de respaldo">
      <p className="ayuda">Descarga todo el historial en Excel de vez en cuando como copia de seguridad.</p>
      <div className="accesos">
        <BotonExportar nombre="respaldo-clientes" filas={clientes} columnas={[
          { titulo: 'Número', valor: (c) => c.id }, { titulo: 'Nombre', valor: (c) => c.nombre }, { titulo: 'Apellidos', valor: (c) => c.apellidos },
          { titulo: 'Teléfono', valor: (c) => c.telefono }, { titulo: 'Cumpleaños', valor: (c) => c.cumpleanos }, { titulo: 'Registro', valor: (c) => fecha(c.registro) }, { titulo: 'Notas', valor: (c) => c.notas },
        ]} />
        <BotonExportar nombre="respaldo-compras" filas={compras} columnas={[
          { titulo: 'Fecha', valor: (v) => v.fecha.toISOString() }, { titulo: 'Cliente', valor: (v) => v.clienteId }, { titulo: 'Nombre', valor: (v) => cli(v.clienteId).nombre },
          { titulo: 'Sucursal', valor: (v) => v.sucursal }, { titulo: 'Ticket', valor: (v) => v.ticket }, { titulo: 'Total', valor: (v) => v.total },
          { titulo: 'Registró', valor: (v) => v.empleadaId }, { titulo: 'Cancelada', valor: (v) => (v.cancelada ? 'Sí' : 'No') },
        ]} />
        <BotonExportar nombre="respaldo-canjes" filas={canjes} columnas={[
          { titulo: 'Fecha', valor: (v) => v.fecha.toISOString() }, { titulo: 'Cliente', valor: (v) => v.clienteId }, { titulo: 'Sucursal', valor: (v) => v.sucursal },
          { titulo: 'Puntos', valor: (v) => v.puntos }, { titulo: 'Descuento', valor: (v) => v.pesos },
        ]} />
      </div>
    </Tarjeta>
  )
}
