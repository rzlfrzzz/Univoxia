import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// Saat dev, teruskan /health ke API lokal di port 4000.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/health': 'http://127.0.0.1:4000' } },
});
