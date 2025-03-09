import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  root: '.',
  base: '/',
  server: {
    port: 5173,
    strictPort: true,
    host: true
  }
});