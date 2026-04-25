import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    conditions: ['@tanstack/custom-condition'],
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate vendor chunk — cached independently of app code.
          // Stays unchanged across most deploys → browser reuses the cached copy.
          vendor: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
