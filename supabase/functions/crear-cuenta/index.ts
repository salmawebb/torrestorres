// Crea cuentas. Solo la puede usar un administrador.
// - Administrador: le manda la invitación por correo para que ponga su contraseña.
// - Celular de sucursal: usuario y contraseña que pone el administrador (sin correo).
//   Con { accion: 'contrasena', id, contrasena } el administrador se la cambia.
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

  // Celular de sucursal: usuario + contraseña que pone el administrador, sin
  // correo. Por dentro Supabase necesita un correo, así que se arma uno que
  // nunca recibe nada (dominio .invalid, reservado para eso).
  if (cuerpo.accion === 'contrasena') {
    const { id, contrasena } = cuerpo
    if (!id || !contrasena || contrasena.length < 6) return responder({ error: 'La contraseña debe tener al menos 6 caracteres.' }, 400)
    const { data: perfil } = await admin.from('perfiles').select('rol').eq('id', id).maybeSingle()
    if (perfil?.rol !== 'sucursal') return responder({ error: 'Solo se cambia aquí la contraseña de un celular de sucursal.' }, 400)
    const { error } = await admin.auth.admin.updateUserById(id, { password: contrasena })
    if (error) return responder({ error: error.message }, 400)
    return responder({ id })
  }

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
