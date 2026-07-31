import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      // 💡 FastAPI의 /sign 엔드포인트 우회 설정
      '/sign': {
        target: 'http://localhost:8000', // 본인의 FastAPI 포트 (기본 8000)
        changeOrigin: true,
        secure: false,
      },
      // 💡 프로필 설정 등 /api 엔드포인트 우회 설정
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },

      // 💡 로그인 엔드포인트 우회 설정
      '/login': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})