
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  Camera, 
  ArrowLeft, 
  Save, 
  Shield, 
  CheckCircle,
  GraduationCap, 
  Award, 
  Plus, 
  Trash2, 
  Building ,
  AlertTriangle,
  UserX, Loader2, X
} from 'lucide-react';

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

const fetchEducations = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/profile-settings/educations/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setEducations(data);
      }
    } catch (error) {
      console.error('학력 조회 에러:', error);
    }
  };

  // 자격증 목록 조회
  const fetchCertificates = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/profile-settings/certificates/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setCertificates(data);
      }
    } catch (error) {
      console.error('자격증 조회 에러:', error);
    }
  };

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
        
        if (response.ok) {
          const result = await response.json();

          // 백엔드가 { status: 'success', data: {...} } 형태이든, 
          // 또는 유저 객체 {...} 를 직접 반환하든 둘 다 대응할 수 있도록 처리합니다.
          const data = result.data ? result.data : result;

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
        } else {
          console.error('프로필 요청 실패 Status:', response.status);
        }
      } catch (error) {
        console.error('프로필 로딩 에러:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
    fetchEducations();
    fetchCertificates();
  }, [navigate]);

const handleEduChange = (e) => {
    const { name, value } = e.target;
    setNewEdu((prev) => ({ ...prev, [name]: value }));
  };

  // 자격증 입력폼 바인딩
  const handleCertChange = (e) => {
    const { name, value } = e.target;
    setNewCert((prev) => ({ ...prev, [name]: value }));
  };
  // ---------------------------------------------------------------------------
  // 🎓 학력 CRUD (handleAddEdu, handleDeleteEdu)
  // ---------------------------------------------------------------------------
  const handleAddEdu = async (e) => {
    e.preventDefault();
    if (!newEdu.school_name || !newEdu.major || !newEdu.admission_date) {
      return alert('학교명, 전공, 입학일은 필수 입력 항목입니다.');
    }
    if (!userId) return alert('로그인 정보가 올바르지 않습니다.');

    try {
      const response = await fetch(`/api/profile-settings/educations/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_name: newEdu.school_name,
          major: newEdu.major,
          education_level: newEdu.education_level || '학사',
          status: newEdu.status || '재학',
          admission_date: newEdu.admission_date, // YYYY-MM-DD
          graduation_date: newEdu.graduation_date || null,
        }),
      });

      if (response.ok) {
        const createdEdu = await response.json();
        setEducations((prev) => [createdEdu, ...prev]);
        setNewEdu({
          school_name: '',
          major: '',
          education_level: '학사',
          status: '재학',
          admission_date: '',
          graduation_date: '',
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
      const response = await fetch(`/api/profile-settings/educations/${educationId}`, {
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

  // ---------------------------------------------------------------------------
  // 📜 자격증 CRUD (handleAddCert, handleDeleteCert)
  // ---------------------------------------------------------------------------
const handleAddCert = async (e) => {
    e.preventDefault();
    
    // 💡 DB DDL의 NOT NULL 조건에 맞춘 검증 (자격증명, 발급기관, 취득일 필수)
    if (!newCert.certificate_name || !newCert.issuing_organization || !newCert.acquisition_date) {
      return alert('자격증명, 발급기관, 취득일은 필수 입력 항목입니다.');
    }
    if (!userId) return alert('로그인 정보가 올바르지 않습니다.');

    try {
      const response = await fetch(`/api/profile-settings/certificates/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          certificate_name: newCert.certificate_name,
          issuing_organization: newCert.issuing_organization, // 필수
          certificate_number: newCert.certificate_number || null,
          acquisition_date: newCert.acquisition_date, // 필수 (YYYY-MM-DD)
        }),
      });

      if (response.ok) {
        const createdCert = await response.json();
        setCertificates((prev) => [createdCert, ...prev]);
        setNewCert({
          certificate_name: '',
          issuing_organization: '',
          certificate_number: '',
          acquisition_date: '',
        });
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
      const response = await fetch(`/api/profile-settings/certificates/${certificateId}`, {
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
// ---------------------------------------------------------------------------

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

// 💡 supabase import 제거!

const handleDeleteAccount = async () => {
  const confirmed = window.confirm(
    "정말로 회원탈퇴를 진행하시겠습니까?\n모든 데이터가 영구적으로 삭제됩니다."
  );
  if (!confirmed) return;

  try {
    setIsDeleting(true);

    // 1. 로그인 시 localStorage나 Context/State에 저장해둔 userId 사용
    // (예: localStorage.getItem('userId') 또는 세션 객체에서 가져오기)
    const userId = localStorage.getItem("userId") || session?.user?.id;

    if (!userId) {
      alert("로그인 정보를 찾을 수 없습니다. 다시 로그인해 주세요.");
      return;
    }

    // 2. FastAPI 백엔드로 바로 탈퇴 요청
    const response = await fetch("http://localhost:8000/login/delete", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.detail || "탈퇴 처리 중 오류가 발생했습니다.");
    }

    // 3. 로컬 저장소 정돈 및 로그인 페이지로 이동
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
// 버튼 클릭 시 파일 선택 창 열기
  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  // 사용자가 파일을 선택했을 때 실행되는 업로드 함수
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 이미지 용량 및 확장자 1차 체크 (5MB 제한)
    if (file.size > 5 * 1024 * 1024) {
      alert("파일 크기는 5MB 이하만 가능합니다.");
      return;
    }

    try {
      setIsUploading(true);
      const userId = localStorage.getItem("userId") || session?.user?.id;

      if (!userId) {
        alert("사용자 정보를 찾을 수 없습니다.");
        return;
      }

      // FormData 객체 생성 (파일 + user_id)
      const uploadFormData = new FormData();
      uploadFormData.append("file", file);
      uploadFormData.append("user_id", userId);

      // FastAPI 업로드 API 호출
      const response = await fetch("http://localhost:8000/login/upload-avatar", {
        method: "POST",
        body: uploadFormData, // multipart/form-data 전송 시 headers 설정 생략
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || "이미지 업로드에 실패했습니다.");
      }

      // 업로드 완료 후 반환받은 Public URL을 state에 반영
      setFormData(prev => ({ ...prev, avatar_url: result.avatar_url }));
      alert("프로필 이미지가 변경되었습니다.");

    } catch (err) {
      console.error("업로드 에러:", err);
      alert(err.message);
    } finally {
      setIsUploading(false);
    }
  };


  // 모달 열기 핸들러
  const handleImageClick = () => {
    if (formData.avatar_url) {
      setIsImageModalOpen(true);
    }
  };


  return (
    <div className="min-h-screen bg-[#07051d] text-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-4xl mx-auto p-6 space-y-8 text-slate-100">
        
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
            <div className="relative inline-block">
      <div className="relative inline-block">
      {formData.avatar_url ? (
        /* 1. 업로드된 아바타 이미지가 있을 때 */
        <img
  src={formData.avatar_url}
  alt="프로필 이미지"
  onClick={handleImageClick}
  /* 💡 Tailwind 클래스 수정/추출 */
  className="w-24 h-24 rounded-full object-cover border-2 border-indigo-500 shadow-md 
             cursor-pointer transition-all duration-150 ease-in-out
             hover:brightness-90 hover:scale-[1.02]
             active:scale-95 active:border-indigo-600 active:shadow-inner"
  title="원본 크기로 보기"
/>
      ) : (
        /* 2. 이미지가 없을 때: 깔끔한 기본 아이콘 Placeholder */
        <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center border-2 border-indigo-400/50 shadow-md">
          {formData.name ? (
            /* 이름이 있으면 첫 글자 이니셜 표시 */
            <span className="text-3xl font-bold text-white">
              {formData.name.charAt(0).toUpperCase()}
            </span>
          ) : (
            /* 이름도 없으면 기본 사람 아이콘 표시 */
            <User className="w-12 h-12 text-indigo-100" />
          )}
        </div>
      )}

      {/* 숨겨진 파일 선택 Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/jpeg, image/png, image/webp"
        className="hidden"
      />

      {/* 아바타 변경 버튼 */}
      <button
        type="button"
        onClick={handleAvatarClick}
        disabled={isUploading}
        className="absolute -bottom-1 -right-1 p-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white shadow-lg transition disabled:opacity-50 border border-indigo-400/30"
        title="아바타 변경"
      >
        {isUploading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Camera className="w-4 h-4" />
        )}
      </button>
    </div>
    {isImageModalOpen && (
      <div 
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in"
        onClick={() => setIsImageModalOpen(false)} // 배경 클릭 시 닫기
      >
        <div 
          className="relative p-4 flex flex-col items-center"
          onClick={(e) => e.stopPropagation()} // 이미지 영역 클릭 시 안 닫히게 방지
        >
          {/* 닫기 버튼 */}
          <button
            onClick={() => setIsImageModalOpen(false)}
            className="absolute -top-12 right-2 text-white/70 hover:text-white p-2 rounded-full bg-white/10"
          >
            <X className="w-6 h-6" />
          </button>

          {/* 원본 비율 유지 확대 이미지 (모서리만 둥글게) */}
          <img
            src={formData.avatar_url}
            alt="프로필 원본 이미지"
            className="max-w-[85vw] max-h-[85vh] rounded-3xl object-contain border-4 border-white/10 shadow-2xl"
          />
          
          {formData.name && (
            <p className="mt-5 text-indigo-100 text-xl font-bold tracking-tight bg-black/40 px-4 py-1.5 rounded-xl">
              {formData.name} 원본 프로필
            </p>
          )}
        </div>
      </div>
    )}
    </div>

            <div className="flex-1 text-center md:text-left space-y-1">
              <div className="flex items-center justify-center md:justify-start gap-2">
                <h2 className="text-xl font-bold text-white">{formData.name || '이름 미등록 돌아가서 로그인 하시오'}</h2>
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
      <div className="max-w-4xl mx-auto p-6 space-y-8 text-slate-100">

      {/* =================================================================== */}
      {/* 1. 기존 프로필 기본 정보 설정 영역 (기존 작성된 JSX 컴포넌트 유지) */}
      {/* =================================================================== */}

      {/* =================================================================== */}
      {/* 2. 🎓 학력 (Educations) 섹션 추가 */}
      {/* =================================================================== */}
      <div className="bg-[#0f0c2e]/80 border border-indigo-800/40 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex items-center gap-3 border-b border-indigo-900/50 pb-4">
          <div className="p-2.5 bg-indigo-950 border border-indigo-800/40 rounded-xl text-indigo-400">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold">학력 사항</h2>
            <p className="text-xs text-indigo-200/60">최종 학력 및 재학/졸업 정보를 관리합니다.</p>
          </div>
        </div>

        {/* 학력 목록 */}
        <div className="space-y-3">
          {educations.map((edu) => (
            <div
              key={edu.id}
              className="bg-[#14103d]/60 border border-indigo-900/40 rounded-xl p-4 flex items-center justify-between hover:border-indigo-700/50 transition-all"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base text-white">{edu.school_name}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-indigo-950 border border-indigo-700/40 text-indigo-300">
                    {edu.education_level} · {edu.status}
                  </span>
                </div>
                <p className="text-xs md:text-sm text-indigo-200/70">
                  전공: <span className="text-white font-medium">{edu.major}</span>
                </p>
                {(edu.admission_date || edu.graduation_date) && (
                  <p className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {edu.admission_date} ~ {edu.graduation_date || '재학 중'}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleDeleteEdu(edu.id)}
                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition"
                title="삭제"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* 학력 추가 입력폼 */}
        <form onSubmit={handleAddEdu} className="bg-[#0b0824]/50 p-4 border border-indigo-950 rounded-xl space-y-3">
          <h3 className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> 학력 정보 추가
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs md:text-sm">
            <input
              type="text"
              placeholder="학교명 (예: 한국대학교)"
              value={newEdu.school_name}
              onChange={(e) => setNewEdu({ ...newEdu, school_name: e.target.value })}
              className="bg-[#120e36] border border-indigo-900/60 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <input
              type="text"
              placeholder="전공 (예: 컴퓨터공학과)"
              value={newEdu.major}
              onChange={(e) => setNewEdu({ ...newEdu, major: e.target.value })}
              className="bg-[#120e36] border border-indigo-900/60 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <select
              value={newEdu.education_level}
              onChange={(e) => setNewEdu({ ...newEdu, education_level: e.target.value })}
              className="bg-[#120e36] border border-indigo-900/60 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="고등학교">고등학교</option>
              <option value="전문학사">전문학사</option>
              <option value="학사">학사</option>
              <option value="석사">석사</option>
              <option value="박사">박사</option>
            </select>
            <select
              value={newEdu.status}
              onChange={(e) => setNewEdu({ ...newEdu, status: e.target.value })}
              className="bg-[#120e36] border border-indigo-900/60 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="재학">재학</option>
              <option value="휴학">휴학</option>
              <option value="졸업예정">졸업예정</option>
              <option value="졸업">졸업</option>
              <option value="중퇴">중퇴</option>
            </select>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-xs flex-shrink-0">입학:</span>
              <input
                type="date"
                value={newEdu.admission_date}
                onChange={(e) => setNewEdu({ ...newEdu, admission_date: e.target.value })}
                className="w-full bg-[#120e36] border border-indigo-900/60 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-xs flex-shrink-0">졸업:</span>
              <input
                type="date"
                value={newEdu.graduation_date}
                onChange={(e) => setNewEdu({ ...newEdu, graduation_date: e.target.value })}
                className="w-full bg-[#120e36] border border-indigo-900/60 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs transition shadow-md shadow-indigo-600/20"
          >
            학력 추가하기
          </button>
        </form>
      </div>

      {/* =================================================================== */}
      {/* 3. 📜 자격증 (Certificates) 섹션 추가 */}
      {/* =================================================================== */}
      <div className="bg-[#0f0c2e]/80 border border-indigo-800/40 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex items-center gap-3 border-b border-indigo-900/50 pb-4">
          <div className="p-2.5 bg-indigo-950 border border-indigo-800/40 rounded-xl text-purple-400">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold">자격증 및 면허</h2>
            <p className="text-xs text-indigo-200/60">취득한 자격증 정보를 입력해 주세요.</p>
          </div>
        </div>

        {/* 자격증 목록 */}
        <div className="space-y-3">
          {certificates.map((cert) => (
            <div
              key={cert.id}
              className="bg-[#14103d]/60 border border-indigo-900/40 rounded-xl p-4 flex items-center justify-between hover:border-indigo-700/50 transition-all"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base text-white">{cert.certificate_name}</span>
                  {cert.certificate_number && (
                    <span className="text-[11px] text-indigo-300 font-mono bg-indigo-950 px-2 py-0.5 rounded border border-indigo-800/40">
                      No. {cert.certificate_number}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-indigo-200/70">
                  {cert.issuing_organization && (
                    <span className="flex items-center gap-1">
                      <Building className="w-3 h-3" /> {cert.issuing_organization}
                    </span>
                  )}
                  {cert.acquisition_date && (
                    <span className="flex items-center gap-1 text-slate-400">
                      <Calendar className="w-3 h-3" /> 취득: {cert.acquisition_date}
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleDeleteCert(cert.id)}
                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition"
                title="삭제"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* 자격증 추가 입력폼 */}
        <form onSubmit={handleAddCert} className="bg-[#0b0824]/50 p-4 border border-indigo-950 rounded-xl space-y-3">
          <h3 className="text-xs font-semibold text-purple-300 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> 자격증 추가
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs md:text-sm">
            <input
              type="text"
              placeholder="자격증 명 (예: 정보처리기사)"
              value={newCert.certificate_name}
              onChange={(e) => setNewCert({ ...newCert, certificate_name: e.target.value })}
              className="bg-[#120e36] border border-indigo-900/60 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
            <input
              type="text"
              placeholder="발급 기관 (예: 한국산업인력공단)"
              value={newCert.issuing_organization}
              onChange={(e) => setNewCert({ ...newCert, issuing_organization: e.target.value })}
              className="bg-[#120e36] border border-indigo-900/60 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
            <input
              type="text"
              placeholder="자격증 번호/합격 번호 (선택)"
              value={newCert.certificate_number}
              onChange={(e) => setNewCert({ ...newCert, certificate_number: e.target.value })}
              className="bg-[#120e36] border border-indigo-900/60 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-xs flex-shrink-0">취득일:</span>
              <input
                type="date"
                value={newCert.acquisition_date}
                onChange={(e) => setNewCert({ ...newCert, acquisition_date: e.target.value })}
                className="w-full bg-[#120e36] border border-indigo-900/60 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl text-xs transition shadow-md shadow-purple-600/20"
          >
            자격증 추가하기
          </button>
        </form>
      </div>
       <div className="mt-10 pt-6 border-t border-rose-900/40">
        <div className="bg-rose-950/20 border border-rose-900/40 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              회원 탈퇴
            </h3>
            <p className="text-xs text-rose-300/70">
              계정을 삭제하면 작성한 모든 문서 및 프로필 정보가 완전히 삭제됩니다.
            </p>
          </div>

          {/* 탈퇴 버튼 */}
          <button
            onClick={handleDeleteAccount}
            disabled={isDeleting}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:bg-rose-900 text-white text-xs font-semibold shadow-lg shadow-rose-900/30 transition-all flex-shrink-0"
          >
            <UserX className="w-4 h-4" />
            <span>{isDeleting ? '탈퇴 처리 중...' : '회원 탈퇴'}</span>
          </button>
        </div>
      </div>

    </div>
    </div>
    
  );
}