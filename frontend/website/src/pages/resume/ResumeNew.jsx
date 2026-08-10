import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FilePlus, 
  ArrowLeft, 
  Loader2, 
  Sparkles, 
  Plus, 
  Trash2, 
  Upload, 
  FileText, 
  X,
  Globe,
  Columns,
  Table
} from 'lucide-react';

import { FRAME_TEMPLATES } from '../../templates/resumeTemplates';
const BASE_URL = 'http://localhost:8000';

const ResumeNew = () => {
  const navigate = useNavigate();

  // 1. 생성 모드 ('MANUAL': 프레임 직접 구성 / 'UPLOAD': 파일 파싱)
  const [createMode, setCreateMode] = useState('MANUAL');

  // 2. 선택된 프레임 템플릿 키
  const [selectedFrame, setSelectedFrame] = useState('KR_DEV_BACKEND');

  // 3. 기본 폼 상태
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('신입 개발자');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // 4. 파일 업로드 전용 상태
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [fileTypeBadge, setFileTypeBadge] = useState({ label: '문서', color: 'bg-indigo-950 text-indigo-300' });
  const [isDragging, setIsDragging] = useState(false);

  // 5. 동적 섹션 및 개별 컬럼 입력 상태
  const [sections, setSections] = useState(FRAME_TEMPLATES.KR_DEV_BACKEND?.sections || []);
  const [customSectionTitle, setCustomSectionTitle] = useState('');
  
  // ⭕ 컬럼 개별 관리를 위한 상태
  const [columnInput, setColumnInput] = useState('');
  const [customColumnsList, setCustomColumnsList] = useState(['제목/역할', '참여 기간', '상세 업무 및 성과']);

  // 템플릿 변경 시 섹션 목록 동기화
  useEffect(() => {
    if (FRAME_TEMPLATES[selectedFrame]) {
      setSections([...FRAME_TEMPLATES[selectedFrame].sections]);
    }
  }, [selectedFrame]);

  const categoryOptions = [
    '신입 개발자',
    '경력직 개발자',
    '인턴십 / 프로젝트',
    '기타 / 자유 양식'
  ];

  const ALLOWED_EXTENSIONS = [
    'pdf', 'doc', 'docx', 'hwp', 'hwpx', 'txt', 'rtf',
    'png', 'jpg', 'jpeg', 'webp', 'bmp', 'heic', 'heif', 'tiff'
  ];

  // ==========================================
  // 개별 컬럼 추가 / 삭제 핸들러 (버그 차단)
  // ==========================================
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

  // ==========================================
  // 새 섹션 등록 핸들러
  // ==========================================
  const handleAddSection = () => {
    if (!customSectionTitle.trim()) {
      alert('섹션 이름을 입력해 주세요.');
      return;
    }

    if (customColumnsList.length === 0) {
      alert('최소 하나 이상의 컬럼을 추가해 주세요.');
      return;
    }

    setSections(prev => [
      ...prev,
      {
        type: 'CUSTOM',
        title: `${prev.length + 1}. ${customSectionTitle.trim()}`,
        columns: [...customColumnsList]
      }
    ]);

    // 입력 필드 초기화
    setCustomSectionTitle('');
    setCustomColumnsList(['제목/역할', '참여 기간', '상세 업무 및 성과']);
    setColumnInput('');
  };

  const handleDeleteSection = (index) => {
    setSections(prev => prev.filter((_, i) => i !== index));
  };

  // ==========================================
  // 파일 핸들러
  // ==========================================
  const handleFileSelect = (file) => {
    if (!file) return;

    const fileName = file.name;
    const fileExt = fileName.split('.').pop()?.toLowerCase();

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
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // ==========================================
  // Submit 제출 핸들러
  // ==========================================
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim()) {
      alert('이력서 제목을 입력해 주세요.');
      return;
    }

    const userId = localStorage.getItem('userId');
    if (!userId) {
      alert('로그인이 필요합니다.');
      navigate('/login');
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage('');

      if (createMode === 'UPLOAD') {
        if (!selectedFile) {
          alert('분석할 이력서 파일이나 이미지를 등록해 주세요.');
          setIsLoading(false);
          return;
        }

        const formData = new FormData();
        formData.append('member_id', userId);
        formData.append('title', title.trim());
        formData.append('category', category);
        formData.append('file', selectedFile);

        const response = await fetch(`${BASE_URL}/api/resumes/upload`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || '파일 기반 이력서 파싱에 실패했습니다.');
        }

        const result = await response.json();
        if (result && result.id) {
          navigate(`/resume/${result.id}`);
        }
      } else {
        if (sections.length === 0) {
          alert('최소 1개 이상의 섹션이 필요합니다.');
          setIsLoading(false);
          return;
        }

        const formattedSections = sections.map((sec, idx) => ({
          section_type: sec.type || 'CUSTOM',
          section_title: sec.title,
          columns: sec.columns || ['항목', '내용'],
          display_order: idx + 1
        }));

        const requestData = {
          member_id: userId,
          title: title.trim(),
          category: category,
          custom_sections: formattedSections
        };

        const response = await fetch(`${BASE_URL}/api/resumes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestData),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || '이력서 생성에 실패했습니다.');
        }

        const result = await response.json();
        if (result && result.id) {
          navigate(`/resume/${result.id}`);
        }
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

  return (
    <div className="min-h-screen bg-[#07051E] text-slate-100 flex items-center justify-center p-6 font-sans">
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
            국가별 양식에 맞게 섹션과 세부 컬럼(Column) 구조가 자동 변경됩니다.
          </p>
        </div>

        {/* 모드 전환 탭 */}
        <div className="grid grid-cols-2 gap-2 p-1.5 bg-[#07051E] border border-indigo-950 rounded-2xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setCreateMode('MANUAL')}
            className={`py-2.5 rounded-xl transition-all ${
              createMode === 'MANUAL'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            프레임 & 컬럼 구성
          </button>
          <button
            type="button"
            onClick={() => setCreateMode('UPLOAD')}
            className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              createMode === 'UPLOAD'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            파일/이미지 업로드
          </button>
        </div>

        {errorMessage && (
          <div className="p-4 bg-rose-950/40 border border-rose-900/60 rounded-xl text-xs text-rose-300">
            ⚠️ {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 기본 제목 및 지원 카테고리 */}
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
              <label className="block text-xs font-semibold text-indigo-300">
                지원 직군 / 카테고리
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={isLoading}
                className="w-full p-3.5 text-sm text-white bg-[#07051E] border border-indigo-900/60 rounded-xl focus:outline-none focus:border-indigo-500 transition-all"
              >
                {categoryOptions.map((opt) => (
                  <option key={opt} value={opt} className="bg-[#0E0B2D] text-white">
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* TAB 1: 프레임 및 컬럼 직접 구성 */}
          {createMode === 'MANUAL' && (
            <div className="space-y-6 pt-2">
              
              {/* 국가/프레임 템플릿 선택 */}
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
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-bold text-slate-200 text-xs leading-snug break-words flex-1">
                            {tpl.name}
                          </p>
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-2 leading-tight">
                          {tpl.desc}
                        </p>
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

              {/* ⭕ 개선된 새 섹션 및 웹 기반 개별 컬럼 추가 UI */}
              <div className="space-y-3 p-5 bg-[#07051E]/60 border border-indigo-950 rounded-2xl">
                <label className="block text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
                  <Columns className="w-3.5 h-3.5 text-indigo-400" />
                  새 섹션 및 컬럼(Column) 추가
                </label>
                
                <div className="space-y-3">
                  {/* 섹션명 입력 */}
                  <input
                    type="text"
                    placeholder="섹션 이름 (예: 자격증 및 언어, 수상 내역, 프로젝트)"
                    value={customSectionTitle}
                    onChange={(e) => setCustomSectionTitle(e.target.value)}
                    className="w-full p-3 text-xs text-white bg-[#07051E] border border-indigo-900/60 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                  
                  {/* 개별 컬럼 추가 입력 창 */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="추가할 컬럼 항목명 (예: 자격증명, 취득일자, 발급기관)"
                      value={columnInput}
                      onChange={(e) => setColumnInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddColumnTag();
                        }
                      }}
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

                  {/* 추가 예정 컬럼 태그 목록 */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {customColumnsList.map((col, cIdx) => (
                      <span
                        key={cIdx}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-950 border border-indigo-800/60 text-indigo-200 text-xs rounded-lg"
                      >
                        📌 {col}
                        <button
                          type="button"
                          onClick={() => handleRemoveColumnTag(cIdx)}
                          className="hover:text-rose-400 transition-colors"
                        >
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

              {/* ⭕ 최종 섹션 & 컬럼 리스트 (높이 제한 스크롤 제거하여 전체 확장) */}
              <div className="space-y-3 pt-2 border-t border-indigo-950">
                <p className="text-xs font-semibold text-slate-300">
                  현재 이력서에 반영될 최종 섹션 ({sections.length}개)
                </p>
                <div className="space-y-2.5">
                  {sections.map((sec, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border bg-[#07051E]/90 border-indigo-900/50 text-xs space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Table className="w-4 h-4 text-indigo-400 shrink-0" />
                          <span className="font-bold text-slate-200 text-sm">{sec.title}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteSection(idx)}
                          className="text-slate-500 hover:text-rose-400 p-1 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* 섹션별 하위 컬럼 바 */}
                      <div className="flex flex-wrap gap-1.5">
                        {sec.columns?.map((col, cIdx) => (
                          <span
                            key={cIdx}
                            className="px-2.5 py-1 bg-indigo-950/80 border border-indigo-800/40 text-indigo-300 text-[11px] rounded-lg font-medium"
                          >
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

          {/* TAB 2: 파일 업로드 */}
          {createMode === 'UPLOAD' && (
            <div className="space-y-3 pt-2">
              <label className="block text-xs font-semibold text-indigo-300">
                기존 이력서 파일/이미지 등록
              </label>

              {!selectedFile ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer ${
                    isDragging
                      ? 'border-indigo-400 bg-indigo-950/40'
                      : 'border-indigo-900/60 bg-[#07051E]/60 hover:border-indigo-600'
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
                      <p className="text-sm font-medium text-slate-200">
                        클릭하여 파일 선택 또는 드래그 & 드롭
                      </p>
                      <p className="text-xs text-indigo-300 font-medium">
                        PDF · Word · 한글(HWP/HWPX) · 이미지 지원
                      </p>
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

                  <button
                    type="button"
                    onClick={() => { setSelectedFile(null); setFilePreview(null); }}
                    className="p-1.5 text-slate-500 hover:text-rose-400 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 제출 버튼 */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 flex items-center justify-center gap-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:bg-indigo-950/50 border border-indigo-500/30 rounded-xl shadow-lg transition-all"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-indigo-200" />
                <span>{createMode === 'UPLOAD' ? '파일 분석 중...' : '맞춤형 이력서 프레임 생성 중...'}</span>
              </>
            ) : (
              <span>
                {createMode === 'UPLOAD' ? '파일로 이력서 자동 분석 및 생성' : '선택한 컬럼 구조로 이력서 생성'}
              </span>
            )}
          </button>
        </form>

      </div>
    </div>
  );
};

export default ResumeNew;