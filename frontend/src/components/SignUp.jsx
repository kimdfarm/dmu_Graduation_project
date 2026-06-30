import React, { useState } from 'react';

function SignUp({ onSignUpSuccess, onGoToLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleSignUp = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:8000/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await response.json();

      if (response.ok) {
        alert("회원가입 성공! 로그인해 주세요.");
        onSignUpSuccess(); 
      } else {
        alert(data.detail || "회원가입에 실패했습니다.");
      }
    } catch (error) {
      console.error("회원가입 에러:", error);
      alert("서버와 연결할 수 없습니다.");
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      backgroundColor: '#121214',
      fontFamily: 'sans-serif'
    }}>
      <div style={{
        width: '450px',
        padding: '30px',
        border: '1px solid #767676',
        borderRadius: '8px',
        backgroundColor: '#1a1a1e',
        color: '#ffffff',
        boxSizing: 'border-box'
      }}>
        <h2 style={{ textAlign: 'center', fontSize: '28px', marginBottom: '20px', fontWeight: 'normal' }}>회원가입</h2>
        
        <form onSubmit={handleSignUp}>
          <div style={{ marginBottom: '15px', textAlign: 'center' }}>
            <label style={{ display: 'block', fontSize: '18px', color: '#9bc3cf', marginBottom: '10px' }}>이름</label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              required 
              style={{ width: '100%', padding: '12px', backgroundColor: '#3a3a3a', border: '1px solid #555555', borderRadius: '4px', color: '#ffffff', fontSize: '16px', boxSizing: 'border-box' }} 
            />
          </div>

          <div style={{ marginBottom: '15px', textAlign: 'center' }}>
            <label style={{ display: 'block', fontSize: '18px', color: '#9bc3cf', marginBottom: '10px' }}>이메일</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              style={{ width: '100%', padding: '12px', backgroundColor: '#3a3a3a', border: '1px solid #555555', borderRadius: '4px', color: '#ffffff', fontSize: '16px', boxSizing: 'border-box' }} 
            />
          </div>

          <div style={{ marginBottom: '25px', textAlign: 'center' }}>
            <label style={{ display: 'block', fontSize: '18px', color: '#9bc3cf', marginBottom: '10px' }}>비밀번호</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              style={{ width: '100%', padding: '12px', backgroundColor: '#3a3a3a', border: '1px solid #555555', borderRadius: '4px', color: '#ffffff', fontSize: '16px', boxSizing: 'border-box' }} 
            />
          </div>

          <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#73b364', color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '16px', cursor: 'pointer', marginBottom: '10px' }}>
            가입하기
          </button>

          <button type="button" onClick={onGoToLogin} style={{ width: '100%', padding: '12px', backgroundColor: '#444448', color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '16px', cursor: 'pointer' }}>
            로그인 화면으로 돌아가기
          </button>
        </form>
      </div>
    </div>
  );
}

export default SignUp;