import { Link } from 'react-router-dom'
import { normalizarTelefono } from '../lib/formato'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

// Datos del formulario a partir de un cliente (para editar) o vacíos (nuevo).
export function formularioCliente(c = null, telefono = '') {
  const [dia, mes] = c?.cumpleanos && c.cumpleanos !== '—' ? c.cumpleanos.split('/').map((x) => String(Number(x))) : ['', '']
  return {
    nombre: c?.nombre ?? '',
    apellidos: c?.apellidos ?? '',
    telefono: c ? (c.telefono ? c.telefono.slice(2) : '') : telefono,
    dia,
    mes,
    notas: c?.notas ?? '',
  }
}

// El teléfono es opcional; si se escribe, deben ser 10 dígitos y no ser de otro cliente.
export function revisarCliente(f, clientes, idPropio = null) {
  const tel = normalizarTelefono(f.telefono)
  const telValido = tel === '' || tel.length === 12
  const existente = tel && telValido ? clientes.find((c) => c.telefono === tel && c.id !== idPropio) : null
  return { tel, valido: telValido && !existente && f.nombre.trim() !== '', telValido, existente }
}

export function datosCliente(f, tel) {
  return {
    nombre: f.nombre.trim(),
    apellidos: f.apellidos.trim(),
    telefono: tel || null,
    cumpleanos: f.dia && f.mes ? `${f.dia.padStart(2, '0')}/${f.mes.padStart(2, '0')}` : '—',
    notas: f.notas.trim(),
  }
}

export default function CamposCliente({ f, setF, revision, autoFocus = false }) {
  const cambiar = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const { telValido, existente } = revision
  return (
    <>
      <div className="fila-2">
        <label>Nombre<input required autoFocus={autoFocus} value={f.nombre} onChange={cambiar('nombre')} /></label>
        <label>Apellidos<input value={f.apellidos} onChange={cambiar('apellidos')} /></label>
      </div>
      <label>
        Teléfono (WhatsApp, opcional)
        <input type="tel" inputMode="tel" placeholder="81 1234 5678" value={f.telefono} onChange={cambiar('telefono')} />
      </label>
      {!telValido && <p className="error">Escribe los 10 dígitos del celular, o déjalo vacío si no tiene.</p>}
      {existente && (
        <p className="error">
          Ese teléfono ya es de {existente.nombre} {existente.apellidos}. <Link to={`/clientes/${existente.id}`}>Abrir su ficha</Link>
        </p>
      )}
      <fieldset className="fila-2">
        <legend>Cumpleaños</legend>
        <label>Día<input type="number" min="1" max="31" inputMode="numeric" value={f.dia} onChange={cambiar('dia')} /></label>
        <label>
          Mes
          <select value={f.mes} onChange={cambiar('mes')}>
            <option value="">—</option>
            {MESES.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
          </select>
        </label>
      </fieldset>
      <label>Notas<textarea rows="2" value={f.notas} onChange={cambiar('notas')} /></label>
    </>
  )
}
