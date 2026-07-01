import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import SignUp from './components/SignUp'; 
import Service from './components/Service';

function App() {
  // 전역으로 관리할 유저 상태 딱 하나만 남겨둡니다.
  const [user, setUser] = useState(null);

  return (
    <Router>
      <Routes>
        {/* URL 주소창에 따라 보여줄 화면을 1대다로 매핑합니다 */}
        <Route path="/login" element={<Login onLoginSuccess={setUser} />} />
        <Route path="/signup" element={<SignUp />} />
        
        {/* 로그인한 유저만 들어오는 공간 (보안 처리) */}
        <Route 
          path="/service" 
          element={user ? <Service user={user} onLogout={() => setUser(null)} /> : <Navigate to="/login" />} 
        />
        
        {/* 처음 들어왔을 때 기본 주소(/)이면 로그인 페이지로 강제 이동 */}
        <Route path="*" element={<Navigate to="/service" />} />
      </Routes>
    </Router>
  );
}

export default App;