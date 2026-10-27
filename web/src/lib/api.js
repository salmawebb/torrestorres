import { urlPagina } from './formato'
import { supabase } from './supabase'

// Acceso a Supabase. Convierte las filas de la base al formato que usan las
// pantallas (el mismo de los datos de ejemplo).

const fallo = ({ data, error }) => {
  if (error) throw new Error(traducir(error))
  return data
}

function traducir(error) {
  if (error.code === '23505' && error.message.includes('compras_ticket_unico')) return 'Ese número de ticket ya está registrado en esta sucursal.'
  if (error.code === '23505' && error.message.includes('telefono')) return 'Ese teléfono ya es de otro cliente.'
  if (error.code === '42501') return 'No tienes permiso para hacer esto.'
  return error.message
}

// PostgREST devuelve como máximo 1000 filas por consulta; se piden por partes.
async function todas(armar) {
  const filas = []
  for (let desde = 0; ; desde += 1000) {
    const parte = fallo(await armar().range(desde, desde + 999))
    filas.push(...parte)
    if (parte.length < 1000) return filas
  }
}

const dosDigitos = (n) => String(n).padStart(2, '0')

export const aCliente = (f) => ({
  id: f.id,
  nombre: f.nombre,
  apellidos: f.apellidos,
  telefono: f.telefono,
  cumpleanos: f.cumple_dia ? `${dosDigitos(f.cumple_dia)}/${dosDigitos(f.cumple_mes)}` : '—',
  registro: new Date(f.registro),
  registradoPor: f.registrado_por,
  notas: f.notas,
  token: f.token_tarjeta,
})

const aCompra = (f, sucursales, niveles) => ({
  id: f.id,
  clienteId: f.cliente_id,
  fecha: new Date(f.fecha),
  sucursal: sucursales[f.sucursal_id],
  total: Number(f.total),
  ticket: f.ticket,
  empleadaId: f.registrada_por,
  cancelada: f.cancelada,
  foto: f.foto_ticket,
  puntos: f.puntos,
  nivel: niveles[f.nivel_id],
})

const aCanje = (f, sucursales) => ({
  id: f.id,
  clienteId: f.cliente_id,
  fecha: new Date(f.fecha),
  sucursal: sucursales[f.sucursal_id],
  puntos: f.puntos,
  pesos: Number(f.pesos),
  empleadaId: f.registrado_por,
})

const aReglas = (cfg, niveles) => ({
  bloquePesos: Number(cfg.bloque_pesos),
  valorPunto: Number(cfg.valor_punto),
  minimoCanje: cfg.minimo_canje,
  vigenciaMeses: cfg.vigencia_meses,
  niveles: niveles.map((n) => ({ id: n.id, nombre: n.nombre, desde: Number(n.desde), puntosPorBloque: n.puntos_por_bloque, beneficio: n.beneficio })),
})

// Catálogos: nombres por id para traducir sucursal_id y nivel_id.
export async function cargarCatalogos() {
  const [suc, cfg, niv, perf] = await Promise.all([
    supabase.from('sucursales').select('*').order('id'),
    supabase.from('configuracion').select('*').single(),
    supabase.from('niveles').select('*').order('desde'),
    supabase.from('perfiles').select('id, nombre, correo, rol, activa').order('nombre'),
  ])
  const sucursales = fallo(suc)
  const niveles = fallo(niv)
  return {
    sucursales,
    reglas: aReglas(fallo(cfg), niveles),
    usuarios: fallo(perf),
  }
}

export async function cargarMovimientos(cat, clienteId) {
  const suc = Object.fromEntries(cat.sucursales.map((s) => [s.id, s.nombre]))
  const niv = Object.fromEntries(cat.reglas.niveles.map((n) => [n.id, n.nombre]))
  const filtro = (q) => (clienteId ? q.eq('cliente_id', clienteId) : q)
  const [compras, canjes] = await Promise.all([
    todas(() => filtro(supabase.from('compras').select('*')).order('id')),
    todas(() => filtro(supabase.from('canjes').select('*')).order('id')),
  ])
  return {
    compras: compras.map((f) => aCompra(f, suc, niv)),
    canjes: canjes.map((f) => aCanje(f, suc)),
  }
}

