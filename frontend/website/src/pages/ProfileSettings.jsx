import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import DaumPostcode from 'react-daum-postcode';
import { 
  User, Mail, Phone, Calendar, Camera, ArrowLeft, Save, Shield, CheckCircle,
  GraduationCap, Award, Plus, Trash2, Building, AlertTriangle, UserX, Loader2, X, MapPin,
  Search
} from 'lucide-react';

const Github = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
  </svg>
);

const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID || 'Ov23li4nl4BUypksPeOL'; 
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function ProfileSettings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // 💡 탭 상태 관리 복원 ('basic' | 'education' | 'certificate')
  const [activeTab, setActiveTab] = useState('basic');

  const [isGithubConnected, setIsGithubConnected] = useState(false);
  const [githubData, setGithubData] = useState({ github_id: '', github_avatar_url: '' });

  const [formData, setFormData] = useState({
    email: '',
    role: '',
    status: '',
    name: '',
    phone_number: '',
    birth_date: '',
    gender: 'M',
    address: '',
    detail_address: '',
    avatar_url: ''
  });

  const [educations, setEducations] = useState([]);
  const [newEdu, setNewEdu] = useState({
    school_name: '',
    major: '',
    education_level: '학사',
    status: '졸업',
    admission_date: '',
    graduation_date: '',
  });

  const [certificates, setCertificates] = useState([]);
  const [newCert, setNewCert] = useState({
    certificate_name: '',
    issuing_organization: '',
    certificate_number: '',
    acquisition_date: '',
  });

  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const userId = localStorage.getItem('userId');
  const [isSyncingEmail, setIsSyncingEmail] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);

  const getCookie = (name) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  };

  const handleCompleteAddress = (data) => {
    let fullAddress = data.address;
    let extraAddress = '';

    if (data.addressType === 'R') {
      if (data.bname !== '') extraAddress += data.bname;
      if (data.buildingName !== '') extraAddress += extraAddress !== '' ? `, ${data.buildingName}` : data.buildingName;
      fullAddress += extraAddress !== '' ? ` (${extraAddress})` : '';
    }

    setFormData(prev => ({
      ...prev,
      address: fullAddress
    }));

    setIsAddressModalOpen(false);
  };

  const fetchEducations = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`${API_URL}/api/profile-settings/educations/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setEducations(data);
      }
    } catch (error) {
      console.error('학력 조회 에러:', error);
    }
  };

  const fetchCertificates = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`${API_URL}/api/profile-settings/certificates/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setCertificates(data);
      }
    } catch (error) {
      console.error('자격증 조회 에러:', error);
    }
  };

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      alert('로그인이 필요합니다.');
      navigate('/login');
      return;
    }

    const fetchProfile = async () => {
      try {
        const response = await fetch(`${API_URL}/users/${userId}`);
        
        if (response.ok) {
          const result = await response.json();
          const data = result.data ? result.data : result;

          setFormData({
            email: data.email || '',
            role: data.role || 'USER',
            status: data.status || 'ACTIVE',
            name: data.name || '',
            phone_number: data.phone_number || '',
            birth_date: data.birth_date || '',
            gender: data.gender || 'M',
            address: data.address || '',
            detail_address: data.detail_address || '',
            avatar_url: data.avatar_url || ''
          });
        }
      } catch (error) {
        console.error('프로필 로딩 에러:', error);
      } finally {
        setLoading(false);
      }
    };

    const token = getCookie('github_access_token');
    const savedGithubId = getCookie('github_id') || localStorage.getItem('github_id');
    const savedAvatar = localStorage.getItem('github_avatar_url');

    if (token && savedGithubId) {
      setIsGithubConnected(true);
      setGithubData({
        github_id: savedGithubId,
        github_avatar_url: savedAvatar || ''
      });
    } else {
      setIsGithubConnected(false);
    }

    fetchProfile();
    fetchEducations();
    fetchCertificates();
  }, [navigate]);

  const handleGithubOAuthLogin = () => {
    const CLIENT_ID = GITHUB_CLIENT_ID;
    const REDIRECT_URI = "https://dmu-graduation-project.vercel.app/auth/github/callback";
    const currentPath = window.location.pathname + window.location.search;
    sessionStorage.setItem('redirectAfterGithubAuth', currentPath);

    window.location.href = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=user,repo`;
  };

  const handleAddEdu = async (e) => {
    e.preventDefault();
    if (!newEdu.school_name || !newEdu.major || !newEdu.admission_date) {
      return alert('학교명, 전공, 입학일은 필수 입력 항목입니다.');
    }
    if (!userId) return alert('로그인 정보가 올바르지 않습니다.');

    try {
      const response = await fetch(`${API_URL}/api/profile-settings/educations/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_name: newEdu.school_name,
          major: newEdu.major,
          education_level: newEdu.education_level || '학사',
          status: newEdu.status || '재학',
          admission_date: newEdu.admission_date,
          graduation_date: newEdu.graduation_date || null,
        }),
      });

      if (response.ok) {
        const createdEdu = await response.json();
        setEducations((prev) => [createdEdu, ...prev]);
        setNewEdu({
          school_name: '', major: '', education_level: '학사', status: '재학', admission_date: '', graduation_date: '',
        });
        alert('학력 정보가 추가되었습니다.');
      } else {
        const errData = await response.json();
        alert(`추가 실패: ${errData.detail || '오류 발생'}`);
      }
    } catch (error) {
      console.error('학력 추가 실패:', error);
      alert('서버 통신 오류가 발생했습니다.');
    }
  };

  const handleDeleteEdu = async (educationId) => {
    if (!window.confirm('해당 학력 정보를 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`${API_URL}/api/profile-settings/educations/${educationId}`, {
        method: 'DELETE',
      });

      if (response.status === 204 || response.ok) {
        setEducations((prev) => prev.filter((edu) => edu.id !== educationId));
      } else {
        alert('삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('학력 삭제 실패:', error);
    }
  };

  const handleAddCert = async (e) => {
    e.preventDefault();
    if (!newCert.certificate_name || !newCert.issuing_organization || !newCert.acquisition_date) {
      return alert('자격증명, 발급기관, 취득일은 필수 입력 항목입니다.');
    }
    if (!userId) return alert('로그인 정보가 올바르지 않습니다.');

    try {
      const response = await fetch(`${API_URL}/api/profile-settings/certificates/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          certificate_name: newCert.certificate_name,
          issuing_organization: newCert.issuing_organization,
          certificate_number: newCert.certificate_number || null,
          acquisition_date: newCert.acquisition_date,
        }),
      });

      if (response.ok) {
        const createdCert = await response.json();
        setCertificates((prev) => [createdCert, ...prev]);
        setNewCert({ certificate_name: '', issuing_organization: '', certificate_number: '', acquisition_date: '' });
        alert('자격증 정보가 추가되었습니다.');
      } else {
        const errData = await response.json();
        alert(`추가 실패: ${errData.detail || '오류 발생'}`);
      }
    } catch (error) {
      console.error('자격증 추가 실패:', error);
      alert('서버 통신 오류가 발생했습니다.');
    }
  };

  const handleDeleteCert = async (certificateId) => {
    if (!window.confirm('해당 자격증 정보를 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`${API_URL}/api/profile-settings/certificates/${certificateId}`, {
        method: 'DELETE',
      });

      if (response.status === 204 || response.ok) {
        setCertificates((prev) => prev.filter((cert) => cert.id !== certificateId));
      } else {
        alert('삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('자격증 삭제 실패:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMessage('');

    const userId = localStorage.getItem('userId');

    try {
      const response = await fetch(`${API_URL}/users/${userId}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          name: formData.name,
          phone_number: formData.phone_number,
          birth_date: formData.birth_date,
          gender: formData.gender,
          address: formData.address,
          detail_address: formData.detail_address,
          avatar_url: formData.avatar_url
        })
      });

      if (response.ok) {
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
        storedUser.name = formData.name;
        storedUser.email = formData.email;
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
      <div className="min-h-screen bg-[#060814] text-white flex items-center justify-center">
        <p className="text-indigo-400 animate-pulse font-medium">프로필 정보를 불러오는 중...</p>
      </div>
    );
  }

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      "정말로 회원탈퇴를 진행하시겠습니까?\n모든 데이터가 영구적으로 삭제됩니다."
    );
    if (!confirmed) return;

    try {
      setIsDeleting(true);
      const userId = localStorage.getItem("userId");

      if (!userId) {
        alert("로그인 정보를 찾을 수 없습니다. 다시 로그인해 주세요.");
        return;
      }

      const response = await fetch(`${API_URL}/login/delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || "탈퇴 처리 중 오류가 발생했습니다.");
      }

      localStorage.removeItem("userId");
      localStorage.removeItem("token");
      
      alert("회원탈퇴가 성공적으로 완료되었습니다.");
      navigate("/login");

    } catch (err) {
      console.error("회원탈퇴 실패:", err);
      alert(err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("파일 크기는 5MB 이하만 가능합니다.");
      return;
    }

    try {
      setIsUploading(true);
      const userId = localStorage.getItem("userId");

      if (!userId) {
        alert("사용자 정보를 찾을 수 없습니다.");
        return;
      }

      const uploadFormData = new FormData();
      uploadFormData.append("file", file);
      uploadFormData.append("user_id", userId);

      const response = await fetch(`${API_URL}/login/upload-avatar`, {
        method: "POST",
        body: uploadFormData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || "이미지 업로드에 실패했습니다.");
      }

      setFormData(prev => ({ ...prev, avatar_url: result.avatar_url }));
      alert("프로필 이미지가 변경되었습니다.");

    } catch (err) {
      console.error("업로드 에러:", err);
      alert(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleImageClick = () => {
    if (formData.avatar_url) {
      setIsImageModalOpen(true);
    }
  };
  
  const handleSyncEmail = async () => {
    if (!userId) return alert('로그인 정보가 없습니다.');

    try {
      setIsSyncingEmail(true);
      const response = await fetch(`${API_URL}/users/${userId}/sync-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await response.json();

      if (response.ok) {
        setFormData(prev => ({ ...prev, email: result.email }));
        alert('이메일을 가져와 프로필 DB에 성공적으로 저장했습니다!');
      } else {
        alert(`이메일 조회 실패: ${result.detail || '오류 발생'}`);
      }
    } catch (error) {
      console.error('이메일 동기화 에러:', error);
      alert('서버 통신 중 오류가 발생했습니다.');
    } finally {
      setIsSyncingEmail(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060814] text-slate-100 p-8 md:p-10 font-sans">
      <div className="max-w-4xl mx-auto space-y-10">
        
        {/* 상단 로고 및 뒤로가기 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <button 
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-300 hover:text-white transition text-xs font-semibold shadow-sm"
          >
            <ArrowLeft size={16} />
            <span>대시보드로 돌아가기</span>
          </button>
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-700 via-indigo-600 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-purple-900/40 ring-1 ring-white/10">
              <User className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-lg md:text-xl font-black tracking-wider text-slate-100">
                CAREER <span className="text-purple-400">IT</span>
              </h1>
              <span className="text-[10px] font-semibold tracking-widest text-slate-400 uppercase -mt-0.5">
                Profile Settings
              </span>
            </div>
          </div>
        </div>

        {/* 성공 토스트 알림 */}
        {successMessage && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-3 text-emerald-400 text-sm font-medium animate-fade-in">
            <CheckCircle size={18} />
            <span>{successMessage}</span>
          </div>
        )}

        {/* 상단 프로필 요약 카드 */}
        <div className="bg-[#0f1423] border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-center gap-6 relative overflow-hidden">
          <div className="relative inline-block shrink-0">
            {formData.avatar_url ? (
              <img
                src={formData.avatar_url}
                alt="프로필 이미지"
                onClick={handleImageClick}
                className="w-24 h-24 rounded-full object-cover border-2 border-purple-500/50 shadow-md cursor-pointer hover:brightness-90 hover:scale-[1.02]"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center border-2 border-purple-500/30 shadow-md">
                {formData.name ? <span className="text-3xl font-bold text-white">{formData.name.charAt(0).toUpperCase()}</span> : <User className="w-12 h-12 text-slate-100" />}
              </div>
            )}
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/jpeg, image/png, image/webp" className="hidden" />
            <button
              type="button"
              onClick={handleAvatarClick}
              disabled={isUploading}
              className="absolute -bottom-1 -right-1 p-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white shadow-lg transition disabled:opacity-50 border border-indigo-400/30"
            >
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex-1 text-center md:text-left space-y-1.5">
            <div className="flex items-center justify-center md:justify-start gap-2.5">
              <h2 className="text-xl font-bold text-slate-100">{formData.name || '이름 미등록'}</h2>
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-purple-500/10 text-purple-300 rounded-full border border-purple-500/30 flex items-center gap-1">
                <Shield size={12} /> {formData.role}
              </span>
            </div>
            <p className="text-slate-400 text-sm">{formData.email}</p>
            <span className="inline-block px-2.5 py-0.5 text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 rounded-md border border-emerald-500/20 mt-1">
              계정 상태: {formData.status}
            </span>
          </div>
        </div>

        {/* 💡 탭(Tab) 메뉴 바 복원 */}
        <div className="flex items-center gap-2 p-1.5 bg-[#0b0f19] border border-slate-800 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('basic')}
            className={`flex-1 py-3 px-4 rounded-lg text-xs md:text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'basic' ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <User size={16} /> <span>기본 정보</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('education')}
            className={`flex-1 py-3 px-4 rounded-lg text-xs md:text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'education' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <GraduationCap size={16} /> <span>학력 사항</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('certificate')}
            className={`flex-1 py-3 px-4 rounded-lg text-xs md:text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'certificate' ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Award size={16} /> <span>자격증 및 면허</span>
          </button>
        </div>

        {/* [탭 1] 기본 정보 */}
        {activeTab === 'basic' && (
          <form onSubmit={handleSaveProfile} className="space-y-6">
            <div className="bg-[#0f1423] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
              <h3 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-3">회원 기본 정보</h3>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">이름 (Full Name)</label>
                <div className="relative flex items-center">
                  <User size={18} className="absolute left-3.5 text-slate-400" />
                  <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="이름을 입력하세요" className="w-full pl-10 pr-4 py-3 bg-[#0b0f19] border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-indigo-500 transition" required />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">이메일 계정 (Read Only)</label>
                <div className="relative flex items-center gap-2">
                  <div className="relative flex-1 flex items-center">
                    <Mail size={18} className="absolute left-3.5 text-slate-500" />
                    <input type="email" value={formData.email || ''} readOnly disabled placeholder="이메일 조회를 눌러주세요" className="w-full pl-10 pr-4 py-3 bg-[#0b0f19] border border-slate-800/80 rounded-xl text-slate-400 text-sm cursor-not-allowed" />
                  </div>
                  <button type="button" onClick={handleSyncEmail} disabled={isSyncingEmail} className="px-4 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs rounded-xl shadow-md transition shrink-0 disabled:opacity-50">
                    {isSyncingEmail ? '조회 중...' : '이메일 조회/연동'}
                  </button>
                </div>
              </div>

              {/* GitHub 계정 연동 영역 */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">GitHub 계정 연동</label>
                <div className="flex items-center justify-between p-4 bg-[#0b0f19] border border-slate-800 rounded-xl">
                  <div className="flex items-center gap-3">
                    {isGithubConnected && githubData.github_avatar_url ? (
                      <img src={githubData.github_avatar_url} alt="GitHub Profile" className="w-6 h-6 rounded-full border border-slate-700" />
                    ) : (
                      <Github className="w-5 h-5 text-slate-400" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-slate-200">{isGithubConnected ? `연동됨 (${githubData.github_id})` : 'GitHub 미연동 계정'}</p>
                      <p className="text-xs text-slate-400">{isGithubConnected ? 'GitHub 인증 토큰 및 계정이 정상적으로 연동되었습니다.' : 'GitHub OAuth를 통해 계정을 연동해 주세요.'}</p>
                    </div>
                  </div>
                  <button type="button" onClick={handleGithubOAuthLogin} className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${isGithubConnected ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20' : 'bg-slate-800 hover:bg-slate-700 text-white shadow-md border border-slate-700'}`}>
                    <Github className="w-4 h-4" />
                    <span>{isGithubConnected ? '재연동하기' : 'GitHub 계정 연동하기'}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-2">연락처 (Phone)</label>
                  <div className="relative flex items-center">
                    <Phone size={18} className="absolute left-3.5 text-slate-400" />
                    <input type="tel" name="phone_number" value={formData.phone_number} onChange={handleChange} placeholder="010-0000-0000" className="w-full pl-10 pr-4 py-3 bg-[#0b0f19] border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-cyan-500 transition" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-2">생년월일 (Birth Date)</label>
                  <div className="relative flex items-center">
                    <Calendar size={18} className="absolute left-3.5 text-slate-400" />
                    <input type="date" name="birth_date" value={formData.birth_date} onChange={handleChange} onClick={(e) => e.target.showPicker && e.target.showPicker()} className="w-full pl-10 pr-4 py-3 bg-[#0b0f19] border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-cyan-500 transition [color-scheme:dark] cursor-pointer" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">성별 (Gender)</label>
                <div className="flex gap-4">
                  <button type="button" onClick={() => setFormData(prev => ({ ...prev, gender: 'M' }))} className={`flex-1 p-3 rounded-xl border text-sm font-medium transition ${formData.gender === 'M' ? 'bg-cyan-600 border-cyan-500 text-white shadow-md shadow-cyan-600/20' : 'bg-[#0b0f19] border-slate-800 text-slate-400'}`}>남성</button>
                  <button type="button" onClick={() => setFormData(prev => ({ ...prev, gender: 'F' }))} className={`flex-1 p-3 rounded-xl border text-sm font-medium transition ${formData.gender === 'F' ? 'bg-cyan-600 border-cyan-500 text-white shadow-md shadow-cyan-600/20' : 'bg-[#0b0f19] border-slate-800 text-slate-400'}`}>여성</button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">주소 (Address)</label>
                <div className="relative flex items-center gap-2 mb-2">
                  <div className="relative flex-1 flex items-center">
                    <MapPin size={18} className="absolute left-3.5 text-slate-500" />
                    <input type="text" name="address" value={formData.address || ''} readOnly placeholder="주소 검색 버튼을 눌러주세요" className="w-full pl-10 pr-4 py-3 bg-[#0b0f19] border border-slate-800 rounded-xl text-slate-400 text-sm focus:outline-none" />
                  </div>
                  <button type="button" onClick={() => setIsAddressModalOpen(true)} className="px-4 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 shrink-0">
                    <Search size={15} /> 주소 검색
                  </button>
                </div>
                <input type="text" name="detail_address" value={formData.detail_address || ''} onChange={handleChange} placeholder="상세 주소를 입력하세요" className="w-full px-4 py-3 bg-[#0b0f19] border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-indigo-500 transition" />
              </div>
            </div>

            {isAddressModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                <div className="relative w-full max-w-lg bg-[#0f1423] border border-slate-800 rounded-2xl p-4 shadow-2xl">
                  <div className="flex justify-between items-center pb-3 mb-3 border-b border-slate-800">
                    <h3 className="text-sm font-semibold text-slate-200">주소 검색</h3>
                    <button type="button" onClick={() => setIsAddressModalOpen(false)} className="text-slate-400 hover:text-white"><X size={20} /></button>
                  </div>
                  <DaumPostcode onComplete={handleCompleteAddress} style={{ height: '450px' }} />
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button type="submit" disabled={isSaving} className="flex items-center gap-2 px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-xl shadow-lg shadow-cyan-600/30 transition transform hover:-translate-y-0.5 disabled:opacity-50 text-sm">
                <Save size={18} /> <span>{isSaving ? '저장 중...' : '변경사항 저장'}</span>
              </button>
            </div>
          </form>
        )}

        {/* [탭 2] 학력 사항 */}
        {activeTab === 'education' && (
          <div className="bg-[#0f1423] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-indigo-400">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-100">학력 사항</h2>
                <p className="text-xs text-slate-400">최종 학력 및 재학/졸업 정보를 관리합니다.</p>
              </div>
            </div>

            <div className="space-y-3">
              {educations.map((edu) => (
                <div key={edu.id} className="bg-[#0b0f19] border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm md:text-base text-slate-100">{edu.school_name}</span>
                      <span className="text-xs px-2.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-indigo-300 font-semibold">{edu.education_level} · {edu.status}</span>
                    </div>
                    <p className="text-xs md:text-sm text-slate-300">전공: <span className="text-white font-medium">{edu.major}</span></p>
                    {(edu.admission_date || edu.graduation_date) && (
                      <p className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {edu.admission_date} ~ {edu.graduation_date || '재학 중'}
                      </p>
                    )}
                  </div>
                  <button type="button" onClick={() => handleDeleteEdu(edu.id)} className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition" title="삭제"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddEdu} className="bg-[#0b0f19] p-4 border border-slate-800 rounded-xl space-y-3">
              <h3 className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> 학력 정보 추가</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs md:text-sm">
                <input type="text" placeholder="학교명" value={newEdu.school_name} onChange={(e) => setNewEdu({ ...newEdu, school_name: e.target.value })} className="bg-[#060814] border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-100" />
                <input type="text" placeholder="전공" value={newEdu.major} onChange={(e) => setNewEdu({ ...newEdu, major: e.target.value })} className="bg-[#060814] border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-100" />
                <select value={newEdu.education_level} onChange={(e) => setNewEdu({ ...newEdu, education_level: e.target.value })} className="bg-[#060814] border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-100">
                  <option value="고등학교">고등학교</option>
                  <option value="전문학사">전문학사</option>
                  <option value="학사">학사</option>
                  <option value="석사">석사</option>
                  <option value="박사">박사</option>
                </select>
                <select value={newEdu.status} onChange={(e) => setNewEdu({ ...newEdu, status: e.target.value })} className="bg-[#060814] border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-100">
                  <option value="재학">재학</option>
                  <option value="휴학">휴학</option>
                  <option value="졸업예정">졸업예정</option>
                  <option value="졸업">졸업</option>
                  <option value="중퇴">중퇴</option>
                </select>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-xs shrink-0">입학:</span>
                  <input type="date" value={newEdu.admission_date} onChange={(e) => setNewEdu({ ...newEdu, admission_date: e.target.value })} className="w-full bg-[#060814] border border-slate-800 rounded-xl px-3 py-2 text-slate-100 [color-scheme:dark]" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-xs shrink-0">졸업:</span>
                  <input type="date" value={newEdu.graduation_date} onChange={(e) => setNewEdu({ ...newEdu, graduation_date: e.target.value })} className="w-full bg-[#060814] border border-slate-800 rounded-xl px-3 py-2 text-slate-100 [color-scheme:dark]" />
                </div>
              </div>
              <button type="submit" className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs transition">학력 추가하기</button>
            </form>
          </div>
        )}

        {/* [탭 3] 자격증 및 면허 */}
        {activeTab === 'certificate' && (
          <div className="bg-[#0f1423] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-purple-400">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-100">자격증 및 면허</h2>
                <p className="text-xs text-slate-400">취득한 자격증 정보를 입력해 주세요.</p>
              </div>
            </div>

            <div className="space-y-3">
              {certificates.map((cert) => (
                <div key={cert.id} className="bg-[#0b0f19] border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm md:text-base text-slate-100">{cert.certificate_name}</span>
                      {cert.certificate_number && <span className="text-[11px] text-purple-300 font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800">No. {cert.certificate_number}</span>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-300">
                      {cert.issuing_organization && <span className="flex items-center gap-1"><Building className="w-3 h-3 text-slate-400" /> {cert.issuing_organization}</span>}
                      {cert.acquisition_date && <span className="flex items-center gap-1 text-slate-400"><Calendar className="w-3 h-3" /> 취득: {cert.acquisition_date}</span>}
                    </div>
                  </div>
                  <button type="button" onClick={() => handleDeleteCert(cert.id)} className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition" title="삭제"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddCert} className="bg-[#0b0f19] p-4 border border-slate-800 rounded-xl space-y-3">
              <h3 className="text-xs font-semibold text-purple-300 flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> 자격증 추가</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs md:text-sm">
                <input type="text" placeholder="자격증 명" value={newCert.certificate_name} onChange={(e) => setNewCert({ ...newCert, certificate_name: e.target.value })} className="bg-[#060814] border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-100" />
                <input type="text" placeholder="발급 기관" value={newCert.issuing_organization} onChange={(e) => setNewCert({ ...newCert, issuing_organization: e.target.value })} className="bg-[#060814] border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-100" />
                <input type="text" placeholder="자격증 번호" value={newCert.certificate_number} onChange={(e) => setNewCert({ ...newCert, certificate_number: e.target.value })} className="bg-[#060814] border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-100" />
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-xs shrink-0">취득일:</span>
                  <input type="date" value={newCert.acquisition_date} onChange={(e) => setNewCert({ ...newCert, acquisition_date: e.target.value })} className="w-full bg-[#060814] border border-slate-800 rounded-xl px-3 py-2 text-slate-100 [color-scheme:dark]" />
                </div>
              </div>
              <button type="submit" className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl text-xs transition">자격증 추가하기</button>
            </form>
          </div>
        )}

        {/* 회원 탈퇴 */}
        <div className="pt-4 border-t border-rose-900/40">
          <div className="bg-rose-950/15 border border-rose-900/40 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-rose-400 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> 회원 탈퇴</h3>
              <p className="text-xs text-rose-300/70">계정을 삭제하면 작성한 모든 문서 및 프로필 정보가 완전히 삭제됩니다.</p>
            </div>
            <button type="button" onClick={handleDeleteAccount} disabled={isDeleting} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:bg-rose-900 text-white text-xs font-semibold shadow-lg transition-all shrink-0">
              <UserX className="w-4 h-4" /> <span>{isDeleting ? '탈퇴 처리 중...' : '회원 탈퇴'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}