import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Resume from './pages/Resume';
import CoverLetter from './pages/CoverLetter';
import Login from './pages/login/Login'; // 추가
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 메인 대시보드 (1) */}
        <Route path="/" element={<Dashboard />} />
        
        {/* 서브 페이지들 (N) */}
        <Route path="/login" element={<Login />} />
        <Route path="/resume" element={<Resume />} />
        <Route path="/cover-letter" element={<CoverLetter />} />
      </Routes>
    </BrowserRouter>
  );
}