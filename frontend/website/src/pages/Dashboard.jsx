import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Home, FileText, UserCheck, Sparkles, Settings, 
  Trash2, Plus, Menu, File, ExternalLink, LogIn, LogOut , X
} from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  // 사이드바 선택 상태
  const [activeNav, setActiveNav] = useState('home');
  // 문서 필터 탭 (전체 / 이력서 / 자소서)
  const [filter, setFilter] = useState('all');
  const [user, setUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  const [userAvatar, setUserAvatar] = useState('');
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('전체');


  const sidebarItems = [
    { id: 'home', label: '홈', icon: Home, path: '/' },
    { id: 'resume', label: '이력서', icon: FileText, path: '/resume' },
    { id: 'coverletter', label: '자소서', icon: UserCheck, path: '/cover-letter' },
    { id: 'ai_cover', label: '채용', icon: Sparkles, path: '/cover-letter' },
  ];

  const docList = [
    { id: 1, type: 'resume', title: '이력서 1', category: '개발자 직군', desc: '최종 수정일: 2026.07.25 · 백엔드/프론트엔드 역량 강조', path: '/resume' },
    { id: 2, type: 'coverletter', title: '자소서 1', category: '지원동기', desc: '최종 수정일: 2026.07.20 · AI 생성 지원동기 및 프로젝트 경험', path: '/cover-letter' },
    { id: 3, type: 'resume', title: '이력서 2', category: '인턴십용', desc: '최종 수정일: 2026.07.18 · 학부 졸업작품 프로젝트 위주', path: '/resume' },
  ];

  // 필터링 로직
  const filteredDocs = docList.filter(doc => {
    if (filter === 'resume') return doc.type === 'resume';
    if (filter === 'coverletter') return doc.type === 'coverletter';
    return true;
  });

// Dashboard.jsx

useEffect(() => {
  const loadUserProfile = async () => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      // 💡 백엔드가 8000번 포트에서 실행 중이므로 전체 주소를 명시해 줍니다.
      //const res = await fetch(`http://127.0.0.1:8000/users/${userId}`);
      
      // 만약 /login/me 엔드포인트를 쓰신다면:
      const res = await fetch(`http://127.0.0.1:8000/login/me?user_id=${userId}`);

      if (res.ok) {
        const data = await res.json();

        // State에 유저 이름 넣기
        setUserName(data.name);
        setUserEmail(data.email);
        setUserAvatar(data.avatar_url);
        setIsLoggedIn(true);
      } else {
        console.error("HTTP 에러 Status:", res.status);
      }
    } catch (err) {
      console.error("유저 정보 로드 에러:", err);
    } finally {
      setLoading(false);
    }
  };

  loadUserProfile();
}, []);
// 로그아웃 처리 함수
  const handleLogout = () => {
    if (window.confirm('로그아웃 하시겠습니까?')) {
      localStorage.removeItem('userId');
      localStorage.removeItem('user');
      setIsLoggedIn(false);
      setUserName('게스트');
      setUserEmail('');
      navigate('/login');
    }
  };

  const handleLogoutSilently = () => {
    localStorage.removeItem('userId');
    localStorage.removeItem('user');
    setIsLoggedIn(false);
    setUserName('게스트');
    setUserEmail('');
  };
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  // 모달 열기/닫기 토글
  const handleImageClick = () => {
    if (isLoggedIn && userAvatar) {
      setIsImageModalOpen(true);
    }
  };

  // user가 없거나 name이 없을 때 안전하게 처리
  const userInitial = user?.name ? user.name.charAt(0) : '게';
  return (
    <div className="flex h-screen bg-[#09081e] text-slate-100 font-sans overflow-hidden">
      
      {/* 1. 좌측 사이드바 */}
      <aside className="w-20 bg-[#121033] border-r border-indigo-900/30 flex flex-col items-center py-6 gap-6 z-10">
        <button className="p-3 text-indigo-300 hover:text-white hover:bg-indigo-900/40 rounded-2xl transition">
          <Menu size={22} />
        </button>

        <nav className="flex flex-col gap-3 mt-4 w-full px-2">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isSelected = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveNav(item.id);
                  if(item.path !== '/') navigate(item.path);
                }}
                className={`flex flex-col items-center justify-center py-3.5 rounded-2xl transition-all duration-200 ${
                  isSelected
                    ? 'bg-gradient-to-b from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-indigo-950/50'
                }`}
              >
                <Icon size={20} />
                <span className="text-[11px] mt-1.5 font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* 2. 메인 콘텐츠 영역 */}
      <div className="flex-1 flex flex-col p-8 overflow-y-auto max-w-6xl mx-auto w-full">
        
        {/* 상단 프로필 헤더 */}
        {/* 1. 메인 인사말 배너 (프로필 동그라미 & 톤앤매너) */}
{/* 메인 인사말 배너 (프로필 설정 & 로그아웃/로그인 버튼 추가) */}
<div className="bg-[#0f0c2e]/80 border border-indigo-800/40 rounded-2xl p-5 md:p-6 shadow-xl mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
  
  {/* 왼쪽: 아바타 + 인사말 */}
  <div className="flex items-center gap-4">
    {/* 프로필 아바타 동그라미 */}
    <div className="relative flex-shrink-0">
  {isLoggedIn && userAvatar ? (
    /* 1. 로그인 상태이고 이미지 URL이 있는 경우 (클릭 시 확대) */
    <img
      src={userAvatar}
      alt="프로필 이미지"
      onClick={handleImageClick}
      className="w-12 h-12 md:w-14 md:h-14 rounded-full object-cover shadow-md shadow-indigo-500/20 ring-2 ring-indigo-400/30 cursor-pointer hover:scale-105 transition-transform duration-200"
      title="프로필 이미지 크게 보기"
    />
  ) : (
    /* 2. 이미지가 없거나 비로그인 상태일 때 이니셜/G 표시 */
    <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg md:text-xl shadow-md shadow-indigo-500/20 ring-2 ring-indigo-400/30">
      {isLoggedIn ? (userName ? userName.charAt(0) : 'D') : 'G'}
    </div>
  )}

  {/* 온라인 상태 점 */}
  <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-[#0f0c2e] ${isLoggedIn ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>

  {/* 온라인 상태 점 */}
  <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-[#0f0c2e] ${isLoggedIn ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
</div>
{/* --- 프로필 이미지 확대 모달 --- */}
{isImageModalOpen && (
  <div 
    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in"
    onClick={() => setIsImageModalOpen(false)} // 배경 클릭 시 닫기
  >
    <div 
      className="relative max-w-sm md:max-w-xl w-full p-6 flex flex-col items-center"
      onClick={(e) => e.stopPropagation()} // 이미지 영역 클릭 시엔 안 닫히게 방지
    >
      {/* 우측 상단 닫기 버튼 */}
      <button
        onClick={() => setIsImageModalOpen(false)}
        className="absolute top-0 right-0 p-2 text-white/70 hover:text-white transition"
      >
        <X className="w-7 h-7" />
      </button>

      {/* 💡 둥근 테두리 해제 (rounded-full -> rounded-3xl로 변경) */}
      <img
        src={userAvatar}
        alt="프로필 원본 이미지"
        className="max-w-[80vw] max-h-[80vh] w-auto h-auto rounded-3xl object-contain border-4 border-white/10 shadow-2xl shadow-black/50"
      />

      {/* 이름 표시 */}
      {userName && (
        <p className="mt-5 text-indigo-100 text-xl font-bold tracking-tight bg-black/40 px-4 py-1.5 rounded-xl">
          {userName} 프로필 원본
        </p>
      )}
    </div>
  </div>
)}
    {/* 텍스트 정보 */}
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
          isLoggedIn 
            ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300' 
            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          {isLoggedIn ? 'Welcome Back' : 'Guest Mode'}
        </span>
      </div>

      <h2 className="text-lg md:text-xl font-bold text-white tracking-tight flex items-center gap-1.5">
        안녕하세요, <span className={isLoggedIn ? "text-indigo-300 font-extrabold" : "text-rose-300 font-extrabold"}>
          {isLoggedIn ? `${userName} 님` : '게스트 님'}
        </span>! 👋
      </h2>

      <p className="text-xs md:text-sm font-medium text-indigo-200/70">
        {isLoggedIn 
          ? '오늘 작성할 이력서와 자소서를 확인하고 관리해 보세요.' 
          : '모든 기능과 저장 기능을 이용하시려면 로그인이 필요합니다.'}
      </p>
    </div>
  </div>

  {/* 오른쪽: 프로필 설정 & 로그아웃 / 로그인 버튼 */}
  <div className="flex items-center gap-2 self-end md:self-center">
    {isLoggedIn ? (
      <>
        {/* 프로필 설정 버튼 */}
        <button
          onClick={() => navigate('/ProfileSettings')}
          title="프로필 설정"
          className="p-2.5 rounded-xl bg-indigo-950/60 border border-indigo-800/50 text-indigo-300 hover:text-white hover:bg-indigo-900/60 transition-all shadow-sm"
        >
          <Settings className="w-5 h-5" />
        </button>

        {/* 로그아웃 버튼 */}
        <button
          onClick={handleLogout} // 기존 로그아웃 함수 연결
          title="로그아웃"
          className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-rose-950/30 border border-rose-800/40 text-rose-300 hover:text-white hover:bg-rose-900/50 transition-all text-xs font-semibold shadow-sm"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">로그아웃</span>
        </button>
      </>
    ) : (
      /* 게스트 모드일 때 로그인 버튼 */
      <button
        onClick={() => navigate('/login')}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all text-xs font-semibold shadow-md shadow-indigo-600/30"
      >
        <LogIn className="w-4 h-4" />
        <span>로그인 하기</span>
      </button>
    )}
  </div>

</div>

{/* 2. 탭 메뉴 & 생성 버튼 영역 (복구 완료!) */}


        {/* 3. 문서 리스트 헤더 & 필터 탭 */}


      {/* 2. Main Banner (메인 영역) */}
      <main className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        
        {/* 탭 메뉴 (전체 / 이력서 / 자소서) */}
        <div className="flex items-center gap-1.5 p-1 bg-[#0d0a2b] border border-indigo-900/50 rounded-xl w-fit">
          {[
            { label: '전체', value: 'all' },
            { label: '이력서', value: 'resume' },
            { label: '자소서', value: 'coverletter' },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={`px-4 py-2 rounded-lg text-xs md:text-sm font-semibold transition-all ${
                filter === tab.value
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-indigo-200 hover:bg-indigo-950/40'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 새로 만들기 버튼 */}
        <button 
          onClick={() => navigate('/editor/new')}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs md:text-sm font-semibold rounded-xl shadow-lg shadow-indigo-600/20 transition transform hover:-translate-y-0.5"
        >
          <Plus className="w-4 h-4" />
          <span>새 문서 만들기</span>
        </button>
      </div>
      </main>


        {/* 4. 문서 카드 리스트 */}
        <div className="space-y-4">
        {filteredDocs.length > 0 ? (
          filteredDocs.map((doc) => (
            <div
              key={doc.id}
              onClick={() => navigate(doc.path)}
              className="group bg-[#120d36]/70 border border-indigo-900/40 hover:border-indigo-500/50 rounded-2xl p-5 transition-all duration-200 hover:shadow-lg hover:shadow-indigo-900/20 flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-4">
                {/* 카드 아이콘 */}
                <div className="w-12 h-12 rounded-xl bg-indigo-950/80 border border-indigo-800/40 flex items-center justify-center group-hover:bg-indigo-600 transition-colors">
                  <FileText className="w-6 h-6 text-indigo-300 group-hover:text-white" />
                </div>

                {/* 문서 정보 */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors">
                      {doc.title}
                    </h3>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-indigo-950 border border-indigo-700/50 text-indigo-300">
                      {doc.category}
                    </span>
                  </div>
                  <p className="text-xs md:text-sm text-indigo-200/60 font-medium">
                    {doc.desc}
                  </p>
                </div>
              </div>

              {/* 액션 버튼 그룹 */}
              <div className="flex items-center gap-2 text-indigo-400/60 opacity-80 group-hover:opacity-100">
                <button 
                  onClick={(e) => { e.stopPropagation(); /* 설정 로직 */ }}
                  className="p-2 hover:bg-indigo-900/40 hover:text-white rounded-lg transition"
                >
                  <Settings className="w-4 h-4" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); /* 삭제 로직 */ }}
                  className="p-2 hover:bg-rose-950/40 hover:text-rose-400 rounded-lg transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        ) : (
          /* 선택한 필터에 문서가 없는 경우 */
          <div className="text-center py-12 border border-dashed border-indigo-900/40 rounded-2xl bg-[#0d0a2b]/40">
            <p className="text-indigo-300/60 text-sm">해당하는 문서가 없습니다.</p>
          </div>
        )}
      </div>

      </div>
    </div>
  );
}