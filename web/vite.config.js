import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// BASE_PATH cambia la carpeta donde vive la página, por ejemplo /torrestorres/
// en GitHub Pages. Sin ella se publica en la raíz del dominio.
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
})
