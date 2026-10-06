// Crea la cuenta de una empleada o administrador y le manda la invitación por
// correo para que ponga su contraseña. Solo la puede usar un administrador.
// Necesita la llave de servicio, por eso no se hace desde la página.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

  const { nombre, correo, rol, redirigir } = await req.json()
  if (!nombre?.trim() || !correo?.trim() || !['admin', 'empleada'].includes(rol)) {
    return responder({ error: 'Faltan el nombre, el correo o el rol.' }, 400)
  }

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
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
