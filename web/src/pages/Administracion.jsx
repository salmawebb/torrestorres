import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Aviso, BotonExportar, Modal, Tarjeta, useAviso } from '../components/Comunes'
import { useDatos } from '../context/Datos'
import { useSesion } from '../context/Sesion'
import { pesos, usuarioDeCorreo } from '../lib/formato'

const PESTANAS = [
  { id: 'usuarios', texto: 'Usuarios' },
  { id: 'lealtad', texto: 'Programa de lealtad' },
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
      {tab === 'respaldo' && <Respaldo />}
      <Aviso mensaje={aviso} onCerrar={cerrarAviso} />
    </div>
  )
}

const ROLES = {
  empleada: 'Empleada',
  sucursal: 'Celular de sucursal',
  admin: 'Administrador',
}

function Usuarios({ setAviso }) {
  const { usuarios, compras, canjes, clientes, crearCuenta, crearEmpleada, cambiarActiva, enviarRecuperacion, cambiarContrasenaSucursal, borrarCuenta, quitarDosPasos } = useDatos()
  const [quitar, setQuitar] = useState(null)
  const [contrasena, setContrasena] = useState(null)
  const [borrar, setBorrar] = useState(null)
  const { usuario: yo } = useSesion()
  const adminsActivas = usuarios.filter((u) => u.rol === 'admin' && u.activa).length
  // Nadie se desactiva a sí misma y siempre queda una administradora activa
  // (la base de datos revisa lo mismo).
  const puedeAlternar = (u) => u.id !== yo?.id && !(u.rol === 'admin' && u.activa && adminsActivas <= 1)
  // Borrar solo lo que no tiene historial (creado por error o mal escrito); lo
  // demás se desactiva. La función crear-cuenta lo vuelve a revisar.
  const tieneHistorial = (id) =>
    compras.some((v) => v.empleadaId === id || v.registroId === id) ||
    canjes.some((c) => c.empleadaId === id) ||
    clientes.some((c) => c.registradoPor === id)
  const puedeBorrar = (u) => puedeAlternar(u) && !tieneHistorial(u.id)
  const confirmarBorrar = async () => {
    setOcupado(true)
    await intentar(() => borrarCuenta(borrar.id), `Se borró ${borrar.nombre}.`)
    setOcupado(false)
    setBorrar(null)
  }
  const confirmarQuitar = async () => {
    setOcupado(true)
    await intentar(() => quitarDosPasos(quitar.id), `Listo. La próxima vez que ${quitar.nombre} entre, activa la verificación con un QR nuevo.`)
    setOcupado(false)
    setQuitar(null)
  }
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
  const alternar = (u) => intentar(
    () => cambiarActiva(u.id, !u.activa),
    u.rol === 'empleada'
      ? (u.activa ? `${u.nombre} ya no sale en la lista de empleadas.` : `${u.nombre} vuelve a salir en la lista de empleadas.`)
      : (u.activa ? `${u.nombre} ya no puede entrar.` : `${u.nombre} puede entrar de nuevo.`),
  )
  const restablecer = (u) => intentar(() => enviarRecuperacion(u.correo), `Se envió a ${u.correo} un enlace para restablecer la contraseña.`)
  const guardarContrasena = async (e) => {
    e.preventDefault()
    setOcupado(true)
    await intentar(() => cambiarContrasenaSucursal(contrasena.u.id, contrasena.valor), `Listo, ${contrasena.u.nombre} ya entra con la contraseña nueva.`)
    setOcupado(false)
    setContrasena(null)
  }
  const crear = async (e) => {
    e.preventDefault()
    setOcupado(true)
    const nombre = nuevo.nombre.trim()
    const usuario = nuevo.usuario.trim().toLowerCase()
    await (nuevo.rol === 'empleada'
      ? intentar(() => crearEmpleada(nombre), `Listo: ${nombre} ya sale en "¿Qué empleada eres?" en los celulares de las sucursales.`)
      : nuevo.rol === 'sucursal'
        ? intentar(
          () => crearCuenta({ nombre, usuario, contrasena: nuevo.contrasena, rol: 'sucursal' }),
          `Listo: en el celular se entra con el usuario "${usuario}" y la contraseña que pusiste.`,
        )
        : intentar(
          () => crearCuenta({ nombre, correo: nuevo.correo.trim().toLowerCase(), rol: nuevo.rol }),
          `Se creó la cuenta ${nombre}. Al correo ${nuevo.correo.trim()} llegará un enlace para poner la contraseña.`,
        ))
    setOcupado(false)
    setNuevo(null)
  }
  return (
    <Tarjeta titulo="Usuarios" accion={<button className="btn btn-primario btn-chico" onClick={() => setNuevo({ nombre: '', correo: '', usuario: '', contrasena: '', rol: 'empleada' })}>+ Agregar</button>}>
      <p className="ayuda">
        Cada sucursal entra con <strong>una sola cuenta</strong> desde su celular (el que tiene WhatsApp Business), con un usuario y contraseña que pones tú. Al entrar, la empleada elige la sucursal y luego toca su nombre en «¿Qué empleada eres?».
        Las empleadas no necesitan correo ni contraseña: solo se agregan con su nombre. Las administradoras entran con su contraseña y además el código de su app autenticadora (verificación en dos pasos).
      </p>
      <div className="tabla-envoltura">
        <table className="tabla">
          <thead><tr><th>Nombre</th><th>Correo o usuario</th><th>Rol</th><th>Estado</th><th /></tr></thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className={u.activa ? '' : 'cancelada'}>
                <td>{u.nombre}</td>
                <td>{usuarioDeCorreo(u.correo) ? <>Usuario: <strong>{usuarioDeCorreo(u.correo)}</strong></> : u.correo ?? <span className="ayuda">Sin cuenta</span>}</td>
                <td>{ROLES[u.rol] ?? u.rol}</td>
                <td>{u.activa ? 'Activa' : 'Desactivada'}</td>
                <td className="acciones-fila">
                  {u.rol === 'sucursal'
                    ? <button className="enlace" onClick={() => setContrasena({ u, valor: '' })}>Cambiar contraseña</button>
                    : u.correo && <button className="enlace" onClick={() => restablecer(u)}>Restablecer contraseña</button>}
                  {u.rol === 'admin' && u.id !== yo?.id && <button className="enlace" onClick={() => setQuitar(u)}>Quitar verificación en dos pasos</button>}
                  {puedeAlternar(u) && <button className="enlace" onClick={() => alternar(u)}>{u.activa ? 'Desactivar' : 'Activar'}</button>}
                  {puedeBorrar(u) && <button className="enlace peligro" onClick={() => setBorrar(u)}>Borrar</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal abierto={!!nuevo} titulo="Agregar" onCerrar={() => setNuevo(null)}>
        {nuevo && (
          <form className="formulario" onSubmit={crear}>
            <label>
              Tipo
              <select value={nuevo.rol} onChange={(e) => setNuevo({ ...nuevo, rol: e.target.value })}>
                <option value="empleada">Empleada (solo su nombre)</option>
                <option value="sucursal">Celular de sucursal (cuenta compartida)</option>
                <option value="admin">Administrador</option>
              </select>
            </label>
            <label>
              Nombre
              <input required placeholder={nuevo.rol === 'sucursal' ? 'Ej. Celular Allende' : ''} value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
            </label>
            {nuevo.rol === 'empleada' && (
              <p className="ayuda">No necesita correo ni contraseña. Va a salir en «¿Qué empleada eres?» al entrar en el celular de cualquier sucursal.</p>
            )}
            {nuevo.rol === 'sucursal' && (
              <>
                <label>
                  Usuario
                  <input required pattern="[a-zA-Z0-9._\-]{3,30}" title="De 3 a 30 letras o números, sin espacios ni acentos" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="Ej. allende" value={nuevo.usuario} onChange={(e) => setNuevo({ ...nuevo, usuario: e.target.value })} />
                </label>
                <label>
                  Contraseña
                  <input type="text" required minLength={6} autoComplete="new-password" value={nuevo.contrasena} onChange={(e) => setNuevo({ ...nuevo, contrasena: e.target.value })} />
                  <small className="ayuda">Mínimo 6 caracteres. Anótala: con este usuario y contraseña se entra en el celular. Si se olvida, aquí le pones otra.</small>
                </label>
              </>
            )}
            {nuevo.rol === 'admin' && (
              <label>
                Correo
                <input type="email" required value={nuevo.correo} onChange={(e) => setNuevo({ ...nuevo, correo: e.target.value })} />
                <small className="ayuda">Le llega un correo para poner su contraseña.</small>
              </label>
            )}
            <button className="btn btn-primario btn-bloque" disabled={ocupado}>{nuevo.rol === 'empleada' ? 'Agregar empleada' : 'Crear cuenta'}</button>
          </form>
        )}
      </Modal>
      <Modal abierto={!!borrar} titulo="Borrar" onCerrar={() => setBorrar(null)}>
        {borrar && (
          <div className="formulario">
            <p>¿Borrar a <strong>{borrar.nombre}</strong>? No tiene ventas ni registros, así que no se pierde ningún historial. Esto no se puede deshacer.</p>
            <button className="btn btn-primario btn-bloque" disabled={ocupado} onClick={confirmarBorrar}>{ocupado ? 'Borrando…' : 'Sí, borrar'}</button>
            <button className="enlace" onClick={() => setBorrar(null)}>Cancelar</button>
          </div>
        )}
      </Modal>
      <Modal abierto={!!quitar} titulo="Quitar verificación en dos pasos" onCerrar={() => setQuitar(null)}>
        {quitar && (
          <div className="formulario">
            <p>Úsalo si <strong>{quitar.nombre}</strong> perdió o cambió su celular. Al volver a entrar le va a salir un QR nuevo para activarla otra vez en su app autenticadora.</p>
            <p className="ayuda">Si le robaron el celular, mejor desactiva también su cuenta mientras tanto.</p>
            <button className="btn btn-primario btn-bloque" disabled={ocupado} onClick={confirmarQuitar}>{ocupado ? 'Quitando…' : 'Sí, quitarla'}</button>
            <button className="enlace" onClick={() => setQuitar(null)}>Cancelar</button>
          </div>
        )}
      </Modal>
      <Modal abierto={!!contrasena} titulo="Cambiar contraseña" onCerrar={() => setContrasena(null)}>
        {contrasena && (
          <form className="formulario" onSubmit={guardarContrasena}>
            <p className="ayuda">{contrasena.u.nombre} · usuario <strong>{usuarioDeCorreo(contrasena.u.correo)}</strong></p>
            <label>
              Contraseña nueva
              <input type="text" required minLength={6} autoComplete="new-password" value={contrasena.valor} onChange={(e) => setContrasena({ ...contrasena, valor: e.target.value })} />
            </label>
            <button className="btn btn-primario btn-bloque" disabled={ocupado}>Guardar contraseña</button>
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
            <thead><tr><th>Nivel</th><th>Desde compra acumulada ($)</th><th>Puntos por cada ${f.bloquePesos}</th><th>Regalo de cumpleaños ($)</th><th>Beneficio</th></tr></thead>
            <tbody>
              {f.niveles.map((n, i) => (
                <tr key={n.nombre}>
                  <td><strong>{n.nombre}</strong></td>
                  <td><input type="number" min="0" disabled={i === 0} value={n.desde} onChange={nivel(i, 'desde')} /></td>
                  <td><input type="number" min="1" value={n.puntosPorBloque} onChange={nivel(i, 'puntosPorBloque')} /></td>
                  <td><input type="number" min="0" step="10" value={n.regaloCumple ?? 0} disabled={n.regaloCumple == null} onChange={nivel(i, 'regaloCumple')} /></td>
                  <td className="beneficio">{n.beneficio}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="fila-2">
          <label>
            Subir de nivel
            <select value={f.nivelesPorCompra} onChange={num('nivelesPorCompra')}>
              {f.niveles.slice(1, -1).map((_, i) => (
                <option key={i} value={i + 1}>{i === 0 ? 'Sube máximo un nivel por compra' : `Sube máximo ${i + 1} niveles por compra`}</option>
              ))}
              <option value={0}>Sube directo a todos los niveles que alcance</option>
            </select>
          </label>
          <label>
            Al vencer los puntos
            <select value={f.bajaAlVencer ? 'si' : 'no'} onChange={(e) => setF({ ...f, bajaAlVencer: e.target.value === 'si' })}>
              <option value="si">Pierde los puntos y baja un nivel</option>
              <option value="no">Pierde los puntos, pero conserva su nivel</option>
            </select>
          </label>
        </div>
        <p className="ayuda">Ejemplo: una clienta en {f.niveles[0].nombre} compra {pesos(f.niveles[f.niveles.length - 1].desde)} de una vez. {f.nivelesPorCompra === 0 || f.nivelesPorCompra >= f.niveles.length - 1
          ? `Pasa directo a ${f.niveles[f.niveles.length - 1].nombre}.`
          : `Sube solo a ${f.niveles[Math.min(f.nivelesPorCompra, f.niveles.length - 1)].nombre}.`}</p>
        <p className="ayuda">Regalo de cumpleaños: lo que la clienta puede canjear, una vez, durante todo su mes de cumpleaños, según su nivel. Pon $0 si un nivel no tiene regalo.</p>
        <p className="ayuda">Si cambias las reglas, las compras ya registradas conservan los puntos que ganaron. El nivel de cada clienta sí se vuelve a calcular con su historial, así que las dos reglas de nivel pueden cambiar el nivel de quien ya compró.</p>
        <button className="btn btn-primario">Guardar cambios</button>
      </form>
    </Tarjeta>
  )
}

function Respaldo() {
  const { compras, clientes, canjes, regalos, usuarios } = useDatos()
  const cli = (id) => clientes.find((c) => c.id === id)
  const nombreCompleto = (id) => { const c = cli(id); return c ? `${c.nombre} ${c.apellidos}`.trim() : '' }
  const empleada = (id) => usuarios.find((u) => u.id === id)?.nombre ?? id
  return (
    <Tarjeta titulo="Copia de respaldo">
      <p className="ayuda">Descarga todo el historial en Excel de vez en cuando como copia de seguridad.</p>
      <div className="accesos">
        <BotonExportar nombre="respaldo-clientes" filas={clientes} columnas={[
          { titulo: 'Número', valor: (c) => c.id }, { titulo: 'Nombre', valor: (c) => c.nombre }, { titulo: 'Apellidos', valor: (c) => c.apellidos },
          { titulo: 'Teléfono', valor: (c) => c.telefono }, { titulo: 'Cumpleaños', valor: (c) => c.cumpleanos }, { titulo: 'Registro', valor: (c) => c.registro }, { titulo: 'Notas', valor: (c) => c.notas },
        ]} />
        <BotonExportar nombre="respaldo-compras" filas={compras} columnas={[
          { titulo: 'Fecha', valor: (v) => v.fecha }, { titulo: 'Cliente', valor: (v) => v.clienteId }, { titulo: 'Nombre', valor: (v) => nombreCompleto(v.clienteId) },
          { titulo: 'Sucursal', valor: (v) => v.sucursal }, { titulo: 'Ticket', valor: (v) => v.ticket }, { titulo: 'Total', valor: (v) => v.total },
          { titulo: 'Atendió', valor: (v) => empleada(v.empleadaId) }, { titulo: 'Cuenta que registró', valor: (v) => empleada(v.registroId ?? v.empleadaId) }, { titulo: 'Cancelada', valor: (v) => (v.cancelada ? 'Sí' : 'No') },
        ]} />
        <BotonExportar nombre="respaldo-canjes" filas={canjes} columnas={[
          { titulo: 'Fecha', valor: (v) => v.fecha }, { titulo: 'Cliente', valor: (v) => v.clienteId }, { titulo: 'Nombre', valor: (v) => nombreCompleto(v.clienteId) },
          { titulo: 'Sucursal', valor: (v) => v.sucursal }, { titulo: 'Puntos', valor: (v) => v.puntos }, { titulo: 'Descuento', valor: (v) => v.pesos },
        ]} />
        <BotonExportar nombre="respaldo-regalos-cumpleanos" filas={regalos} columnas={[
          { titulo: 'Fecha', valor: (v) => v.fecha }, { titulo: 'Cliente', valor: (v) => v.clienteId }, { titulo: 'Nombre', valor: (v) => nombreCompleto(v.clienteId) },
          { titulo: 'Sucursal', valor: (v) => v.sucursal }, { titulo: 'Nivel', valor: (v) => v.nivel }, { titulo: 'Regalo', valor: (v) => v.pesos },
          { titulo: 'Atendió', valor: (v) => empleada(v.empleadaId) }, { titulo: 'Cuenta que registró', valor: (v) => empleada(v.registroId ?? v.empleadaId) },
        ]} />
      </div>
    </Tarjeta>
  )
}
