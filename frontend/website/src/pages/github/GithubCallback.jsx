import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';

export default function GithubCallback() {
  const navigate = useNavigate();
  const isFetched = useRef(false); 
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    if (isFetched.current) return;

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (!code) {
      setErrorMessage('GitHub 인증 코드가 전달되지 않았습니다.');
      return;
    }

    isFetched.current = true;

    const sendCodeToBackend = async () => {
      try {
        const userId = localStorage.getItem('userId');

        const response = await fetch('http://localhost:8000/api/auth/github/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            code: code,
            user_id: userId 
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || '백엔드 인증 처리에 실패했습니다.');
        }

        const data = await response.json();

        // 쿠키 및 localStorage 저장 로직...
        if (data.access_token) {
        document.cookie = `github_access_token=${data.access_token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
        }
        if (data.github_id) {
        document.cookie = `github_id=${data.github_id}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
        localStorage.setItem('github_id', data.github_id);
        }
        if (data.github_avatar_url) {
        localStorage.setItem('github_avatar_url', data.github_avatar_url);
        }

        alert('GitHub 계정이 성공적으로 연동되었습니다!');

        // 💡 저장해둔 이전 페이지 경로 읽기 (없으면 기본값 '/profileSettings')
        const redirectPath = sessionStorage.getItem('redirectAfterGithubAuth') || '/profileSettings';

        // 사용한 sessionStorage 데이터 삭제
        sessionStorage.removeItem('redirectAfterGithubAuth');

        // 저장된 이전 페이지 경로로 이동
        navigate(redirectPath, { replace: true });

      } catch (error) {
        console.error('GitHub Auth Callback Error:', error);
        setErrorMessage(error.message || '백엔드 인증 처리 중 오류가 발생했습니다.');
      }
    };

    sendCodeToBackend();
  }, [navigate]);

  if (errorMessage) {
    return (
      <div className="min-h-screen bg-[#07051d] text-white flex flex-col items-center justify-center p-4">
        <div className="bg-[#14103d] border border-rose-500/30 rounded-3xl p-8 max-w-md w-full text-center space-y-4 shadow-2xl">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-xl font-bold text-rose-400">연동 실패</h2>
          <p className="text-sm text-slate-300">{errorMessage}</p>
          <button
            onClick={() => navigate('/profileSettings')}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition shadow-lg shadow-indigo-600/30"
          >
            프로필 페이지로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07051d] text-white flex flex-col items-center justify-center">
      <Loader2 className="w-10 h-10 animate-spin text-indigo-400 mb-4" />
      <p className="text-indigo-200 text-sm font-medium">GitHub 인증 정보 처리 중...</p>
    </div>
  );
}