export async function cargarClientes() {
  return (await todas(() => supabase.from('clientes').select('*').order('id'))).map(aCliente)
}

const idSucursal = (cat, nombre) => cat.sucursales.find((s) => s.nombre === nombre)?.id

export async function insertarCliente(c) {
  const [dia, mes] = c.cumpleanos && c.cumpleanos !== '—' ? c.cumpleanos.split('/').map(Number) : [null, null]
  const fila = fallo(
    await supabase
      .from('clientes')
      .insert({ nombre: c.nombre, apellidos: c.apellidos, telefono: c.telefono, cumple_dia: dia, cumple_mes: mes, notas: c.notas })
      .select()
      .single(),
  )
  return aCliente(fila)
}

export async function insertarCompra(cat, compra) {
  let foto = null
  if (compra.archivo) {
    const ext = compra.archivo.name.split('.').pop()?.toLowerCase() || 'jpg'
    foto = `${compra.sucursal}/${compra.ticket}-${Date.now()}.${ext}`
    fallo(await supabase.storage.from('tickets').upload(foto, compra.archivo))
  }
  const fila = fallo(
    await supabase
      .from('compras')
      .insert({
        cliente_id: compra.clienteId,
        fecha: compra.fecha.toISOString(),
        sucursal_id: idSucursal(cat, compra.sucursal),
        total: compra.total,
        ticket: compra.ticket,
        foto_ticket: foto,
      })
      .select('id')
      .single(),
  )
  return fila.id
}

export async function cancelarCompra(id) {
  fallo(await supabase.from('compras').update({ cancelada: true }).eq('id', id))
}

export async function insertarCanje(cat, canje) {
  fallo(
    await supabase.from('canjes').insert({ cliente_id: canje.clienteId, sucursal_id: idSucursal(cat, canje.sucursal), puntos: canje.puntos }),
  )
}

export async function regenerarToken(clienteId) {
  return fallo(await supabase.rpc('regenerar_token_tarjeta', { p_cliente: clienteId }))
}

export async function guardarReglas(r) {
  fallo(
    await supabase
      .from('configuracion')
      .update({ bloque_pesos: r.bloquePesos, valor_punto: r.valorPunto, minimo_canje: r.minimoCanje, vigencia_meses: r.vigenciaMeses })
      .eq('id', true),
  )
  for (const n of r.niveles) {
    fallo(await supabase.from('niveles').update({ desde: n.desde, puntos_por_bloque: n.puntosPorBloque }).eq('id', n.id))
  }
}

export async function cambiarActiva(id, activa) {
  fallo(await supabase.from('perfiles').update({ activa }).eq('id', id))
}

// Crear cuentas necesita la llave de servicio, así que lo hace la función
// crear-cuenta de Supabase (supabase/functions/crear-cuenta).
export async function crearCuenta({ nombre, correo, rol }) {
  const { error } = await supabase.functions.invoke('crear-cuenta', {
    body: { nombre, correo, rol, redirigir: urlPagina('contrasena') },
  })
  if (error) {
    const detalle = await error.context?.json?.().catch(() => null)
    throw new Error(detalle?.error ?? 'No se pudo crear la cuenta.')
  }
}

export async function enviarRecuperacion(correo) {
  fallo(await supabase.auth.resetPasswordForEmail(correo, { redirectTo: urlPagina('contrasena') }))
}

export async function tarjetaPublica(token) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) return null
  const filas = fallo(await supabase.rpc('tarjeta_publica', { p_token: token }))
  const f = filas[0]
  if (!f) return null
  return {
    nombre: f.nombre,
    nivel: f.nivel,
    puntos: f.puntos,
    pesosCanje: Number(f.pesos_canje),
    puedeCanjear: f.puntos >= f.minimo_canje,
    minimoCanje: f.minimo_canje,
    vigencia: f.vigencia ? new Date(f.vigencia) : null,
    siguienteNivel: f.siguiente_nivel,
    faltaParaSiguiente: f.falta_para_siguiente == null ? null : Number(f.falta_para_siguiente),
  }
}
