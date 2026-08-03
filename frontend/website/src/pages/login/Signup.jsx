import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Mail, ShieldCheck, ArrowLeft, User, UserPlus, CheckCircle, 
  Lock, Eye, EyeOff, Check, X, ShieldAlert, AlertCircle 
} from 'lucide-react';

export default function Signup() {
  const navigate = useNavigate();

  // 1️⃣ State 정의
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');

  const [name, setName] = useState(''); // members.name (이름/아이디)
  const [isNameChecked, setIsNameChecked] = useState(false); // 이름 중복확인 여부
  const [nameCheckMsg, setNameCheckMsg] = useState({ text: '', isError: false });

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [step, setStep] = useState(1); // 1: 이메일입력, 2: OTP인증, 3: 이름/비밀번호, 4: 완료
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // 비밀번호 유효성 검사 규칙
  const rules = {
    length: password.length >= 8 && password.length <= 20,
    hasLetter: /[a-zA-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    isMatched: password.length > 0 && password === confirmPassword,
  };

  const isPasswordValid = rules.length && rules.hasLetter && rules.hasNumber && rules.hasSpecial && rules.isMatched;

  // 2️⃣ [STEP 1] OTP 발송
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
          purpose: 'signup',
        }),
      });

      if (response.ok) {
        alert('인증번호가 이메일로 발송되었습니다.');
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

  // 3️⃣ [STEP 2] OTP 검증
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
          purpose: 'signup',
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

  // 4️⃣ 🔍 [STEP 3 - 이름 중복 확인 버튼 핸들러]
  const handleCheckNameDuplicate = async () => {
    if (!name.trim()) {
      setNameCheckMsg({ text: '이름을 입력해 주세요.', isError: true });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/sign/check-name?name=${encodeURIComponent(name)}`);

      if (response.ok) {
        // DB에 name이 존재하지 않을 때 (사용 가능)
        setIsNameChecked(true);
        setNameCheckMsg({ text: '사용 가능한 이름입니다.', isError: false });
      } else {
        // DB에 이미 name이 존재할 때
        const data = await response.json().catch(() => ({}));
        setIsNameChecked(false);
        setNameCheckMsg({ text: data.detail || '이미 사용 중인 이름입니다.', isError: true });
      }
    } catch (error) {
      console.error(error);
      setNameCheckMsg({ text: '중복 확인 중 오류가 발생했습니다.', isError: true });
    } finally {
      setLoading(false);
    }
  };

  // 5️⃣ [STEP 3] 최종 회원가입 요청
  const handleFinalSignup = async (e) => {
    e.preventDefault();
    if (!isNameChecked) return alert('이름 중복 확인을 진행해 주세요.');
    if (!isPasswordValid) return alert('비밀번호 가이드를 모두 충족해 주세요.');

    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/sign/signup-final', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          email: email,
          password: password,
        }),
      });

      if (response.ok) {
        setStep(4);
      } else {
        const data = await response.json().catch(() => ({}));
        setMessage(data.detail || '회원가입 처리에 실패했습니다.');
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
            <UserPlus className="w-5 h-5 text-indigo-400" /> 회원가입
          </h1>
          <div className="w-9" />
        </div>

        {/* 에러 메시지 */}
        {message && (
          <div className="p-3 bg-rose-950/60 border border-rose-800/50 rounded-xl text-xs text-rose-300 text-center">
            {message}
          </div>
        )}

        {/* 📌 [STEP 1] 이메일 입력 및 OTP 발송 */}
        {step === 1 && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">본인 확인 이메일</label>
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
              disabled={loading || !email}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-950 disabled:text-slate-500 disabled:border disabled:border-indigo-900/40 text-white font-semibold rounded-xl text-sm transition shadow-lg shadow-indigo-600/20 disabled:shadow-none cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? '처리 중...' : '인증번호 받기'}
            </button>
          </form>
        )}

        {/* 📌 [STEP 2] OTP 번호 입력 */}
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

        {/* 📌 [STEP 3] 이름 중복 확인 & 비밀번호 설정 */}
        {step === 3 && (
          <form onSubmit={handleFinalSignup} className="space-y-4">
            <p className="text-xs text-indigo-200/80 text-center">
              이메일 인증이 완료되었습니다.<br />사용하실 이름과 비밀번호를 입력해 주세요.
            </p>

            {/* 이름(성함) + 중복 확인 버튼 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">이름 (성함)</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <User className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="홍길동"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setIsNameChecked(false);
                      setNameCheckMsg({ text: '', isError: false });
                    }}
                    className="w-full bg-[#14103d] border border-indigo-900/60 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                    required
                  />
                </div>
                
                <button
                  type="button"
                  onClick={handleCheckNameDuplicate}
                  disabled={loading || !name.trim()}
                  className="px-3.5 text-xs font-semibold bg-indigo-950 hover:bg-indigo-900 border border-indigo-800/60 text-indigo-200 rounded-xl transition disabled:opacity-50 shrink-0 cursor-pointer"
                >
                  중복 확인
                </button>
              </div>

              {/* 중복 확인 메시지 */}
              {nameCheckMsg.text && (
                <p className={`text-[11px] flex items-center gap-1 mt-1 ${nameCheckMsg.isError ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {nameCheckMsg.isError ? <AlertCircle className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                  {nameCheckMsg.text}
                </p>
              )}
            </div>

            {/* 비밀번호 입력 */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">비밀번호</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="8~20자 영문, 숫자, 특수문자 조합"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
                <label className="text-xs font-medium text-slate-300">비밀번호 확인</label>
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

            {/* 🛡️ 비밀번호 작성 가이드 */}
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
              disabled={loading || !isPasswordValid || !isNameChecked}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-950 disabled:text-slate-500 disabled:border disabled:border-indigo-900/40 text-white font-semibold rounded-xl text-sm transition shadow-lg shadow-indigo-600/20 disabled:shadow-none cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? '가입 처리 중...' : '회원가입 완료'}
            </button>
          </form>
        )}

        {/* 📌 [STEP 4] 가입 완료 */}
        {step === 4 && (
          <div className="space-y-6 text-center">
            <div className="w-12 h-12 bg-indigo-950 border border-indigo-700/50 rounded-full flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-bold text-white">회원가입 완료!</h2>
              <p className="text-xs text-slate-400">
                <span className="text-indigo-300 font-semibold">{name}</span>님, 회원가입이 성공적으로 완료되었습니다.<br />
                로그인 페이지로 이동해 주세요.
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