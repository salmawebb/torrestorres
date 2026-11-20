// Crea cuentas. Solo la puede usar un administrador.
// - Administrador: le manda la invitación por correo para que ponga su contraseña.
// - Celular de sucursal: usuario y contraseña que pone el administrador (sin correo).
//   Con { accion: 'contrasena', id, contrasena } el administrador se la cambia.
// - Con { accion: 'borrar', id } borra una cuenta o empleada que no tenga
//   ventas, canjes, regalos ni clientes a su nombre (las que sí, solo se desactivan).
// - Con { accion: 'quitar-dos-pasos', id } le quita la verificación en dos pasos a
//   otra administradora (por ejemplo, si perdió su celular). Al volver a entrar
//   la activa de nuevo con un QR.
// Necesita la llave de servicio, por eso no se hace desde la página.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Igual que DOMINIO_SUCURSAL en web/src/lib/formato.js.
const DOMINIO_SUCURSAL = 'sucursal.torrestorres.invalid'

const responder = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const url = Deno.env.get('SUPABASE_URL')!
  // Cliente con la sesión de quien llama, para revisar que sea administrador.
  const quien = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: esAdmin, error: errorRol } = await quien.rpc('es_admin')
  if (errorRol || !esAdmin) return responder({ error: 'Solo el administrador puede crear cuentas.' }, 403)

  const cuerpo = await req.json()
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  if (cuerpo.accion === 'borrar') {
    const id = String(cuerpo.id ?? '')
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return responder({ error: 'No existe esa cuenta.' }, 404)
    const { data: yo } = await quien.auth.getUser()
    if (yo?.user?.id === id) return responder({ error: 'No puedes borrar tu propia cuenta.' }, 400)
    const { data: perfil } = await admin.from('perfiles').select('rol, activa').eq('id', id).maybeSingle()
    if (!perfil) return responder({ error: 'No existe esa cuenta.' }, 404)
    if (perfil.rol === 'admin' && perfil.activa) {
      const { count } = await admin.from('perfiles').select('id', { count: 'exact', head: true })
        .eq('rol', 'admin').eq('activa', true).neq('id', id)
      if (!count) return responder({ error: 'Debe quedar al menos una administradora activa.' }, 400)
    }
    const usos = await Promise.all([
      admin.from('compras').select('id', { count: 'exact', head: true }).or(`registrada_por.eq.${id},atendida_por.eq.${id},cancelada_por.eq.${id}`),
      admin.from('canjes').select('id', { count: 'exact', head: true }).eq('registrado_por', id),
      admin.from('clientes').select('id', { count: 'exact', head: true }).eq('registrado_por', id),
      admin.from('regalos_cumple').select('id', { count: 'exact', head: true }).or(`entregado_por.eq.${id},registrado_por.eq.${id}`),
    ])
    if (usos.some((u) => u.error)) return responder({ error: 'No se pudo revisar el historial de la cuenta.' }, 500)
    if (usos.some((u) => u.count)) {
      return responder({ error: 'Tiene ventas, canjes, regalos o clientes a su nombre. Para conservar el historial solo se puede desactivar.' }, 400)
    }
    // Con cuenta (admin o celular) se borra el login y un trigger borra el
    // perfil; una empleada sin cuenta es solo su perfil.
    const { data: cuenta, error: sinCuenta } = await admin.auth.admin.getUserById(id)
    const { error } = !sinCuenta && cuenta?.user
      ? await admin.auth.admin.deleteUser(id)
      : await admin.from('perfiles').delete().eq('id', id)
    if (error) return responder({ error: error.message }, 400)
    return responder({ id })
  }

  if (cuerpo.accion === 'quitar-dos-pasos') {
    const id = String(cuerpo.id ?? '')
    const { data: yo } = await quien.auth.getUser()
    if (yo?.user?.id === id) return responder({ error: 'Pídele a otra administradora que te la quite.' }, 400)
    const { data: perfil } = await admin.from('perfiles').select('rol').eq('id', id).maybeSingle()
    if (perfil?.rol !== 'admin') return responder({ error: 'Solo las administradoras tienen verificación en dos pasos.' }, 400)
    const { data: lista, error: errorLista } = await admin.auth.admin.mfa.listFactors({ userId: id })
    if (errorLista) return responder({ error: errorLista.message }, 400)
    for (const f of lista?.factors ?? []) {
      const { error } = await admin.auth.admin.mfa.deleteFactor({ userId: id, id: f.id })
      if (error) return responder({ error: error.message }, 400)
    }
    return responder({ id, quitadas: lista?.factors?.length ?? 0 })
  }

  if (cuerpo.accion === 'contrasena') {
    const { id, contrasena } = cuerpo
    if (!id || !contrasena || contrasena.length < 6) return responder({ error: 'La contraseña debe tener al menos 6 caracteres.' }, 400)
    const { data: perfil } = await admin.from('perfiles').select('rol').eq('id', id).maybeSingle()
    if (perfil?.rol !== 'sucursal') return responder({ error: 'Solo se cambia aquí la contraseña de un celular de sucursal.' }, 400)
    const { error } = await admin.auth.admin.updateUserById(id, { password: contrasena })
    if (error) return responder({ error: error.message }, 400)
    return responder({ id })
  }

  // Celular de sucursal: usuario + contraseña que pone el administrador, sin
  // correo. Por dentro Supabase necesita un correo, así que se arma uno que
  // nunca recibe nada (dominio .invalid, reservado para eso).
  if (cuerpo.rol === 'sucursal') {
    const nombre = cuerpo.nombre?.trim()
    const usuario = cuerpo.usuario?.trim().toLowerCase()
    const contrasena = cuerpo.contrasena ?? ''
    if (!nombre || !/^[a-z0-9._-]{3,30}$/.test(usuario ?? '')) {
      return responder({ error: 'El usuario debe tener de 3 a 30 letras o números, sin espacios ni acentos.' }, 400)
    }
    if (contrasena.length < 6) return responder({ error: 'La contraseña debe tener al menos 6 caracteres.' }, 400)
    const { data, error } = await admin.auth.admin.createUser({
      email: `${usuario}@${DOMINIO_SUCURSAL}`,
      password: contrasena,
      email_confirm: true,
      user_metadata: { nombre },
      app_metadata: { rol: 'sucursal' },
    })
    if (error) {
      const repetido = /already|registered|exists/i.test(error.message)
      return responder({ error: repetido ? `Ya existe el usuario "${usuario}".` : error.message }, 400)
    }
    return responder({ id: data.user.id })
  }

  const { nombre, correo, rol, redirigir } = cuerpo
  if (!nombre?.trim() || !correo?.trim() || !['admin', 'empleada'].includes(rol)) {
    return responder({ error: 'Faltan el nombre, el correo o el rol.' }, 400)
  }

  const { data, error } = await admin.auth.admin.inviteUserByEmail(correo.trim().toLowerCase(), {
    data: { nombre: nombre.trim() },
    redirectTo: redirigir,
  })
  if (error) return responder({ error: error.message }, 400)

  // El rol va en app_metadata, que la persona no puede cambiar; un trigger lo copia a su perfil.
  const { error: errorRol2 } = await admin.auth.admin.updateUserById(data.user.id, { app_metadata: { rol } })
  if (errorRol2) return responder({ error: errorRol2.message }, 400)
  return responder({ id: data.user.id })
})
