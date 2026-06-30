import React from 'react';

// 👈 App.jsx에서 관리하는 세팅에 맞춰 onGoToSignUp을 매개변수로 명확히 받습니다.
function Service({ user, onLogout, onGoToSignUp }) {
  return (
    <div style={{ 
      padding: '20px', 
      textAlign: 'center', 
      color: '#ffffff', 
      backgroundColor: '#121214', 
      minHeight: '100vh',
      fontFamily: 'sans-serif'
    }}>
      {/* 상단 헤더 영역 */}
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        borderBottom: '1px solid #333', 
        paddingBottom: '10px' 
      }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'normal' }}>서비스 메인 공간</h2>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* 유저 정보 출력 (이름이 없으면 유저님으로 대체) */}
          <span style={{ marginRight: '5px', fontWeight: 'bold', fontSize: '16px' }}>
            {user?.username ? `${user.username}님` : '유저님'} 환영합니다!
          </span>

          {/* ⚡ 테스트를 위해 추가된 회원가입 이동 버튼 */}
          <button 
            type="button"
            onClick={onGoToSignUp} 
            style={{ 
              padding: '8px 15px', 
              backgroundColor: '#444448', 
              color: '#ffffff', 
              border: 'none', 
              borderRadius: '4px', 
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px'
            }}
          >
            회원가입하러 가기
          </button>

          {/* 로그아웃 버튼 */}
          <button 
            onClick={onLogout} 
            style={{ 
              padding: '8px 15px', 
              backgroundColor: '#f44336', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px', 
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px'
            }}
          >
            로그아웃
          </button>
        </div>
      </header>

      {/* 메인 콘텐츠 영역 */}
      <main style={{ marginTop: '60px' }}>
        <h3 style={{ fontSize: '22px', marginBottom: '15px' }}>여기에 실제 졸업 작품의 핵심 기능을 구현합니다!</h3>
        <p style={{ color: '#aaaaaa', fontSize: '16px' }}>백엔드 API와 캐스팅하여 다양한 데이터를 받아보세요.</p>
      </main>
    </div>
  );
}

export default Service;