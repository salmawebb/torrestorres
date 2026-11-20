# Correos de cuenta

Plantillas en español con la marca de la joyería para los correos que manda Supabase:

| Archivo | Correo en Supabase | Asunto |
|---|---|---|
| `invitacion.html` | Invite user | Tu cuenta en Joyería Torres Torres |
| `restablecer.html` | Reset password | Cambia tu contraseña · Joyería Torres Torres |

Los dos usan `{{ .ConfirmationURL }}`, así el botón sigue abriendo `/contrasena` igual que antes.
El logo se carga de `https://salmawebb.github.io/torrestorres/logo-correo.jpg` (está en `web/public`).
Si la página se cambia a un dominio propio, GitHub redirige esa dirección sola.

## Ponerlas en el proyecto real

1. Supabase > **Authentication > Emails** (pestaña *Templates*).
2. Elige **Invite user**, pega el asunto de la tabla y, en *Message body* (vista *Source*), pega todo el contenido de `invitacion.html`. Guarda.
3. Lo mismo con **Reset password** y `restablecer.html`.

`config.toml` apunta a estos archivos para la Supabase local.
