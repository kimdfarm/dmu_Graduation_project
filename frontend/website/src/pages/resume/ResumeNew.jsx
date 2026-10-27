import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FilePlus, ArrowLeft, Loader2, Sparkles, Plus, Trash2, Upload, FileText, X, Globe, 
  Columns, Table, CheckCircle2, Star, Lock, Search, Check, 
  Calendar, Clock, GitCommit
} from 'lucide-react';

import { FRAME_TEMPLATES } from '../../templates/resumeTemplates';
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const GithubIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);

const getCookie = (name) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
};

const ResumeNew = () => {
  const navigate = useNavigate();

  const [createMode, setCreateMode] = useState('MANUAL');
  const [selectedFrame, setSelectedFrame] = useState('KR_DEV_BACKEND');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('신입 개발자');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [fileTypeBadge, setFileTypeBadge] = useState({ label: '문서', color: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/40' });
  const [isDragging, setIsDragging] = useState(false);

  const [sections, setSections] = useState(FRAME_TEMPLATES.KR_DEV_BACKEND?.sections || []);
  const [customSectionTitle, setCustomSectionTitle] = useState('');
  const [columnInput, setColumnInput] = useState('');
  const [customColumnsList, setCustomColumnsList] = useState(['제목/역할', '참여 기간', '상세 업무 및 성과']);

  // GitHub 연동 및 다중 선택 전용 상태
  const [githubUser, setGithubUser] = useState(null);
  const [repositories, setRepositories] = useState([]);

  const [repoSearchKeyword, setRepoSearchKeyword] = useState('');
  const [isFetchingRepos, setIsFetchingRepos] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);

  const [extractionTime, setExtractionTime] = useState('');

  const [selectedRepos, setSelectedRepos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  
  const [searchMode, setSearchMode] = useState('relative');
  
  const [years, setYears] = useState(0);
  const [months, setMonths] = useState(6);

  const getInitialDates = () => {
    const today = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(today.getMonth() - 6);
    return {
      start: sixMonthsAgo.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0]
    };
  };

  const initialDates = getInitialDates();
  const [startDate, setStartDate] = useState(initialDates.start);
  const [endDate, setEndDate] = useState(initialDates.end);

  const [activeFilterText, setActiveFilterText] = useState('최근 6개월 기준 탐색 결과');

  const handleSearch = () => {
    let activeStart = startDate;
    let activeEnd = endDate;

    if (searchMode === 'relative') {
      const totalMonths = (parseInt(years, 10) || 0) * 12 + (parseInt(months, 10) || 0);
      const validMonths = totalMonths > 0 ? totalMonths : 1;

      const today = new Date();
      const pastDate = new Date();
      pastDate.setMonth(today.getMonth() - validMonths);

      activeEnd = today.toISOString().split('T')[0];
      activeStart = pastDate.toISOString().split('T')[0];

      setStartDate(activeStart);
      setEndDate(activeEnd);

      const label = years > 0 ? `최근 ${years}년 ${months}개월` : `최근 ${months}개월`;
      setActiveFilterText(`${label} 기준 탐색 결과`);
    } else {
      setActiveFilterText(`${startDate} ~ ${endDate} 상세 기간 탐색 결과`);
    }

    fetchUserRepositories(githubUser, null, { 
      startDate: activeStart, 
      endDate: activeEnd 
    });
  };

  const handleDirectGenerateResume = async () => {
    if (selectedRepos.length === 0) {
      alert("분석할 저장소를 1개 이상 선택해 주세요.");
      return;
    }

    const userId = localStorage.getItem('userId');
    const githubId = getCookie('github_id') || localStorage.getItem('github_id') || githubUser;

    if (!userId || !githubId) {
      alert('GitHub 계정 연동 정보가 올바르지 않습니다. 다시 로그인해 주세요.');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');

      const token = getCookie('github_access_token') || localStorage.getItem('github_access_token');

      setLoadingText(`${selectedRepos.length}개 저장소 데이터 분석 중...`);
      const analyzePromises = selectedRepos.map(repoName => 
        fetch(`${BASE_URL}/api/github/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            github_id: String(githubId),
            repo_name: String(repoName),
            start_date: startDate || "",
            end_date: endDate || "",
            extraction_time: extractionTime || ""
          })
        }).then(async res => {
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            const detailMsg = errorData.detail || `분석 실패 (${res.status})`;
            throw new Error(`[${repoName}] ${detailMsg}`);
          }
          return res.json();
        })
      );
      const results = await Promise.all(analyzePromises);

      setLoadingText("AI 이력서 카드 생성 중...");
      const generateRes = await fetch(`${BASE_URL}/api/resumes/github-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: userId,
          title: title.trim() || `github 저장소 기반 기술 이력서`,
          category: category,
          repo_name: selectedRepos.join(', '),
          analysis_data: { projects_data: results }
        })
      });

      if (!generateRes.ok) {
        const errorData = await generateRes.json();
        throw new Error(errorData.detail || 'GitHub 이력서 자동 생성에 실패했습니다.');
      }

      const result = await generateRes.json();

      if (result && result.id) {
        navigate(`/resume/${result.id}`);
      }

    } catch (error) {
      console.error("원클릭 이력서 생성 실패:", error);
      alert(error.message || "이력서 생성 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
      setLoadingText('');
    }
  };

  useEffect(() => {
    if (createMode === 'GITHUB' && githubUser) {
      const today = new Date();
      const pastDate = new Date();
      pastDate.setMonth(today.getMonth() - 6);

      const initialEnd = today.toISOString().split('T')[0];
      const initialStart = pastDate.toISOString().split('T')[0];

      setStartDate(initialStart);
      setEndDate(initialEnd);
      setActiveFilterText('최근 6개월 기준 탐색 결과');

      fetchUserRepositories(githubUser, null, { 
        startDate: initialStart, 
        endDate: initialEnd 
      });
    }

    if (FRAME_TEMPLATES[selectedFrame]) {
      setSections([...FRAME_TEMPLATES[selectedFrame].sections]);
    }
  }, [selectedFrame, createMode, githubUser]);

  const handleSelectGithubMode = () => {
    const token = getCookie('github_access_token') || localStorage.getItem('github_access_token');
    const githubId = getCookie('github_id') || localStorage.getItem('github_id');

    if (!token || !githubId) {
      alert('GitHub 계정이 연동되어 있지 않습니다. 연동 페이지로 이동합니다.');
      const currentPath = window.location.pathname + window.location.search;
      sessionStorage.setItem('redirectAfterGithubAuth', currentPath);
      navigate('/profileSettings');
      return;
    }

    setCreateMode('GITHUB');
    setGithubUser(githubId);
  };

  const fetchUserRepositories = async (targetUser, targetToken, customFilters = {}) => {
    const user = targetUser || githubUser || getCookie('github_id') || localStorage.getItem('github_id');
    const token = targetToken || getCookie('github_access_token') || localStorage.getItem('github_access_token');

    if (!user) return;

    try {
      setIsFetchingRepos(true);
      setErrorMessage('');

      const activeStartDate = customFilters.startDate !== undefined ? customFilters.startDate : startDate;
      const activeEndDate = customFilters.endDate !== undefined ? customFilters.endDate : endDate;

      const params = new URLSearchParams({ github_id: user });
      if (activeStartDate) params.append('start_date', activeStartDate);
      if (activeEndDate) params.append('end_date', activeEndDate);

      const res = await fetch(`${BASE_URL}/api/github/repositories?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });

      if (!res.ok) throw new Error('저장소 목록을 불러오지 못했습니다.');

      const data = await res.json();
      const repoList = data.repositories || (Array.isArray(data) ? data : []);

      setRepositories(repoList);
      setSelectedRepos([]);
    } catch (err) {
      console.error("저장소 조회 에러:", err);
      setErrorMessage(err.message);
    } finally {
      setIsFetchingRepos(false);
    }
  };

  const toggleRepoSelection = (repoName) => {
    setSelectedRepos((prev) =>
      prev.includes(repoName)
        ? prev.filter((name) => name !== repoName)
        : [...prev, repoName]
    );
  };

  const handleSelectAllRepos = () => {
    if (selectedRepos.length === filteredRepositories.length) {
      setSelectedRepos([]);
    } else {
      setSelectedRepos(filteredRepositories.map(r => r.full_name || r.name));
    }
  };

  const filteredRepositories = repositories
    .filter((repo) => {
      if (!repo || !repo.name) return false;
      const keyword = repoSearchKeyword.toLowerCase();
      const nameMatch = repo.name.toLowerCase().includes(keyword);
      const descMatch = repo.description ? repo.description.toLowerCase().includes(keyword) : false;
      return nameMatch || descMatch;
    })
    .filter((repo, index, self) =>
      index === self.findIndex((r) => 
        (r.id && repo.id) ? r.id === repo.id : (r.full_name || r.name) === (repo.full_name || repo.name)
      )
    );

  const categoryOptions = ['신입 개발자', '경력직 개발자', '인턴십 / 프로젝트', '기타 / 자유 양식'];
  const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'hwp', 'hwpx', 'txt', 'rtf', 'png', 'jpg', 'jpeg', 'webp', 'bmp', 'heic', 'heif', 'tiff'];

  const handleAddColumnTag = () => {
    const trimmed = columnInput.trim();
    if (!trimmed) return;
    if (customColumnsList.includes(trimmed)) {
      alert('이미 존재해 있는 컬럼 항목입니다.');
      return;
    }
    setCustomColumnsList(prev => [...prev, trimmed]);
    setColumnInput('');
  };

  const handleRemoveColumnTag = (indexToRemove) => {
    setCustomColumnsList(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleAddSection = () => {
    if (!customSectionTitle.trim()) { alert('섹션 이름을 입력해 주세요.'); return; }
    if (customColumnsList.length === 0) { alert('최소 하나 이상의 컬럼을 추가해 주세요.'); return; }
    setSections(prev => [
      ...prev,
      { type: 'CUSTOM', title: `${prev.length + 1}. ${customSectionTitle.trim()}`, columns: [...customColumnsList] }
    ]);
    setCustomSectionTitle('');
    setCustomColumnsList(['제목/역할', '참여 기간', '상세 업무 및 성과']);
    setColumnInput('');
  };

  const handleDeleteSection = (index) => {
    setSections(prev => prev.filter((_, i) => i !== index));
  };

  const handleFileSelect = (file) => {
    if (!file) return;
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (!fileExt || !ALLOWED_EXTENSIONS.includes(fileExt)) {
      alert(`지원하지 않는 파일 형식입니다. (${fileExt})`);
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      alert('파일 용량은 최대 20MB까지 업로드 가능합니다.');
      return;
    }
    setSelectedFile(file);
    if (['png', 'jpg', 'jpeg', 'webp', 'bmp', 'heic', 'heif'].includes(fileExt) || file.type.startsWith('image/')) {
      setFileTypeBadge({ label: fileExt.toUpperCase(), color: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/40' });
      const reader = new FileReader();
      reader.onloadend = () => setFilePreview(reader.result);
      reader.readAsDataURL(file);
    } else {
      setFileTypeBadge({ label: fileExt.toUpperCase(), color: 'bg-teal-950/80 text-teal-300 border-teal-800/40' });
      setFilePreview(null);
    }
  };

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => { setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) { alert('이력서 제목을 입력해 주세요.'); return; }
    const userId = localStorage.getItem('userId');
    if (!userId) { alert('로그인이 필요합니다.'); navigate('/login'); return; }

    try {
      setIsLoading(true);
      setErrorMessage('');

      if (createMode === 'GITHUB') {
        if (selectedRepos.length === 0) {
          alert('분석할 저장소를 1개 이상 선택해 주세요.');
          setIsLoading(false);
          return;
        }

        const requestData = {
          member_id: userId,
          title: title.trim(),
          category: category,
          repo_name: selectedRepos.join(', '),
          analysis_data: analysisResult
        };
        const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
        const response = await fetch(`${API_URL}/api/resumes/github-generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestData),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'GitHub 데이터 기반 이력서 생성에 실패했습니다.');
        }

        const result = await response.json();
        if (result && result.id) navigate(`/resume/${result.id}`);

      } else if (createMode === 'UPLOAD') {
        if (!selectedFile) { alert('분석할 이력서 파일이나 이미지를 등록해 주세요.'); setIsLoading(false); return; }

        const formData = new FormData();
        formData.append('member_id', userId);
        formData.append('title', title.trim());
        formData.append('category', category);
        formData.append('file', selectedFile);

        const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
        const response = await fetch(`${API_URL}/api/resumes/upload`, { method: 'POST', body: formData });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || '파일 기반 이력서 파싱에 실패했습니다.');
        }
        const result = await response.json();
        if (result && result.id) navigate(`/resume/${result.id}`);

      } else {
        if (sections.length === 0) { alert('최소 1개 이상의 섹션이 필요합니다.'); setIsLoading(false); return; }

        const formattedSections = sections.map((sec, idx) => ({
          section_type: sec.type || 'CUSTOM',
          section_title: sec.title,
          columns: sec.columns || ['항목', '내용'],
          display_order: idx + 1
        }));

        const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
        const response = await fetch(`${API_URL}/api/resumes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ member_id: userId, title: title.trim(), category, custom_sections: formattedSections }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || '이력서 생성에 실패했습니다.');
        }

        const result = await response.json();
        if (result && result.id) navigate(`/resume/${result.id}`);
      }

    } catch (err) {
      console.error('이력서 생성 에러:', err);
      const msg = err.message || '서버와의 통신에 실패했습니다.';
      setErrorMessage(msg);
      alert(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '-';
    const yy = String(d.getFullYear()).slice(2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}.${mm}.${dd}`;
  };

  return (
    <div className="min-h-screen bg-[#070b19] text-slate-100 flex items-start justify-center p-6 md:p-10 font-sans overflow-y-auto">
      <div className="w-full max-w-4xl bg-[#0f152d] border border-emerald-950/60 rounded-3xl p-6 md:p-10 shadow-2xl space-y-8 my-6 relative">
        
        {/* 상단 헤더 & 돌아가기 */}
        <div className="flex items-center justify-between border-b border-emerald-950/60 pb-5">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-emerald-300 transition-colors px-3 py-1.5 rounded-xl bg-[#0a1024] border border-emerald-950/80"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>돌아가기</span>
          </button>
          
          <span className="text-[11px] font-bold px-3 py-1 bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 rounded-full">
            Resume Builder
          </span>
        </div>

        {/* 타이틀 영역 */}
        <div className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-2.5 tracking-tight">
            <FilePlus className="w-7 h-7 text-emerald-400" />
            새 이력서 만들기
          </h1>
          <p className="text-xs md:text-sm text-slate-400">
            원하는 생성 방식을 선택해 손쉽게 완성도 높은 AI 이력서를 자동 생성해 보세요.
          </p>
        </div>

        {/* 모드 전환 탭 (에메랄드/민트 브랜드 톤앤매너 적용) */}
        <div className="grid grid-cols-3 gap-2 p-1.5 bg-[#0a1024] border border-emerald-950/80 rounded-2xl text-xs font-semibold shadow-inner">
          <button
            type="button"
            onClick={() => setCreateMode('MANUAL')}
            className={`py-3 rounded-xl transition-all duration-200 ${
              createMode === 'MANUAL'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 font-bold'
                : 'text-slate-400 hover:text-emerald-200 hover:bg-emerald-950/30'
            }`}
          >
            프레임 & 컬럼 구성
          </button>
          <button
            type="button"
            onClick={() => setCreateMode('UPLOAD')}
            className={`py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 ${
              createMode === 'UPLOAD'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 font-bold'
                : 'text-slate-400 hover:text-emerald-200 hover:bg-emerald-950/30'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>파일/이미지 업로드</span>
          </button>
          <button
            type="button"
            onClick={handleSelectGithubMode}
            className={`py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 ${
              createMode === 'GITHUB'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 font-bold'
                : 'text-slate-400 hover:text-emerald-200 hover:bg-emerald-950/30'
            }`}
          >
            <GithubIcon className="w-3.5 h-3.5" />
            <span>GitHub 활동 기반</span>
          </button>
        </div>

        {errorMessage && (
          <div className="p-4 bg-rose-950/40 border border-rose-900/60 rounded-2xl text-xs text-rose-300 flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* 기본 정보 입력 (제목 & 카테고리) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-200">
                이력서 제목 <span className="text-emerald-400">*</span>
              </label>
              <input
                type="text"
                placeholder="예: 2026 백엔드 신입 지원서"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isLoading}
                className="w-full px-4 py-3.5 text-sm text-white bg-[#0a1024] border border-emerald-950/80 rounded-2xl focus:outline-none focus:border-emerald-500 transition-all placeholder:text-slate-500 shadow-md"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-200">지원 직군 / 카테고리</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={isLoading}
                className="w-full px-4 py-3.5 text-sm text-white bg-[#0a1024] border border-emerald-950/80 rounded-2xl focus:outline-none focus:border-emerald-500 transition-all shadow-md"
              >
                {categoryOptions.map((opt) => (
                  <option key={opt} value={opt} className="bg-[#0f152d] text-white">{opt}</option>
                ))}
              </select>
            </div>
          </div>

          {/* TAB 1: MANUAL (수동 프레임 및 컬럼 설정) */}
          {createMode === 'MANUAL' && (
            <div className="space-y-6 pt-2">
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-emerald-400" />
                  이력서 프레임 템플릿 선택
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Object.entries(FRAME_TEMPLATES).map(([key, tpl]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedFrame(key)}
                      className={`p-4 text-left rounded-2xl border transition-all text-xs flex flex-col justify-between gap-3 ${
                        selectedFrame === key
                          ? 'bg-emerald-950/30 border-emerald-500 text-white ring-1 ring-emerald-500 shadow-lg shadow-emerald-500/10'
                          : 'bg-[#0a1024] border-emerald-950/80 text-slate-400 hover:border-emerald-800/60'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <p className="font-bold text-slate-100 text-xs leading-snug break-words flex-1">{tpl.name}</p>
                        <p className="text-[11px] text-slate-400 line-clamp-2 leading-tight">{tpl.desc}</p>
                      </div>
                      <div>
                        <span className="inline-block text-[10px] px-2.5 py-0.5 rounded-md bg-[#070b19] border border-emerald-950 text-emerald-300 font-semibold">
                          {tpl.category}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 컬럼 추가 영역 */}
              <div className="space-y-4 p-5 bg-[#0a1024] border border-emerald-950/80 rounded-2xl shadow-md">
                <label className="block text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Columns className="w-4 h-4 text-emerald-400" />
                  새 섹션 및 컬럼(Column) 추가
                </label>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="섹션 이름 (예: 자격증 및 언어, 수상 내역, 프로젝트)"
                    value={customSectionTitle}
                    onChange={(e) => setCustomSectionTitle(e.target.value)}
                    className="w-full px-4 py-3 text-xs text-white bg-[#070b19] border border-emerald-950/80 rounded-xl focus:outline-none focus:border-emerald-500 transition"
                  />
                  <div className="flex flex-col sm:flex-row gap-2 w-full">
                    <input
                      type="text"
                      placeholder="추가할 컬럼 항목명 (예: 자격증명, 취득일자)"
                      value={columnInput}
                      onChange={(e) => setColumnInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddColumnTag(); } }}
                      className="w-full sm:flex-1 px-4 py-3 text-xs text-white bg-[#070b19] border border-emerald-950/80 rounded-xl focus:outline-none focus:border-emerald-500 min-w-0 transition"
                    />
                    <button
                      type="button"
                      onClick={handleAddColumnTag}
                      className="w-full sm:w-auto px-4 py-3 bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 text-xs font-semibold rounded-xl border border-emerald-800/40 flex items-center justify-center gap-1 shrink-0 whitespace-nowrap transition"
                    >
                      <Plus className="w-3.5 h-3.5" /> 컬럼 항목 추가
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {customColumnsList.map((col, cIdx) => (
                      <span key={cIdx} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#070b19] border border-emerald-900/60 text-emerald-300 text-xs rounded-lg font-medium">
                        📌 {col}
                        <button type="button" onClick={() => handleRemoveColumnTag(cIdx)} className="hover:text-rose-400 transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={handleAddSection}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 mt-2"
                  >
                    <Plus className="w-4 h-4" /> 전체 섹션 목록에 추가하기
                  </button>
                </div>
              </div>

              {/* 반영된 전체 섹션 */}
              <div className="space-y-3 pt-3 border-t border-emerald-950/60">
                <p className="text-xs font-bold text-slate-300">현재 이력서에 반영될 최종 섹션 ({sections.length}개)</p>
                <div className="space-y-2.5">
                  {sections.map((sec, idx) => (
                    <div key={idx} className="p-4 rounded-2xl border bg-[#0a1024] border-emerald-950/80 text-xs space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Table className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span className="font-bold text-slate-100 text-sm">{sec.title}</span>
                        </div>
                        <button type="button" onClick={() => handleDeleteSection(idx)} className="text-slate-500 hover:text-rose-400 p-1 transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {sec.columns?.map((col, cIdx) => (
                          <span key={cIdx} className="px-2.5 py-1 bg-[#070b19] border border-emerald-950 text-emerald-300 text-[11px] rounded-lg font-medium">
                            📌 {col}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: UPLOAD (파일 / 이미지 파싱) */}
          {createMode === 'UPLOAD' && (
            <div className="space-y-3 pt-2">
              <label className="block text-xs font-bold text-slate-200">기존 이력서 파일/이미지 등록</label>
              {!selectedFile ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-3xl p-12 text-center transition-all cursor-pointer ${
                    isDragging ? 'border-emerald-400 bg-emerald-950/20' : 'border-emerald-950/80 bg-[#0a1024] hover:border-emerald-600'
                  }`}
                >
                  <input
                    type="file"
                    id="resume-file-input"
                    accept=".pdf,.doc,.docx,.hwp,.hwpx,.txt,.rtf,.png,.jpg,.jpeg,.webp,.bmp,.heic,.heif,.tiff,image/*"
                    onChange={(e) => handleFileSelect(e.target.files[0])}
                    className="hidden"
                  />
                  <label htmlFor="resume-file-input" className="cursor-pointer space-y-3 block">
                    <div className="w-12 h-12 mx-auto rounded-2xl bg-[#070b19] border border-emerald-950 flex items-center justify-center text-emerald-400 shadow-md">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-slate-100">클릭하여 파일 선택 또는 드래그 & 드롭</p>
                      <p className="text-xs text-emerald-400 font-medium">PDF · Word · 한글(HWP/HWPX) · 이미지 파싱 지원</p>
                    </div>
                  </label>
                </div>
              ) : (
                <div className="p-4 bg-[#0a1024] border border-emerald-950/80 rounded-2xl flex items-center justify-between gap-3 shadow-md">
                  <div className="flex items-center gap-3 overflow-hidden">
                    {filePreview ? (
                      <img src={filePreview} alt="미리보기" className="w-12 h-12 object-cover rounded-xl shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-[#070b19] border border-emerald-950 flex items-center justify-center text-emerald-400 shrink-0">
                        <FileText className="w-6 h-6" />
                      </div>
                    )}
                    <div className="truncate">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-slate-100 truncate">{selectedFile.name}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${fileTypeBadge.color}`}>
                          {fileTypeBadge.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-400 mt-1">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB · 파싱 준비 완료
                      </p>
                    </div>
                  </div>
                  <button type="button" onClick={() => { setSelectedFile(null); setFilePreview(null); }} className="p-2 text-slate-400 hover:text-rose-400 transition-all">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: GITHUB 활동 분석 및 저장소 선택 */}
          {createMode === 'GITHUB' && (
            <div className="space-y-6 pt-4 border-t border-emerald-950/60">
              
              {/* 계정 유저 뱃지 */}
              <div className="p-4 bg-[#0a1024] border border-emerald-950/80 rounded-2xl flex items-center justify-between shadow-md">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#070b19] rounded-xl border border-emerald-950 text-emerald-400">
                    <GithubIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-emerald-300">연동된 GitHub 계정</p>
                    <p className="text-sm font-bold text-white">{githubUser || '계정 정보 없음'}</p>
                  </div>
                </div>
                <span className="text-[11px] px-3 py-1 bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 rounded-full font-semibold">
                  인증 완료
                </span>
              </div>

              {/* 활동 분석 기간 설정 카드 */}
              <div className="w-full bg-[#0a1024] border border-emerald-950/80 rounded-2xl p-5 md:p-6 space-y-4 text-white shadow-md">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-950/60 pb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-xs font-bold text-slate-100">활동 분석 기간 설정</h3>
                  </div>

                  <div className="flex items-center gap-1.5 px-3 py-1 bg-[#070b19] border border-emerald-950 rounded-full text-[11px] text-emerald-300 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>현재 적용: <strong className="text-white font-bold">{activeFilterText}</strong></span>
                  </div>
                </div>

                {/* 모드 선택 스위치 */}
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#070b19] rounded-xl border border-emerald-950">
                  <button
                    type="button"
                    onClick={() => setSearchMode('relative')}
                    className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      searchMode === 'relative'
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5 text-emerald-300" />
                    <span>최근 기간으로 설정</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchMode('custom')}
                    className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      searchMode === 'custom'
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5 text-emerald-300" />
                    <span>상세 날짜 직접 지정</span>
                  </button>
                </div>

                {/* 모드별 입력 폼 */}
                <div className="pt-2">
                  {searchMode === 'relative' ? (
                    <div className="bg-[#070b19] border border-emerald-950 rounded-2xl p-4 md:p-5 space-y-4">
                      
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-950/80 pb-3.5">
                        <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
                          <Clock className="w-4 h-4 text-emerald-400" />
                          탐색 기간 설정
                        </span>
                        
                        <div className="flex items-center gap-1.5">
                          {[
                            { label: '3개월', y: 0, m: 3 },
                            { label: '6개월', y: 0, m: 6 },
                            { label: '1년', y: 1, m: 0 },
                            { label: '2년', y: 2, m: 0 },
                          ].map((preset) => {
                            const isActive = years === preset.y && months === preset.m;
                            return (
                              <button
                                key={preset.label}
                                type="button"
                                onClick={() => {
                                  setYears(preset.y);
                                  setMonths(preset.m);
                                }}
                                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                                  isActive
                                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                                    : 'bg-[#0a1024] text-emerald-300 hover:bg-emerald-950/40 border border-emerald-900/40'
                                }`}
                              >
                                {preset.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-[#0a1024] border border-emerald-950 rounded-xl p-3.5 w-full">
                        <p className="text-xs font-medium text-slate-400 text-center md:text-left leading-relaxed flex-1">
                          기준 시점으로부터 <strong className="text-emerald-400 font-bold">과거 기간</strong>을 직접 조정하세요.
                        </p>

                        <div className="flex flex-wrap items-center justify-center gap-2.5 w-full md:w-auto shrink-0">
                          <span className="text-xs text-slate-400 font-medium hidden sm:inline">최근</span>
                          
                          <div className="flex items-center gap-1 bg-[#070b19] border border-emerald-950 rounded-xl p-1">
                            <button
                              type="button"
                              onClick={() => setYears(Math.max(0, years - 1))}
                              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 flex items-center justify-center text-sm font-bold transition"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={years}
                              onChange={(e) => setYears(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-10 sm:w-12 h-7 sm:h-8 text-center bg-transparent text-sm sm:text-base font-bold text-white focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => setYears(years + 1)}
                              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 flex items-center justify-center text-sm font-bold transition"
                            >
                              +
                            </button>
                            <span className="pr-1.5 text-xs font-bold text-emerald-300">년</span>
                          </div>

                          <div className="flex items-center gap-1 bg-[#070b19] border border-emerald-950 rounded-xl p-1">
                            <button
                              type="button"
                              onClick={() => setMonths(Math.max(0, months - 1))}
                              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 flex items-center justify-center text-sm font-bold transition"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              max="12"
                              value={months}
                              onChange={(e) => setMonths(Math.max(0, Math.min(12, parseInt(e.target.value) || 0)))}
                              className="w-10 sm:w-12 h-7 sm:h-8 text-center bg-transparent text-sm sm:text-base font-bold text-white focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => setMonths(Math.min(12, months + 1))}
                              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 flex items-center justify-center text-sm font-bold transition"
                            >
                              +
                            </button>
                            <span className="pr-1.5 text-xs font-bold text-emerald-300">개월</span>
                          </div>
                        </div>
                      </div>

                    </div>
                  ) : (
                    /* 상세 날짜 지정 모드 */
                    <div className="bg-[#070b19] border border-emerald-950 rounded-2xl p-4 md:p-5 grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs text-slate-300 font-bold flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                          탐색 시작일
                        </label>
                        <input
                          type="date"
                          value={startDate}
                          max={endDate || undefined}
                          onClick={(e) => e.target.showPicker?.()}
                          onChange={(e) => {
                            const newStart = e.target.value;
                            setStartDate(newStart);
                            if (endDate && newStart > endDate) setEndDate(newStart);
                          }}
                          className="w-full bg-[#0a1024] border border-emerald-950 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 [color-scheme:dark]"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs text-slate-300 font-bold flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                          탐색 종료일
                        </label>
                        <input
                          type="date"
                          value={endDate}
                          min={startDate || undefined}
                          onClick={(e) => e.target.showPicker?.()}
                          onChange={(e) => {
                            const newEnd = e.target.value;
                            if (startDate && newEnd < startDate) setEndDate(startDate);
                            else setEndDate(newEnd);
                          }}
                          className="w-full bg-[#0a1024] border border-emerald-950 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 [color-scheme:dark]"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleSearch}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 active:scale-[0.99]"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>{searchMode === 'relative' ? '최근 기간으로 저장소 탐색' : '상세 지정 기간으로 저장소 탐색'}</span>
                </button>
              </div>

              {/* 검색 및 전체 선택 */}
              <div className="flex items-center justify-between gap-2.5 pt-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="저장소 이름 또는 설명으로 검색..."
                    value={repoSearchKeyword}
                    onChange={(e) => setRepoSearchKeyword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 text-xs text-white bg-[#0a1024] border border-emerald-950 rounded-xl focus:outline-none focus:border-emerald-500 placeholder:text-slate-500 shadow-md"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSelectAllRepos}
                  className="px-4 py-3 bg-[#0a1024] hover:bg-emerald-950/40 border border-emerald-950 text-emerald-300 text-xs font-bold rounded-xl transition shrink-0"
                >
                  {selectedRepos.length === filteredRepositories.length && filteredRepositories.length > 0 ? '전체 해제' : '전체 선택'}
                </button>
              </div>

              {/* 저장소 리스트 카드 */}
              {isFetchingRepos ? (
                <div className="p-12 text-center bg-[#0a1024] border border-emerald-950 rounded-2xl">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-400 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">GitHub 저장소 목록을 불러오는 중...</p>
                </div>
              ) : filteredRepositories.length === 0 ? (
                <div className="p-12 text-center bg-[#0a1024] border border-emerald-950 rounded-2xl">
                  <p className="text-xs text-slate-400">조회된 GitHub 저장소가 없습니다.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
                  {filteredRepositories.map((repo, index) => {
                    const repoName = repo.full_name || repo.name;
                    const isSelected = selectedRepos.includes(repoName);

                    return (
                      <div
                        key={repo.id || repo.full_name || index}
                        onClick={() => toggleRepoSelection(repoName)}
                        className={`p-4 rounded-2xl border cursor-pointer transition flex flex-col justify-between gap-3 ${
                          isSelected
                            ? 'bg-emerald-950/40 border-emerald-500/80 ring-1 ring-emerald-500/80 shadow-md shadow-emerald-500/10'
                            : 'bg-[#0a1024] border-emerald-950 hover:border-emerald-800/60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 overflow-hidden">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-bold text-slate-100 leading-snug truncate">
                                {repo.full_name || repo.name}
                              </p>
                              {repo.is_private && (
                                <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                              {repo.description || '설명 없음'}
                            </p>
                          </div>

                          <div
                            className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition ${
                              isSelected
                                ? 'bg-emerald-600 border-emerald-500 text-white'
                                : 'border-slate-700 bg-[#070b19]'
                            }`}
                          >
                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                        </div>

                        {/* 카드 하단 정보 */}
                        <div className="space-y-2 pt-3 border-t border-emerald-950/80">
                          <div className="flex items-center justify-between text-[11px]">
                            <div className="flex items-center gap-1.5 text-slate-400 font-medium">
                              <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span>
                                {formatDate(repo.created_at)} ~ {formatDate(repo.pushed_at || repo.updated_at)}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 text-emerald-300 font-semibold bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded-md text-[10px]">
                              <GitCommit className="w-3 h-3 text-emerald-400" />
                              <span>활동 {repo.activity_count ?? repo.commit_count ?? 0}회</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-0.5">
                            <div>
                              {repo.language && (
                                <span className="px-2.5 py-0.5 bg-[#070b19] border border-emerald-950 text-emerald-300 rounded-md text-[10px] font-medium">
                                  {repo.language}
                                </span>
                              )}
                            </div>
                            {repo.stargazers_count > 0 && (
                              <span className="flex items-center gap-1 text-amber-400 text-[10px] font-semibold">
                                <Star className="w-3 h-3 fill-amber-400" /> {repo.stargazers_count}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 하단 최종 제출 버튼 */}
          <button
            type={createMode === 'GITHUB' ? "button" : "submit"}
            onClick={createMode === 'GITHUB' ? handleDirectGenerateResume : undefined}
            disabled={
              isLoading || loading || 
              (createMode === 'GITHUB' && selectedRepos.length === 0) ||
              (createMode === 'UPLOAD' && !selectedFile)
            }
            className={`
              w-full py-4 px-6 rounded-2xl font-black text-sm md:text-base transition-all duration-200 
              flex items-center justify-center gap-2 mt-8 cursor-pointer
              ${
                isLoading || loading || (createMode === 'GITHUB' && selectedRepos.length === 0) || (createMode === 'UPLOAD' && !selectedFile)
                  ? 'bg-[#0a1024] text-slate-500 border border-emerald-950/60 cursor-not-allowed'
                  : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/30 border border-emerald-400/30 transform hover:-translate-y-0.5 active:translate-y-0'
              }
            `}
          >
            {isLoading || loading ? (
              <span className="flex items-center gap-2 text-white">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-300" />
                <span>{loadingText || '이력서 생성 중...'}</span>
              </span>
            ) : createMode === 'GITHUB' ? (
              <span className="flex items-center gap-2">
                {selectedRepos.length > 0 ? (
                  <>
                    <Sparkles className="w-5 h-5 text-yellow-300 fill-yellow-300 animate-bounce" />
                    <span>선택한 {selectedRepos.length}개 저장소로 이력서 자동 생성하기</span>
                  </>
                ) : (
                  <span className="text-slate-400 font-medium text-xs md:text-sm">
                    ⚠️ 하단 저장소 목록에서 1개 이상 선택해 주세요
                  </span>
                )}
              </span>
            ) : createMode === 'UPLOAD' ? (
              <span>업로드 파일 분석 후 이력서 생성하기</span>
            ) : (
              <span>이력서 생성하기</span>
            )}
          </button>
        </form>

      </div>
    </div>
  );
};

export default ResumeNew;