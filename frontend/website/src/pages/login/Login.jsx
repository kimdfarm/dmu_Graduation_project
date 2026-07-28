import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Key, UserPlus, Eye, EyeOff, Edit3 } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!name || !password) {
      alert('아이디와 비밀번호를 모두 입력해 주세요.');
      return;
    }

    setIsLoading(true);

    try {
      // FastAPI /login/login 엔드포인트 호출
      const response = await fetch('http://localhost:8000/login/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name,
          password: password,
        }),
      });

      const data = await response.json();

      if (response.ok && data.status === 'success') {
        // 💾 localStorage에 로그인 유저 정보 저장 (브라우저 닫아도 유지)
        localStorage.setItem('userId', data.user.id);
        localStorage.setItem('user', JSON.stringify(data.user));

        alert(data.message || '로그인에 성공했습니다!');
        
        // 메인 대시보드로 이동
        navigate('/');
      } else {
        alert(data.detail || '로그인 실패: 아이디 또는 비밀번호를 확인해 주세요.');
      }
    } catch (error) {
      console.error('로그인 요청 중 에러 발생:', error);
      alert('서버와의 통신 중 오류가 발생했습니다. FastAPI 서버 상태를 확인해 주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#07051d',
      color: '#ffffff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: 'sans-serif'
    }}>
      <div style={{ width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        
        {/* 로고 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px', justifyContent: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            backgroundColor: '#89c2ff',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#0f0c31'
          }}>
            <Edit3 size={24} />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>DevProfile</h1>
        </div>

        {/* 로그인 폼 카드 */}
        <form onSubmit={handleLogin} style={{
          width: '100%',
          backgroundColor: '#1d1852',
          border: '1px solid rgba(129, 140, 248, 0.2)',
          borderRadius: '24px',
          padding: '24px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          marginBottom: '20px'
        }}>
          <div>
            <input
              type="text"
              placeholder="사용자 이름 (Name)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
              style={{
                width: '100%',
                backgroundColor: '#a2a6f5',
                color: '#111827',
                fontWeight: '600',
                padding: '14px 16px',
                borderRadius: '12px',
                border: 'none',
                outline: 'none',
                boxSizing: 'border-box',
                fontSize: '14px'
              }}
            />
          </div>

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              style={{
                width: '100%',
                backgroundColor: '#a2a6f5',
                color: '#111827',
                fontWeight: '600',
                padding: '14px 40px 14px 16px',
                borderRadius: '12px',
                border: 'none',
                outline: 'none',
                boxSizing: 'border-box',
                fontSize: '14px'
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: '12px',
                background: 'none',
                border: 'none',
                color: '#383377',
                cursor: 'pointer'
              }}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              marginTop: '8px',
              padding: '12px',
              backgroundColor: isLoading ? '#55518a' : '#332a85',
              color: '#ffffff',
              fontWeight: 'bold',
              borderRadius: '16px',
              border: '1px solid rgba(165, 180, 252, 0.3)',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '16px'
            }}
          >
            {isLoading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        {/* 하단 메뉴 */}
        <div style={{
          width: '100%',
          backgroundColor: '#1b174a',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          borderRadius: '16px',
          padding: '12px 8px',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          boxSizing: 'border-box'
        }}>
          <button type="button" onClick={() => alert('ID 찾기')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '32px', height: '32px', backgroundColor: '#493e9e', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e0e7ff' }}>
              <Search size={15} />
            </div>
            <span style={{ fontSize: '11px', color: '#c7d2fe' }}>ID 찾기</span>
          </button>

          <button type="button" onClick={() => alert('비밀번호 찾기')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', items: 'center', gap: '4px' }}>
            <div style={{ width: '32px', height: '32px', backgroundColor: '#493e9e', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e0e7ff' }}>
              <Key size={15} />
            </div>
            <span style={{ fontSize: '11px', color: '#c7d2fe' }}>비밀번호 찾기</span>
          </button>

          <button type="button" onClick={() => alert('회원가입')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', items: 'center', gap: '4px' }}>
            <div style={{ width: '32px', height: '32px', backgroundColor: '#493e9e', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e0e7ff' }}>
              <UserPlus size={15} />
            </div>
            <span style={{ fontSize: '11px', color: '#c7d2fe' }}>회원가입</span>
          </button>
        </div>

      </div>
    </div>
  );
}