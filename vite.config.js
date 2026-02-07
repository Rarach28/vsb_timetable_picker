import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(),],
  base: '/vsb_timetable_picker/',
  server: {
    proxy: {
      '/mapy-api': {
        target: 'https://mapy.vsb.cz',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/mapy-api/, '/maps/api'),
      },
    },
  },
})