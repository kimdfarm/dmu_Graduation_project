// src/api.js (React에서는 FastAPI 주소만 연결!)
import axios from 'axios'

export const api = axios.create({
  baseURL: 'http://localhost:8000', // FastAPI 주소
})

// 컴포넌트에서 쓸 때는 백엔드 엔드포인트만 호출
export const getUserData = () => api.get('/api/users')