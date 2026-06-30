import React, { useState } from 'react';
import Login from './components/Login';
import SignUp from './components/SignUp'; 
import Service from './components/Service';

function App() {
  // 현재 화면 제어 스위치 ('login', 'signup', 'service') -> 전부 소문자 약속!
  const [view, setView] = useState('service'); 
  const [user, setUser] = useState(null);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setView('service');
  };

  return (
    <div>
      {/* 1. 로그인 화면 */}
      {view === 'login' && (
        <Login 
          onLoginSuccess={handleLoginSuccess} 
          onGoToSignUp={() => setView('signup')} // 👈 무조건 소문자 signup!
        />
      )}
      
      {/* 2. 회원가입 화면 */}
      {view === 'signup' && (
        <SignUp 
          onSignUpSuccess={() => setView('login')} 
          onGoToLogin={() => setView('login')}     
        />
      )}
      
      {/* 3. 서비스 메인 화면 */}
      {view === 'service' && (
  <Service 
    user={user} 
    onLogout={() => { 
      setUser(null); 
      setView('login'); 
    }} 
    onGoToSignUp={() => setView('signup')} // 👈 이 연결 통로가 적혀있어야 버튼 클릭 시 signup 화면으로 날아갑니다!
  />
)}
    </div>
  );
}

export default App;