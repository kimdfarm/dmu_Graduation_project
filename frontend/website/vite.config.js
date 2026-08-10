import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/sign': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
      '/api': {
        target: 'http://localhost:8000', // 사용 중인 백엔드 서버 주소 및 포트
        changeOrigin: true,
        secure: false,
      },
      '/login': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
      '/users': {  // 👈 GET /users/{user_id} 프록시 대상 추가
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      }
    },
  },
})