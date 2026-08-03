import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Mail, ShieldCheck, ArrowLeft, Key, CheckCircle, Lock, Eye, EyeOff, 
  Check, X, ShieldAlert 
} from 'lucide-react';

export default function FindPassword() {
  const navigate = useNavigate();

  // 1️⃣ State 정의
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [step, setStep] = useState(1); // 1: 이메일입력, 2: OTP인증, 3: 비밀번호변경, 4: 완료
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // 2️⃣ 🚨 [중요] 비밀번호 유효성 검사 규칙 객체 (rules)
  const rules = {
    length: newPassword.length >= 8 && newPassword.length <= 20,
    hasLetter: /[a-zA-Z]/.test(newPassword),
    hasNumber: /[0-9]/.test(newPassword),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword),
    isMatched: newPassword.length > 0 && newPassword === confirmPassword,
  };

  // 모든 보안 조건 충족 여부
  const isFormValid = rules.length && rules.hasLetter && rules.hasNumber && rules.hasSpecial && rules.isMatched;

  // 3️⃣ [STEP 1] OTP 발송
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
          purpose: 'find_pw',
        }),
      });

      if (response.ok) {
        alert('비밀번호 재설정 인증번호가 이메일로 발송되었습니다.');
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

  // 4️⃣ [STEP 2] OTP 검증
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
          purpose: 'find_pw',
        }),
      });

      if (response.ok) {
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

  // 5️⃣ [STEP 3] 비밀번호 재설정
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!isFormValid) return alert('비밀번호 작성 가이드를 모두 충족해 주세요.');

    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/login/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          new_password: newPassword,
        }),
      });

      if (response.ok) {
        setStep(4);
      } else {
        const data = await response.json().catch(() => ({}));
        setMessage(data.detail || '비밀번호 재설정에 실패했습니다.');
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
            <Key className="w-5 h-5 text-indigo-400" /> 비밀번호 찾기
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
              가입하신 이메일(아이디) 주소를 입력해 주세요.<br />
              본인 확인을 위한 인증번호를 보냅니다.
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

        {/* STEP 2: OTP 번호 입력 */}
        {step === 2 && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="text-center space-y-1">
              <p className="text-xs text-indigo-200/80">
                <span className="text-indigo-400 font-semibold">{email}</span> 로
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

        {/* STEP 3: 새 비밀번호 입력 + 실시간 가이드 */}
        {step === 3 && (
          <form onSubmit={handleResetPassword} className="space-y-5">
            <p className="text-xs text-indigo-200/70 text-center">
              인증이 완료되었습니다.<br />새롭게 사용할 비밀번호를 입력해 주세요.
            </p>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">새 비밀번호</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="8~20자 영문, 숫자, 특수문자 조합"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-[#14103d] border border-indigo-900/60 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-slate-400 hover:text-white transition"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">새 비밀번호 확인</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="password"
                    placeholder="비밀번호 재입력"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-[#14103d] border border-indigo-900/60 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                    required
                  />
                </div>
              </div>
            </div>

            {/* 🛡️ 비밀번호 보안 가이드 (rules 객체 사용) */}
            <div className="p-3.5 bg-[#14103d]/60 border border-indigo-900/50 rounded-xl space-y-2">
              <span className="text-[11px] font-semibold text-indigo-300 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-indigo-400" /> 비밀번호 작성 가이드
              </span>
              <ul className="grid grid-cols-2 gap-1.5 text-[11px]">
                <li className={`flex items-center gap-1 transition ${rules.length ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {rules.length ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                  <span>8자 이상 20자 이내</span>
                </li>
                <li className={`flex items-center gap-1 transition ${rules.hasLetter ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {rules.hasLetter ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                  <span>영문자 포함</span>
                </li>
                <li className={`flex items-center gap-1 transition ${rules.hasNumber ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {rules.hasNumber ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                  <span>숫자 포함</span>
                </li>
                <li className={`flex items-center gap-1 transition ${rules.hasSpecial ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {rules.hasSpecial ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                  <span>특수문자(!@#$%^&*)</span>
                </li>
                <li className={`col-span-2 flex items-center gap-1 transition ${rules.isMatched ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {rules.isMatched ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                  <span>비밀번호 일치</span>
                </li>
              </ul>
            </div>

            <button
              type="submit"
              disabled={loading || !isFormValid}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-950 disabled:text-slate-500 disabled:border disabled:border-indigo-900/40 text-white font-semibold rounded-xl text-sm transition shadow-lg shadow-indigo-600/20 disabled:shadow-none cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? '변경 중...' : '비밀번호 변경하기'}
            </button>
          </form>
        )}

        {/* STEP 4: 변경 완료 */}
        {step === 4 && (
          <div className="space-y-6 text-center">
            <div className="w-12 h-12 bg-indigo-950 border border-indigo-700/50 rounded-full flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-bold text-white">비밀번호 재설정 완료</h2>
              <p className="text-xs text-slate-400">
                비밀번호가 성공적으로 변경되었습니다.<br />새로운 비밀번호로 로그인해 주세요.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate('/login')}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm transition shadow-lg shadow-indigo-600/20"
            >
              로그인 하러가기
            </button>
          </div>
        )}

      </div>
    </div>
  );
}