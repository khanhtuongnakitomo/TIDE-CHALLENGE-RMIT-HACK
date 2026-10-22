import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

const backendOrigin = process.env.VITE_BACKEND_ORIGIN || 'http://127.0.0.1:3100'

export default defineConfig(({ mode }) => {
  const emitSourcemaps = mode === 'development'

  return {
    base: '/',
    build: {
      sourcemap: emitSourcemaps ? 'inline' : false,
      minify: !emitSourcemaps,
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      host: '127.0.0.1',
      port: parseInt(process.env.PORT || '5173', 10),
      strictPort: false,
      proxy: {
        '/api': {
          target: backendOrigin,
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('origin', backendOrigin)
            })
          },
        },
      },
    },
    preview: {
      host: '127.0.0.1',
      port: parseInt(process.env.PORT || '5173', 10),
    },
  }
})
