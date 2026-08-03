import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function CoverLetter() {
  const navigate = useNavigate();
  return (
    <div className="p-8 bg-slate-900 min-h-screen text-white">
      <h1 className="text-3xl font-bold mb-4">✨ AI 자소서 생성 페이지</h1>
      <button 
        onClick={() => navigate('/')} 
        className="px-4 py-2 bg-purple-600 rounded-xl text-white"
      >
        ← 메인 대시보드로 돌아가기
      </button>
    </div>
  );
}