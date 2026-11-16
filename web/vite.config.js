import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// En desarrollo, Vite sirve el frontend y reenvía /api al backend (Express). Así el navegador ve un único origen
// y la cookie httpOnly del refresh token funciona sin configuración adicional de CORS.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': process.env.VITE_API_TARGET ?? 'http://localhost:4000' } },
  test: { environment: 'jsdom', setupFiles: ['./src/test-setup.js'], globals: true },
});
