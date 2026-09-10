import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 5173,
    strictPort: true
  },
  plugins: [react()],
  build: {
    // Vite already defaults to this — made explicit so it's a documented decision, not an
    // implicit default someone could flip on later without noticing.
    sourcemap: false,
  },
})
