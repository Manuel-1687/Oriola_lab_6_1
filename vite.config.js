import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    cors: {
      origin: 'https://api-tester.marasigan.dev',
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1',
        changeOrigin: true,
        headers: { Host: 'Ocampo_LAB6.test' },
      },
    },
  },
});
