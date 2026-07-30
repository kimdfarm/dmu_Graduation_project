import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Phone, Calendar, Camera, ArrowLeft, Save, Shield, CheckCircle } from 'lucide-react';

export default function ProfileSettings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const [formData, setFormData] = useState({
    email: '',
    role: '',
    status: '',
    name: '',
    phone_number: '',
    birth_date: '',
    gender: 'M',
    avatar_url: ''
  });

  // 1. 프로필 조회
  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      alert('로그인이 필요합니다.');
      navigate('/login');
      return;
    }

    const fetchProfile = async () => {
      try {
        const response = await fetch(`http://localhost:8000/users/${userId}`);
        const result = await response.json();

        if (response.ok && result.status === 'success') {
          const data = result.data;
          setFormData({
            email: data.email || '',
            role: data.role || 'USER',
            status: data.status || 'ACTIVE',
            name: data.name || '',
            phone_number: data.phone_number || '',
            birth_date: data.birth_date || '',
            gender: data.gender || 'M',
            avatar_url: data.avatar_url || ''
          });
        }
      } catch (error) {
        console.error('프로필 로딩 에러:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  // 2. 변경사항 저장
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMessage('');

    const userId = localStorage.getItem('userId');

    try {
      const response = await fetch(`http://localhost:8000/users/${userId}/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          phone_number: formData.phone_number,
          birth_date: formData.birth_date,
          gender: formData.gender,
          avatar_url: formData.avatar_url
        })
      });

      if (response.ok) {
        // LocalStorage의 유저 객체 이름 업데이트 (HeaderProfile 반영용)
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
        storedUser.name = formData.name;
        localStorage.setItem('user', JSON.stringify(storedUser));

        setSuccessMessage('프로필이 성공적으로 업데이트되었습니다!');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        alert('프로필 업데이트 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('프로필 저장 에러:', error);
      alert('서버 통신에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07051d] text-white flex items-center justify-center">
        <p className="text-indigo-300 animate-pulse font-medium">프로필 정보를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07051d] text-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-3xl mx-auto">
        
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-8">
          <button 
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition text-sm font-medium"
          >
            <ArrowLeft size={18} />
            <span>대시보드로 돌아가기</span>
          </button>
          <h1 className="text-xl font-bold text-white">회원 프로필 설정</h1>
        </div>

        {/* 성공 토스트 알림 */}
        {successMessage && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-3 text-emerald-400 text-sm font-medium animate-fade-in">
            <CheckCircle size={18} />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-6">
          
          {/* 상단 프로필 배너 카드리 */}
          <div className="bg-[#14103d] border border-indigo-800/40 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-center gap-6 relative overflow-hidden">
            <div className="relative group">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-tr from-indigo-500 to-sky-400 flex items-center justify-center text-3xl font-bold text-white overflow-hidden shadow-lg border-2 border-indigo-400/30">
                {formData.avatar_url ? (
                  <img src={formData.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  formData.name ? formData.name.charAt(0) : 'U'
                )}
              </div>
              <button 
                type="button"
                onClick={() => {
                  const url = prompt('프로필 이미지 URL을 입력하세요:', formData.avatar_url);
                  if (url !== null) setFormData(prev => ({ ...prev, avatar_url: url }));
                }}
                className="absolute -bottom-2 -right-2 p-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white shadow-lg transition"
                title="아바타 변경"
              >
                <Camera size={16} />
              </button>
            </div>

            <div className="flex-1 text-center md:text-left space-y-1">
              <div className="flex items-center justify-center md:justify-start gap-2">
                <h2 className="text-xl font-bold text-white">{formData.name || '이름 미등록'}</h2>
                <span className="px-2.5 py-0.5 text-xs font-semibold bg-indigo-500/20 text-indigo-300 rounded-full border border-indigo-500/30 flex items-center gap-1">
                  <Shield size={12} />
                  {formData.role}
                </span>
              </div>
              <p className="text-slate-400 text-sm">{formData.email}</p>
              <span className="inline-block px-2 py-0.5 text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 rounded-md border border-emerald-500/20 mt-1">
                계정 상태: {formData.status}
              </span>
            </div>
          </div>

          {/* 회원 세부 정보 입력 폼 */}
          <div className="bg-[#14103d] border border-indigo-800/40 rounded-3xl p-6 shadow-xl space-y-5">
            <h3 className="text-md font-semibold text-indigo-200 border-b border-indigo-800/30 pb-3">
              기본 회원 정보
            </h3>

            {/* 본명 */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">이름 (Full Name)</label>
              <div className="relative flex items-center">
                <User size={18} className="absolute left-3.5 text-slate-400" />
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="이름을 입력하세요"
                  className="w-full pl-10 pr-4 py-3 bg-[#0d0a2b] border border-indigo-800/40 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 transition"
                  required
                />
              </div>
            </div>

            {/* 이메일 (읽기 전용) */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">이메일 계정 (Read Only)</label>
              <div className="relative flex items-center">
                <Mail size={18} className="absolute left-3.5 text-slate-500" />
                <input
                  type="email"
                  value={formData.email}
                  disabled
                  className="w-full pl-10 pr-4 py-3 bg-[#09071e] border border-indigo-900/30 rounded-xl text-slate-400 text-sm cursor-not-allowed"
                />
              </div>
            </div>

            {/* 연락처 & 생년월일 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">연락처 (Phone)</label>
                <div className="relative flex items-center">
                  <Phone size={18} className="absolute left-3.5 text-slate-400" />
                  <input
                    type="tel"
                    name="phone_number"
                    value={formData.phone_number}
                    onChange={handleChange}
                    placeholder="010-0000-0000"
                    className="w-full pl-10 pr-4 py-3 bg-[#0d0a2b] border border-indigo-800/40 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">생년월일 (Birth Date)</label>
                <div className="relative flex items-center">
                  <Calendar size={18} className="absolute left-3.5 text-slate-400" />
                  <input
                    type="date"
                    name="birth_date"
                    value={formData.birth_date}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-3 bg-[#0d0a2b] border border-indigo-800/40 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 transition [color-scheme:dark]"
                  />
                </div>
              </div>
            </div>

            {/* 성별 선택 */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">성별 (Gender)</label>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, gender: 'M' }))}
                  className={`flex-1 p-3 rounded-xl border text-sm font-medium transition ${
                    formData.gender === 'M' 
                      ? 'bg-indigo-600/30 border-indigo-500 text-white' 
                      : 'bg-[#0d0a2b] border-indigo-800/40 text-slate-400 hover:border-indigo-700'
                  }`}
                >
                  남성
                </button>

                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, gender: 'F' }))}
                  className={`flex-1 p-3 rounded-xl border text-sm font-medium transition ${
                    formData.gender === 'F' 
                      ? 'bg-indigo-600/30 border-indigo-500 text-white' 
                      : 'bg-[#0d0a2b] border-indigo-800/40 text-slate-400 hover:border-indigo-700'
                  }`}
                >
                  여성
                </button>
              </div>
            </div>

          </div>

          {/* 저장 버튼 */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition transform hover:-translate-y-0.5 disabled:opacity-50"
            >
              <Save size={18} />
              <span>{isSaving ? '저장 중...' : '변경사항 저장'}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}