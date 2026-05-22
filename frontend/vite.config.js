import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  assetsInclude: ['**/*.PNG'], // <--- ADD THIS LINE
  server: {
    host: '0.0.0.0',
    port: 3001,
    allowedHosts: ['getasew'],
    proxy: {
      '/api': {
        target: 'http://Getasew:6000',
        changeOrigin: true
      }
    }
  }
})
