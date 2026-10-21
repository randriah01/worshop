import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// En développement, le dashboard (http://localhost:5173) appelle /api et /auth.
// Vite proxifie ces chemins vers le WAF (nginx) du backend, sur http://localhost:80,
// qui route ensuite vers payment-api et auth-service.
// Adapte la cible si ton backend tourne sur une autre adresse (ex. la VM).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:80', changeOrigin: true },
      '/auth': { target: 'http://localhost:80', changeOrigin: true },
    },
  },
})
