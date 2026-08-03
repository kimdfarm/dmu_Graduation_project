import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, ShieldCheck, ArrowLeft, Search, CheckCircle, User } from 'lucide-react';

export default function FindId() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [foundName, setFoundName] = useState(''); // 💡 찾은 사용자 이름 저장
  const [message, setMessage] = useState('');

  // 1️⃣ OTP 발송 요청
  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!email) return alert('이메일을 입력해 주세요.');

    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/sign/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          purpose: 'find_id',
        }),
      });

      if (response.ok) {
        setStep(2);
      } else {
        const data = await response.json().catch(() => ({}));
        setMessage(data.detail || `요청 실패 (에러 코드: ${response.status})`);
      }
    } catch (error) {
      console.error(error);
      setMessage('서버와의 통신 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 2️⃣ OTP 검증 및 사용자 이름 수신
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!token) return alert('인증번호를 입력해 주세요.');

    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/sign/emailok', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          token: token,
          purpose: 'find_id',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // 💡 백엔드의 user_info.name 값을 꺼내오도록 수정
        const userName = data.user_info?.name || '회원';
        
        setFoundName(userName); 
        setStep(3);
      } else {
        const data = await response.json().catch(() => ({}));
        setMessage(data.detail || '인증번호가 올바르지 않거나 만료되었습니다.');
      }
    } catch (error) {
      console.error(error);
      setMessage('서버와의 통신 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09071d] text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0f0c2e]/80 border border-indigo-800/40 rounded-2xl p-8 shadow-2xl space-y-6 backdrop-blur-md">
        
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-indigo-900/50 pb-4">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="p-2 text-slate-400 hover:text-white bg-indigo-950/50 border border-indigo-800/40 rounded-xl transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold flex items-center gap-2 text-white">
            <Search className="w-5 h-5 text-indigo-400" /> 아이디 찾기
          </h1>
          <div className="w-9" />
        </div>

        {/* 에러 메시지 */}
        {message && (
          <div className="p-3 bg-rose-950/60 border border-rose-800/50 rounded-xl text-xs text-rose-300 text-center">
            {message}
          </div>
        )}

        {/* STEP 1: 이메일 입력 */}
        {step === 1 && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <p className="text-xs text-indigo-200/70 text-center">
              가입 시 등록했던 이메일 주소를 입력해 주세요.<br />
              인증번호를 발송해 드립니다.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">이메일 주소</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                <input
                  type="email"
                  placeholder="example@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#14103d] border border-indigo-900/60 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 text-white font-semibold rounded-xl text-sm transition shadow-lg shadow-indigo-600/20"
            >
              {loading ? '발송 중...' : '인증번호 받기'}
            </button>
          </form>
        )}

        {/* STEP 2: OTP 입력 */}
        {step === 2 && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="text-center space-y-1">
              <p className="text-xs text-indigo-200/80">
                <span className="text-indigo-400 font-semibold">{email}</span> 번호로
              </p>
              <p className="text-xs text-slate-400">발송된 6자리 인증번호를 입력해 주세요.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">인증번호 (OTP)</label>
              <div className="relative">
                <ShieldCheck className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="인증번호 입력"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="w-full bg-[#14103d] border border-indigo-900/60 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition tracking-widest font-mono"
                  required
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-1/3 py-3 bg-indigo-950/60 border border-indigo-800/40 text-slate-300 hover:text-white rounded-xl text-sm transition"
              >
                재시도
              </button>
              <button
                type="submit"
                disabled={loading}
                className="w-2/3 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 text-white font-semibold rounded-xl text-sm transition shadow-lg shadow-indigo-600/20"
              >
                {loading ? '확인 중...' : '인증 완료'}
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: 회원 이름 출력 완료 */}
        {step === 3 && (
          <div className="space-y-6 text-center">
            <div className="w-12 h-12 bg-indigo-950 border border-indigo-700/50 rounded-full flex items-center justify-center mx-auto text-indigo-400">
              <CheckCircle className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <p className="text-xs text-slate-400">본인인증이 완료되었습니다.</p>
              <div className="bg-[#14103d] border border-indigo-800/40 p-4 rounded-xl space-y-1">
                <span className="text-xs text-indigo-300 flex items-center justify-center gap-1">
                  <User className="w-3.5 h-3.5" /> 가입된 회원 성함
                </span>
                <span className="text-lg font-bold text-white tracking-wide block">
                  {foundName} 님
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate('/login')}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm transition shadow-lg shadow-indigo-600/20"
            >
              로그인 페이지로 이동
            </button>
          </div>
        )}

      </div>
    </div>
  );
}