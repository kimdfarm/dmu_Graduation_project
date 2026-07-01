import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom'; // 👈 주소 이동 안테나 로드

function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate(); // 👈 이동 함수 정의

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:8000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();

      if (response.ok) {
        alert("로그인 성공!");
        onLoginSuccess(data.user); 
        navigate('/service'); // ⚡ 1대1 연결 없이 바로 서비스 주소로 슝 이동!
      } else {
        alert(data.detail || "로그인에 실패했습니다.");
      }
    } catch (error) {
      console.error("로그인 에러:", error);
      alert("서버와 연결할 수 없습니다.");
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#121214', fontFamily: 'sans-serif' }}>
      <div style={{ width: '450px', padding: '30px', border: '1px solid #767676', borderRadius: '8px', backgroundColor: '#1a1a1e', color: '#ffffff', boxSizing: 'border-box' }}>
        <h2 style={{ textAlign: 'center', fontSize: '28px', marginBottom: '20px', fontWeight: 'normal' }}>로그인</h2>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '15px', textAlign: 'center' }}>
            <label style={{ display: 'block', fontSize: '18px', color: '#9bc3cf', marginBottom: '10px' }}>이메일</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: '12px', backgroundColor: '#3a3a3a', border: '1px solid #555555', borderRadius: '4px', color: '#ffffff', fontSize: '16px', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: '25px', textAlign: 'center' }}>
            <label style={{ display: 'block', fontSize: '18px', color: '#9bc3cf', marginBottom: '10px' }}>비밀번호</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%', padding: '12px', backgroundColor: '#3a3a3a', border: '1px solid #555555', borderRadius: '4px', color: '#ffffff', fontSize: '16px', boxSizing: 'border-box' }} />
          </div>
          <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#73b364', color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '16px', cursor: 'pointer' }}>로그인</button>
        </form>
        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '14px', color: '#aaaaaa' }}>
          아직 계정이 없으신가요?{' '}
          <span onClick={() => navigate('/signup')} style={{ color: '#73b364', cursor: 'pointer', textDecoration: 'underline', fontWeight: 'bold', marginLeft: '5px' }}>
            회원가입하기
          </span>
        </div>
      </div>
    </div>
  );
}

export default Login;