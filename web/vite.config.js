import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// BASE_PATH cambia la carpeta donde vive la página, por ejemplo /torrestorres/
// en GitHub Pages. Sin ella se publica en la raíz del dominio.
//
// SITE_URL es la dirección completa de la página publicada, por ejemplo
// https://salmawebb.github.io/torrestorres/. Con ella se agregan las etiquetas
// que usa WhatsApp para mostrar el logo arriba del enlace de la tarjeta.
// WhatsApp solo acepta direcciones completas; si cambia el dominio, cambia
// SITE_URL en .github/workflows/pages.yml.
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react(), vistaPreviaWhatsApp(process.env.SITE_URL)],
})

function vistaPreviaWhatsApp(sitio) {
  return {
    name: 'vista-previa-whatsapp',
    transformIndexHtml() {
      if (!sitio) return []
      const base = sitio.endsWith('/') ? sitio : `${sitio}/`
      const meta = (atributos) => ({ tag: 'meta', attrs: atributos, injectTo: 'head' })
      return [
        meta({ property: 'og:type', content: 'website' }),
        meta({ property: 'og:site_name', content: 'Joyería Torres Torres' }),
        meta({ property: 'og:title', content: 'Tu tarjeta de lealtad · Joyería Torres Torres' }),
        meta({ property: 'og:description', content: 'Consulta tus puntos, tu nivel y su vigencia.' }),
        meta({ property: 'og:image', content: `${base}vista-previa.jpg` }),
        meta({ property: 'og:image:width', content: '1200' }),
        meta({ property: 'og:image:height', content: '630' }),
        meta({ property: 'og:image:alt', content: 'Torres Torres · Joyería y Relojería' }),
        meta({ name: 'twitter:card', content: 'summary_large_image' }),
      ]
    },
  }
}
