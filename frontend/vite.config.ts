import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api-remote': {
        target: 'https://pub-dev-loop-api.contato-pubcore.workers.dev',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-remote/, ''),
      },
    },
  },
});
