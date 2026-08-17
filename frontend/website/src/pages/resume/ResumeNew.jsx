import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FilePlus, ArrowLeft, Loader2, Sparkles, Plus, Trash2, Upload, FileText, X, Globe, 
  Columns, Table, GitBranch, CheckCircle2, BarChart2, Star, Lock, Search, Check, 
  RotateCcw, Calendar, Clock, GitCommit
} from 'lucide-react';

import { FRAME_TEMPLATES } from '../../templates/resumeTemplates';
const BASE_URL = 'http://localhost:8000';

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
  const [fileTypeBadge, setFileTypeBadge] = useState({ label: '문서', color: 'bg-indigo-950 text-indigo-300' });
  const [isDragging, setIsDragging] = useState(false);

  const [sections, setSections] = useState(FRAME_TEMPLATES.KR_DEV_BACKEND?.sections || []);
  const [customSectionTitle, setCustomSectionTitle] = useState('');
  const [columnInput, setColumnInput] = useState('');
  const [customColumnsList, setCustomColumnsList] = useState(['제목/역할', '참여 기간', '상세 업무 및 성과']);

  // 💡 GitHub 연동 및 다중 선택 전용 상태
  const [githubUser, setGithubUser] = useState(null);
  const [repositories, setRepositories] = useState([]);



  const [repoSearchKeyword, setRepoSearchKeyword] = useState(''); // 저장소 검색어
  const [isFetchingRepos, setIsFetchingRepos] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
