// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/record': 'http://localhost:5050',
              '/feed':   'http://localhost:5050',},
  },
})
