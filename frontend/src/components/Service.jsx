import React from 'react';
import { useNavigate } from 'react-router-dom';

function Service({ user, onLogout }) {
  const navigate = useNavigate();

  const handleLogoutClick = () => {
    onLogout();
    navigate('/login'); // 로그아웃 하면 로그인 주소로 튕겨내기
  };

  return (
    <div style={{ padding: '20px', textAlign: 'center', color: '#ffffff', backgroundColor: '#121214', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'normal' }}>서비스 메인 공간</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ marginRight: '5px', fontWeight: 'bold', fontSize: '16px' }}>
            {user?.username ? `${user.username}님` : '유저님'} 환영합니다!
          </span>
          <button type="button" onClick={() => navigate('/signup')} style={{ padding: '8px 15px', backgroundColor: '#444448', color: '#ffffff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
            회원가입하러 가기
          </button>
          <button onClick={handleLogoutClick} style={{ padding: '8px 15px', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
            로그아웃
          </button>
        </div>
      </header>

      <main style={{ marginTop: '60px' }}>
        <h3 style={{ fontSize: '22px', marginBottom: '15px' }}>여기에 실제 졸업 작품의 핵심 기능을 구현합니다!</h3>
        <p style={{ color: '#aaaaaa', fontSize: '16px' }}>백엔드 API와 매핑하여 다양한 데이터를 받아보세요.</p>
      </main>
    </div>
  );
}

export default Service;