// 💡 [NEW] 날짜 기간 및 추출 시간대 상태 추가
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [extractionTime, setExtractionTime] = useState(''); // 예: 02:00 (특정 시간대)
  const [inputYears, setInputYears] = useState(0);
  const [inputMonths, setInputMonths] = useState(6);


  const [selectedRepos, setSelectedRepos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');


  // 2. handleDirectGenerateResume 함수를 아래와 같이 수정하세요.
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
      }).then(res => {
        if (!res.ok) throw new Error(`[${repoName}] 분석 실패 (${res.status})`);
        return res.json();
      })
    );
    const results = await Promise.all(analyzePromises);

    // 2단계: 분석 데이터로 백엔드 AI 이력서 생성
    setLoadingText("AI 이력서 카드 생성 중...");
    const generateRes = await fetch(`${BASE_URL}/api/resumes/github-generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        member_id: userId,
        title: title.trim() || `${selectedRepos.length}개 저장소 기반 기술 이력서`,
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

    // 3단계: 생성 완료 후 React Router navigate로 페이지 이동
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


// 💡 년/개월 자동 보정 및 저장소 탐색 핸들러
const handleSearchByRelativePeriod = () => {
  const y = parseInt(inputYears, 10) || 0;
  const m = parseInt(inputMonths, 10) || 0;
  
  // 총 개월 수 계산 (예: 1년 30개월 -> 42개월)
  let totalMonths = y * 12 + m;

  if (totalMonths <= 0) {
    totalMonths = 1; // 최소 1개월로 제한
  }

  // 년/개월 단위 자동 보정 (42개월 -> 3년 6개월, 36개월 -> 3년 0개월)
  const normalizedYears = Math.floor(totalMonths / 12);
  const normalizedMonths = totalMonths % 12;

  // 입력 필드 값 보정 업데이트
  setInputYears(normalizedYears);
  setInputMonths(normalizedMonths);

  // 날짜 계산 (오늘 기준 totalMonths 이전)
  const today = new Date();
  const pastDate = new Date();
  pastDate.setMonth(today.getMonth() - totalMonths);

  const endStr = today.toISOString().split('T')[0];
  const startStr = pastDate.toISOString().split('T')[0];

  setStartDate(startStr);
  setEndDate(endStr);

  // 해당 계산 기간으로 즉시 저장소 조회
  fetchUserRepositories(githubUser, null, { startDate: startStr, endDate: endStr });
};

const handleYearsChange = (delta) => {
  setInputYears((prev) => Math.max(0, (parseInt(prev, 10) || 0) + delta));
};

const handleMonthsChange = (delta) => {
  setInputMonths((prev) => Math.max(0, (parseInt(prev, 10) || 0) + delta));
};



  const handleSetQuickPeriod = (months) => {
  const today = new Date();
  const pastDate = new Date();
  
  // 개월 수 차감 계산
  pastDate.setMonth(today.getMonth() - months);

  const endStr = today.toISOString().split('T')[0];
  const startStr = pastDate.toISOString().split('T')[0];

  setEndDate(endStr);
  setStartDate(startStr);

  // 날짜 변경과 동시에 해당 기간의 저장소 자동 조회
  fetchUserRepositories(githubUser, null, { startDate: startStr, endDate: endStr });
};


  // 💡 [NEW] 지난 1년 활동 기간 자동 설정 함수
  const handleSetPastOneYear = () => {
    const today = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(today.getFullYear() - 1);

    setEndDate(today.toISOString().split('T')[0]);
    setStartDate(oneYearAgo.toISOString().split('T')[0]);
  };

  // 💡 [NEW] 날짜 및 추출 시간대 매개변수를 포함한 저장소 분석 함수
  const handleAnalyzeRepository = async () => {
    if (selectedRepos.length === 0) {
      alert('분석할 저장소를 최소 1개 이상 선택해 주세요.');
      return;
    }

    const token = getCookie('github_access_token');
    const githubId = getCookie('github_id') || localStorage.getItem('github_id');

    try {
      setIsAnalyzing(true);
      setErrorMessage('');

      // 선택한 저장소 분석 시 날짜 범위 및 추출 시간대 데이터 동시 전달
      const analyzePromises = selectedRepos.map(repoName => 
        fetch(`${BASE_URL}/api/github/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            github_id: githubId,
            repo_name: repoName,
            start_date: startDate || "",  // 수집 시작일
            end_date: endDate || "",      // 수집 종료일
            extraction_time: extractionTime || "" // 지정 추출 시간대
          })
        }).then(res => {
          if (!res.ok) throw new Error(`[${repoName}] 분석 실패`);
          return res.json();
        })
      );

      const results = await Promise.all(analyzePromises);
      
      const mergedAnalysis = {
        repo_names: selectedRepos,
        total_projects: results.length,
        filter_period: { startDate, endDate, extractionTime },
        projects_data: results
      };

      setAnalysisResult(mergedAnalysis);
      alert(`총 ${results.length}개 저장소의 지정 기간 커밋/활동 분석이 완료되었습니다!`);
    } catch (err) {
      console.error(err);
      alert(err.message || '저장소 분석 중 오류가 발생했습니다.');
    } finally {
      setIsAnalyzing(false);
    }
  };


  
  useEffect(() => {
    if (FRAME_TEMPLATES[selectedFrame]) {
      setSections([...FRAME_TEMPLATES[selectedFrame].sections]);
    }
  }, [selectedFrame]);

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
  // 💡 State 대신 가져온 githubId와 token을 직접 전달하여 호출
  fetchUserRepositories(githubId, token);
};
const fetchUserRepositories = async (targetUser, targetToken, customFilters = {}) => {
  const user = targetUser || githubUser || getCookie('github_id') || localStorage.getItem('github_id');
  const token = targetToken || getCookie('github_access_token') || localStorage.getItem('github_access_token');

  if (!user) return;

  try {
    setIsFetchingRepos(true);
    setErrorMessage('');

    const params = new URLSearchParams({ github_id: user });
    
    const activeStartDate = customFilters.startDate !== undefined ? customFilters.startDate : startDate;
    const activeEndDate = customFilters.endDate !== undefined ? customFilters.endDate : endDate;

    if (activeStartDate) params.append('start_date', activeStartDate);
    if (activeEndDate) params.append('end_date', activeEndDate);

    const res = await fetch(`${BASE_URL}/api/github/repositories?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (!res.ok) {
      throw new Error('기간 내 활동이 존재하는 저장소를 불러오지 못했습니다.');
    }

    const data = await res.json();
    const repoList = data.repositories || (Array.isArray(data) ? data : []);
    
    setRepositories(repoList);
    setSelectedRepos([]); // 목록 갱신 시 선택 상태 초기화

  } catch (err) {
    console.error("저장소 조회 에러:", err);
    setErrorMessage(err.message);
  } finally {
    setIsFetchingRepos(false);
  }
};



const handleSearchByFilter = () => {
  fetchUserRepositories(githubUser, null, { startDate, endDate });
};
  // 💡 저장소 토글 선택 함수
  const toggleRepoSelection = (repoName) => {
  setSelectedRepos((prev) =>
    prev.includes(repoName)
      ? prev.filter((name) => name !== repoName)
      : [...prev, repoName]
  );
};

  // 💡 전체 선택 / 해제
  const handleSelectAllRepos = () => {
    if (selectedRepos.length === filteredRepositories.length) {
      setSelectedRepos([]);
    } else {
      setSelectedRepos(filteredRepositories.map(r => r.name));
    }
  };

 
  const filteredRepositories = repositories.filter((repo) => {
  if (!repo || !repo.name) return false;
  const keyword = repoSearchKeyword.toLowerCase();
  const nameMatch = repo.name.toLowerCase().includes(keyword);
  const descMatch = repo.description ? repo.description.toLowerCase().includes(keyword) : false;
  return nameMatch || descMatch;
});

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
      setFileTypeBadge({ label: fileExt.toUpperCase(), color: 'bg-emerald-950 text-emerald-300 border-emerald-800/40' });
      const reader = new FileReader();
      reader.onloadend = () => setFilePreview(reader.result);
      reader.readAsDataURL(file);
    } else {
      setFileTypeBadge({ label: fileExt.toUpperCase(), color: 'bg-indigo-950 text-indigo-300 border-indigo-800/40' });
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

        const response = await fetch(`${BASE_URL}/api/resumes/github-generate`, {
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

        const response = await fetch(`${BASE_URL}/api/resumes/upload`, { method: 'POST', body: formData });
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

        const response = await fetch(`${BASE_URL}/api/resumes`, {
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
    <div className="min-h-screen bg-[#07051E] text-slate-100 flex items-start justify-center p-6 pt-12 font-sans">
      <div className="w-full max-w-4xl bg-[#0E0B2D] border border-indigo-950 rounded-3xl p-8 shadow-2xl space-y-6 my-8">
        
        {/* 상단 헤더 */}
        <div className="flex items-center justify-between border-b border-indigo-950 pb-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            돌아가기
          </button>
          <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 bg-indigo-950/80 border border-indigo-800/40 text-indigo-300 rounded-full">
            <Sparkles className="w-3.5 h-3.5" />
            맞춤형 Multi-Column Builder
          </span>
        </div>

        {/* 타이틀 */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FilePlus className="w-6 h-6 text-indigo-400" />
            새 이력서 만들기
          </h1>
          <p className="text-sm text-slate-400">
            원하는 방식으로 이력서를 손쉽게 자동 생성하세요.
          </p>
        </div>

        {/* 모드 전환 탭 */}
        <div className="grid grid-cols-3 gap-2 p-1.5 bg-[#07051E] border border-indigo-950 rounded-2xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setCreateMode('MANUAL')}
            className={`py-2.5 rounded-xl transition-all ${
              createMode === 'MANUAL' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            프레임 & 컬럼 구성
          </button>
          <button
            type="button"
            onClick={() => setCreateMode('UPLOAD')}
            className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              createMode === 'UPLOAD' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            파일/이미지 업로드
          </button>
          <button
            type="button"
            onClick={handleSelectGithubMode}
            className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              createMode === 'GITHUB' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <GithubIcon className="w-3.5 h-3.5" />
            GitHub 활동으로 만들기
          </button>
        </div>

        {errorMessage && (
          <div className="p-4 bg-rose-950/40 border border-rose-900/60 rounded-xl text-xs text-rose-300">
            ⚠️ {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-indigo-300">
                이력서 제목 <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                placeholder="예: 2026 글로벌 백엔드 지원서"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isLoading}
                className="w-full p-3.5 text-sm text-white bg-[#07051E] border border-indigo-900/60 rounded-xl focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-600"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-indigo-300">지원 직군 / 카테고리</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={isLoading}
                className="w-full p-3.5 text-sm text-white bg-[#07051E] border border-indigo-900/60 rounded-xl focus:outline-none focus:border-indigo-500 transition-all"
              >
                {categoryOptions.map((opt) => (
                  <option key={opt} value={opt} className="bg-[#0E0B2D] text-white">{opt}</option>
                ))}
              </select>
            </div>
          </div>

          {/* TAB 1: MANUAL */}
          {createMode === 'MANUAL' && (
            <div className="space-y-6 pt-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-indigo-400" />
                  이력서 프레임 템플릿 선택
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Object.entries(FRAME_TEMPLATES).map(([key, tpl]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedFrame(key)}
                      className={`p-3.5 text-left rounded-xl border transition-all text-xs flex flex-col justify-between gap-2 ${
                        selectedFrame === key
                          ? 'bg-indigo-600/20 border-indigo-500 text-white ring-1 ring-indigo-500'
                          : 'bg-[#07051E] border-indigo-950/80 text-slate-400 hover:border-indigo-800'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <p className="font-bold text-slate-200 text-xs leading-snug break-words flex-1">{tpl.name}</p>
                        <p className="text-[11px] text-slate-400 line-clamp-2 leading-tight">{tpl.desc}</p>
                      </div>
                      <div>
                        <span className="inline-block text-[10px] px-2 py-0.5 rounded-md bg-indigo-950 border border-indigo-800/40 text-indigo-300 font-medium">
                          {tpl.category}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 p-5 bg-[#07051E]/60 border border-indigo-950 rounded-2xl">
                <label className="block text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
                  <Columns className="w-3.5 h-3.5 text-indigo-400" />
                  새 섹션 및 컬럼(Column) 추가
                </label>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="섹션 이름 (예: 자격증 및 언어, 수상 내역, 프로젝트)"
                    value={customSectionTitle}
                    onChange={(e) => setCustomSectionTitle(e.target.value)}
                    className="w-full p-3 text-xs text-white bg-[#07051E] border border-indigo-900/60 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="추가할 컬럼 항목명 (예: 자격증명, 취득일자, 발급기관)"
                      value={columnInput}
                      onChange={(e) => setColumnInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddColumnTag(); } }}
                      className="flex-1 p-3 text-xs text-white bg-[#07051E] border border-indigo-900/60 rounded-xl focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddColumnTag}
                      className="px-4 py-3 bg-indigo-900/50 hover:bg-indigo-800 text-indigo-200 text-xs font-medium rounded-xl border border-indigo-700/50 flex items-center gap-1 shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" /> 컬럼 항목 추가
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {customColumnsList.map((col, cIdx) => (
                      <span key={cIdx} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-950 border border-indigo-800/60 text-indigo-200 text-xs rounded-lg">
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
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 mt-2"
                  >
                    <Plus className="w-4 h-4" /> 전체 섹션 목록에 추가하기
                  </button>
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-indigo-950">
                <p className="text-xs font-semibold text-slate-300">현재 이력서에 반영될 최종 섹션 ({sections.length}개)</p>
                <div className="space-y-2.5">
                  {sections.map((sec, idx) => (
                    <div key={idx} className="p-4 rounded-xl border bg-[#07051E]/90 border-indigo-900/50 text-xs space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Table className="w-4 h-4 text-indigo-400 shrink-0" />
                          <span className="font-bold text-slate-200 text-sm">{sec.title}</span>
                        </div>
                        <button type="button" onClick={() => handleDeleteSection(idx)} className="text-slate-500 hover:text-rose-400 p-1 transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {sec.columns?.map((col, cIdx) => (
                          <span key={cIdx} className="px-2.5 py-1 bg-indigo-950/80 border border-indigo-800/40 text-indigo-300 text-[11px] rounded-lg font-medium">
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

          {/* TAB 2: UPLOAD */}
          {createMode === 'UPLOAD' && (
            <div className="space-y-3 pt-2">
              <label className="block text-xs font-semibold text-indigo-300">기존 이력서 파일/이미지 등록</label>
              {!selectedFile ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer ${
                    isDragging ? 'border-indigo-400 bg-indigo-950/40' : 'border-indigo-900/60 bg-[#07051E]/60 hover:border-indigo-600'
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
                    <div className="w-12 h-12 mx-auto rounded-full bg-indigo-950/80 border border-indigo-800/40 flex items-center justify-center text-indigo-400">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-slate-200">클릭하여 파일 선택 또는 드래그 & 드롭</p>
                      <p className="text-xs text-indigo-300 font-medium">PDF · Word · 한글(HWP/HWPX) · 이미지 지원</p>
                    </div>
                  </label>
                </div>
              ) : (
                <div className="p-4 bg-[#07051E] border border-indigo-800/50 rounded-2xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 overflow-hidden">
                    {filePreview ? (
                      <img src={filePreview} alt="미리보기" className="w-12 h-12 object-cover rounded-lg shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-indigo-950 flex items-center justify-center text-indigo-400 shrink-0">
                        <FileText className="w-6 h-6" />
                      </div>
                    )}
                    <div className="truncate">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-slate-200 truncate">{selectedFile.name}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${fileTypeBadge.color}`}>
                          {fileTypeBadge.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-indigo-400 mt-1">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB · 파싱 준비 완료
                      </p>
                    </div>
                  </div>
                  <button type="button" onClick={() => { setSelectedFile(null); setFilePreview(null); }} className="p-1.5 text-slate-500 hover:text-rose-400 transition-all">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 💡 TAB 3: GitHub 저장소 다중 선택 & 분석 (웹 디자인 카드 그리드) */}
          {/* TAB 3: GITHUB 저장소 영역 */}
    {createMode === 'GITHUB' && (
      <div className="space-y-6 pt-6 border-t border-indigo-950/60">
        
        {/* 계정 유저 뱃지 */}
        <div className="p-4 bg-[#07051E] border border-indigo-900/40 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <GithubIcon className="w-5 h-5 text-indigo-400" />
            <div>
              <p className="text-xs font-medium text-indigo-300">연동된 GitHub 계정</p>
              <p className="text-sm font-bold text-white">{githubUser}</p>
            </div>
          </div>
          <span className="text-[10px] px-2.5 py-1 bg-indigo-950 text-indigo-300 border border-indigo-800/50 rounded-full font-semibold">
            인증 완료
          </span>
        </div>

{/* 활동 분석 기간 설정 카드 */}
<div className="p-4 bg-[#07051E]/80 border border-indigo-900/50 rounded-2xl space-y-4">
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-indigo-950/80">
    <label className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
      <Calendar className="w-3.5 h-3.5 text-indigo-400" />
      활동 분석 기간 설정
    </label>

    {/* 💡 [NEW] 브라우저 기본 화살표를 제거하고 디자인한 세련된 스텝 컨트롤 */}
    <div className="flex items-center gap-3 bg-[#07051E] p-1.5 px-3 border border-indigo-900/60 rounded-xl shadow-inner">
      <span className="text-[11px] text-slate-400 font-medium">최근</span>

      {/* 년(Year) 스텝 컨트롤 */}
      <div className="flex items-center gap-1.5">
        <div className="flex items-center bg-indigo-950/80 border border-indigo-800/60 rounded-lg overflow-hidden focus-within:border-indigo-500 transition-all">
          <button
            type="button"
            onClick={() => handleYearsChange(-1)}
            className="w-6 h-6 flex items-center justify-center text-slate-400 hover:bg-indigo-800/50 hover:text-white transition-all border-r border-indigo-900/60 text-xs font-bold active:scale-90"
          >
            -
          </button>
          <input
            type="number"
            min="0"
            value={inputYears}
            onChange={(e) => setInputYears(e.target.value)}
            className="w-8 text-center text-xs font-bold text-white bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            type="button"
            onClick={() => handleYearsChange(1)}
            className="w-6 h-6 flex items-center justify-center text-slate-400 hover:bg-indigo-800/50 hover:text-white transition-all border-l border-indigo-900/60 text-xs font-bold active:scale-90"
          >
            +
          </button>
        </div>
        <span className="text-xs text-indigo-300 font-medium">년</span>
      </div>

      {/* 개월(Month) 스텝 컨트롤 */}
      <div className="flex items-center gap-1.5">
        <div className="flex items-center bg-indigo-950/80 border border-indigo-800/60 rounded-lg overflow-hidden focus-within:border-indigo-500 transition-all">
          <button
            type="button"
            onClick={() => handleMonthsChange(-1)}
            className="w-6 h-6 flex items-center justify-center text-slate-400 hover:bg-indigo-800/50 hover:text-white transition-all border-r border-indigo-900/60 text-xs font-bold active:scale-90"
          >
            -
          </button>
          <input
            type="number"
            min="0"
            value={inputMonths}
            onChange={(e) => setInputMonths(e.target.value)}
            className="w-10 text-center text-xs font-bold text-white bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            type="button"
            onClick={() => handleMonthsChange(1)}
            className="w-6 h-6 flex items-center justify-center text-slate-400 hover:bg-indigo-800/50 hover:text-white transition-all border-l border-indigo-900/60 text-xs font-bold active:scale-90"
          >
            +
          </button>
        </div>
        <span className="text-xs text-indigo-300 font-medium">개월</span>
      </div>
    </div>
  </div>

  {/* 시작일 / 종료일 수동 입력 레이아웃 */}
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
    <div className="space-y-1">
      <span className="text-[11px] text-slate-400 font-medium">시작일</span>
      <input
        type="date"
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
        className="w-full p-2.5 text-xs text-white bg-[#07051E] border border-indigo-900/60 rounded-xl focus:outline-none focus:border-indigo-500 transition-all cursor-pointer"
      />
    </div>

    <div className="space-y-1">
      <span className="text-[11px] text-slate-400 font-medium">종료일</span>
      <input
        type="date"
        value={endDate}
        onChange={(e) => setEndDate(e.target.value)}
        className="w-full p-2.5 text-xs text-white bg-[#07051E] border border-indigo-900/60 rounded-xl focus:outline-none focus:border-indigo-500 transition-all cursor-pointer"
      />
    </div>
  </div>

  {/* 탐색 실행 및 기간 자동 보정 버튼 */}
  <div className="flex justify-end pt-1">
    <button
      type="button"
      onClick={handleSearchByRelativePeriod}
      disabled={isFetchingRepos}
      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-950/60 text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 shadow-md shadow-indigo-950/50"
    >
      {isFetchingRepos ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>저장소 조회 중...</span>
        </>
      ) : (
        <>
          <Search className="w-3.5 h-3.5" />
          <span>설정 기간으로 저장소 탐색</span>
        </>
      )}
    </button>
  </div>
</div>


        {/* 저장소 선택 도구 상자 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
              분석할 GitHub 저장소 선택
              <span className="ml-1.5 text-[11px] px-2 py-0.5 bg-indigo-950 text-indigo-300 border border-indigo-800/40 rounded-full">
                {selectedRepos.length}개 선택됨
              </span>
            </label>

            <button
              type="button"
              onClick={handleSelectAllRepos}
              className="text-[11px] font-medium text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-1"
            >
              <Check className="w-3 h-3" />
              {selectedRepos.length === filteredRepositories.length && filteredRepositories.length > 0 ? '전체 해제' : '전체 선택'}
            </button>
          </div>

          {/* 검색 및 분석 실행 */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="저장소 이름 또는 설명으로 검색..."
                value={repoSearchKeyword}
                onChange={(e) => setRepoSearchKeyword(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 text-xs text-white bg-[#07051E] border border-indigo-900/60 rounded-xl focus:outline-none focus:border-indigo-500 placeholder:text-slate-600 transition-all"
              />
            </div>

          </div>

          {/* 저장소 리스트 영역 */}
          {/* ... (기존 저장소 카드리스트 동일) ... */}

          {/* 저장소 리스트 영역 */}
{isFetchingRepos ? (
  <div className="p-8 text-center bg-[#07051E] border border-indigo-900/40 rounded-2xl">
    <Loader2 className="w-6 h-6 animate-spin text-indigo-400 mx-auto mb-2" />
    <p className="text-xs text-slate-400">GitHub 저장소 목록을 불러오는 중...</p>
  </div>
) : filteredRepositories.length === 0 ? (
  <div className="p-8 text-center bg-[#07051E] border border-indigo-900/40 rounded-2xl">
    <p className="text-xs text-slate-400">조회된 GitHub 저장소가 없습니다.</p>
  </div>
) : (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
    {filteredRepositories.map((repo) => {
  const isSelected = selectedRepos.includes(repo.name);

  return (
    <div
      key={repo.id}
      onClick={() => toggleRepoSelection(repo.name)}
      className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between gap-3 ${
        isSelected
          ? 'bg-indigo-950/80 border-indigo-500 ring-1 ring-indigo-500 shadow-md shadow-indigo-950/50'
          : 'bg-[#07051E] border-indigo-900/40 hover:border-indigo-700'
      }`}
    >
      {/* 상단: 이름, 설명, 선택 체크박스 */}
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 overflow-hidden">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-bold text-white leading-tight truncate">
              {repo.full_name || repo.name}
            </p>
            {repo.is_private && (
              <Lock className="w-3 h-3 text-amber-400 shrink-0" />
            )}
          </div>
          <p className="text-[11px] text-slate-400 line-clamp-2">
            {repo.description || '설명 없음'}
          </p>
        </div>

        <div
          className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-all ${
            isSelected
              ? 'bg-indigo-600 border-indigo-500 text-white'
              : 'border-slate-600 bg-[#07051E]'
          }`}
        >
          {isSelected && <Check className="w-3 h-3" />}
        </div>
      </div>

      {/* 💡 [NEW] 하단: 기간 범위 + 활동 횟수 + 언어 태그 */}
      <div className="space-y-2 pt-2 border-t border-indigo-950/80">
        {/* 생성일 ~ 최근 업데이트일 & 활동 횟수 */}
        <div className="flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1 text-slate-300 font-medium">
            <Clock className="w-3 h-3 text-indigo-400 shrink-0" />
            <span>
              {formatDate(repo.created_at)} ~ {formatDate(repo.pushed_at || repo.updated_at)}
            </span>
          </div>

          <div className="flex items-center gap-1 text-emerald-400 font-semibold bg-emerald-950/60 border border-emerald-800/40 px-1.5 py-0.5 rounded-md text-[10px]">
            <GitCommit className="w-3 h-3" />
            <span>활동 {repo.activity_count ?? repo.commit_count ?? 0}회</span>
          </div>
        </div>

        {/* 언어 및 스타 수 */}
        <div className="flex items-center justify-between pt-0.5">
          <div>
            {repo.language && (
              <span className="px-1.5 py-0.5 bg-indigo-950 border border-indigo-800/40 text-indigo-300 rounded text-[10px] font-medium">
                {repo.language}
              </span>
            )}
          </div>
          {repo.stargazers_count > 0 && (
            <span className="flex items-center gap-0.5 text-amber-400 text-[10px] font-medium">
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

      </div>
    )}

          {/* 제출 버튼 */}
          <button
          type="button"
          onClick={handleDirectGenerateResume}
          disabled={loading || selectedRepos.length === 0}
          className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 text-white font-bold text-lg rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
        >
          {loading ? (
            <span>{loadingText}</span>
          ) : (
            <span>선택한 {selectedRepos.length}개 저장소로 이력서 자동 생성</span>
          )}
        </button>
        </form>

      </div>
    </div>
  );
};

export default ResumeNew;