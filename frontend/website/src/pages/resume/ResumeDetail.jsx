import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Edit3, Loader2, Download, User, Mail, Phone, Calendar, 
  MapPin, GraduationCap, Award, Briefcase, CheckCircle2, ChevronDown, ChevronUp, Sparkles,
  FileText, Cpu, Search, Building2, ExternalLink, CheckCircle, AlertTriangle, Lightbulb,
  BarChart3, Tag, Check, Info, RefreshCw
} from 'lucide-react';

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const generateUniqueId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 11);
};

const parseDetailsToTableSchema = (details, secColumns = [], secVersion = 'ORIGINAL') => {
  let targetColumns = Array.isArray(secColumns) && secColumns.length > 0 
    ? [...secColumns] 
    : [
        "Project Name (프로젝트명 & 역할)",
        "Timeline (기간)",
        "Tech Stack (사용 기술)",
        "Architecture & Impact (아키텍처 및 기술적 성과)"
      ];

  if (!details) {
    return { columns: targetColumns, rows: [] };
  }

  const rawList = Array.isArray(details) ? details : [details];
  const extractedRows = [];

  rawList.forEach((cardObj) => {
    const rowValues = {};

    // 💡 AI 교정 버전이고 column_values가 존재하는 경우 직접 매핑
    if (secVersion === 'AI' && cardObj.column_values && typeof cardObj.column_values === 'object') {
      const aiCols = cardObj.ai_columns || Object.keys(cardObj.column_values);
      
      // 동적으로 생성된 AI 컬럼들을 targetColumns에 반영
      aiCols.forEach(col => {
        if (!targetColumns.includes(col)) {
          targetColumns.push(col);
        }
      });

      targetColumns.forEach(col => {
        rowValues[col] = cardObj.column_values[col] || '';
      });
    } else {
      // 기존 원본 / 맞춤법 / \n\n 블록 파싱 방식
      targetColumns.forEach(col => {
        rowValues[col] = '';
      });

      let textToParse = cardObj.original_text || '';
      if (secVersion === 'SPELL' && cardObj.spell_checked_text) {
        textToParse = cardObj.spell_checked_text;
      } else if (secVersion === 'AI' && cardObj.ai_proofread_text) {
        textToParse = cardObj.ai_proofread_text;
      }

      if (textToParse) {
        const blocks = textToParse.split(/\n\s*\n/);
        blocks.forEach((block) => {
          const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
          if (lines.length === 0) return;

          if (lines[0].startsWith('[') && lines[0].endsWith(']')) {
            const rawKeyName = lines[0].slice(1, -1).trim();
            
            let matchedCol = targetColumns.find(c => 
              c === rawKeyName || 
              c.toLowerCase().includes(rawKeyName.toLowerCase()) || 
              rawKeyName.toLowerCase().includes(c.toLowerCase().split(' ')[0])
            );
            
            if (!matchedCol) {
              if (rawKeyName.includes('프로젝트') || rawKeyName.includes('역할') || rawKeyName.includes('Name')) {
                matchedCol = targetColumns[0];
              } else if (rawKeyName.includes('기간') || rawKeyName.includes('Timeline')) {
                matchedCol = targetColumns[1];
              } else if (rawKeyName.includes('기술') || rawKeyName.includes('Stack')) {
                matchedCol = targetColumns[2];
              } else {
                matchedCol = targetColumns[3] || targetColumns[0];
              }
            }

            const cleanContent = lines
              .slice(1)
              .map((l) => l.replace(/^[•\-\*\s]+/, ''))
              .join('\n');

            if (matchedCol) {
              rowValues[matchedCol] = rowValues[matchedCol] 
                ? `${rowValues[matchedCol]}\n${cleanContent}` 
                : cleanContent;
            }
          } else {
            const defaultCol = targetColumns[3] || targetColumns[0];
            const cleanLines = lines.map((l) => l.replace(/^[•\-\*\s]+/, '')).join('\n');
            rowValues[defaultCol] = rowValues[defaultCol] ? `${rowValues[defaultCol]}\n${cleanLines}` : cleanLines;
          }
        });
      }
    }

    if (cardObj.title && cardObj.title !== '세부 항목' && !rowValues[targetColumns[0]]) {
      rowValues[targetColumns[0]] = cardObj.title;
    }

    extractedRows.push({
      id: cardObj.id || generateUniqueId(),
      rawObj: cardObj,
      values: rowValues
    });
  });

  return { columns: targetColumns, rows: extractedRows };
};

const ResumeDetail = () => {
  const { resumeId } = useParams();
  const navigate = useNavigate();

  const [activeMainTab, setActiveMainTab] = useState('document');

  const [resume, setResume] = useState(null);
  const [sections, setSections] = useState([]);
  
  const [sectionVersions, setSectionVersions] = useState({});
  const [processingSections, setProcessingSections] = useState({});

  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone_number: '',
    birth_date: '',
    gender: 'M',
    avatar_url: '',
    address: '',
    detail_address: ''
  });
  const [educations, setEducations] = useState([]);
  const [certificates, setCertificates] = useState([]);

  const [showAllEducations, setShowAllEducations] = useState(false);
  const [showAllCertificates, setShowAllCertificates] = useState(false);

  const visibleEducations = showAllEducations ? educations : educations.slice(0, 3);
  const visibleCertificates = showAllCertificates ? certificates : certificates.slice(0, 3);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const [expandedCells, setExpandedCells] = useState({});

  const [topN, setTopN] = useState(3);
  const [isRecommending, setIsRecommending] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [topKeywords, setTopKeywords] = useState([]);
  
  const [selectedJob, setSelectedJob] = useState(null);
  const [expandedJobDetails, setExpandedJobDetails] = useState({});
  const [isAnalyzingFeedback, setIsAnalyzingFeedback] = useState(false);
  const [feedbackReport, setFeedbackReport] = useState(null);
  const [analyzedJobRank, setAnalyzedJobRank] = useState(null);
  const [analysisError, setAnalysisError] = useState('');

  const userId = localStorage.getItem('userId');

  const toggleCellExpand = (cellKey) => {
    setExpandedCells((prev) => ({
      ...prev,
      [cellKey]: !prev[cellKey]
    }));
  };

  const toggleJobDetailExpand = (jobRank, e) => {
    e.stopPropagation();
    setExpandedJobDetails((prev) => ({
      ...prev,
      [jobRank]: !prev[jobRank]
    }));
  };

  const handleSelectJob = (job) => {
    if (selectedJob?.rank !== job.rank) {
      setSelectedJob(job);
      if (analyzedJobRank !== job.rank) {
        setFeedbackReport(null);
      }
    }
  };

  const handleSectionVersionChange = async (sectionId, version) => {
    setSectionVersions((prev) => ({
      ...prev,
      [sectionId]: version
    }));

    try {
      await fetch(`${BASE_URL}/api/sections/${sectionId}/version`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selected_version: version })
      });
    } catch (err) {
      console.error('버전 업데이트 실패:', err);
    }
  };

  const handleSpellCheckSection = async (sectionId) => {
    setSectionVersions((prev) => ({ ...prev, [sectionId]: 'SPELL' }));

    const targetSection = sections.find((s) => s.id === sectionId);
    if (!targetSection || !targetSection.details) return;

    try {
      setProcessingSections((prev) => ({ ...prev, [sectionId]: 'SPELL' }));

      const response = await fetch(`${BASE_URL}/api/sections/${sectionId}/spell-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          details: targetSection.details.map((d) => ({
            id: d.id,
            original_text: d.original_text || ''
          }))
        })
      });

      if (response.ok) {
        const result = await response.json();

        const updatedDetails = targetSection.details.map((detail) => {
          const checkedItem = result.find((item) => item.id === detail.id);
          return {
            ...detail,
            selected_version: 'SPELL',
            spell_checked_text: checkedItem ? checkedItem.spell_checked_text : detail.spell_checked_text
          };
        });

        setSections((prevSections) =>
          prevSections.map((sec) => (sec.id === sectionId ? { ...sec, details: updatedDetails } : sec))
        );

        await fetch(`${BASE_URL}/api/resumes/sections/${sectionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            selected_version: 'SPELL',
            details: updatedDetails
          })
        });
      }
    } catch (err) {
      console.error('맞춤법 교정 API 오류:', err);
    } finally {
      setProcessingSections((prev) => ({ ...prev, [sectionId]: null }));
    }
  };

  const handleAIProofreadSection = async (sectionId) => {
    setSectionVersions((prev) => ({ ...prev, [sectionId]: 'AI' }));

    const targetSection = sections.find((s) => s.id === sectionId);
    if (!targetSection || !targetSection.details) return;

    try {
      setProcessingSections((prev) => ({ ...prev, [sectionId]: 'AI' }));

      const response = await fetch(`${BASE_URL}/api/sections/${sectionId}/ai-proofread`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          details: targetSection.details.map((d) => ({
            id: d.id,
            original_text: d.original_text || ''
          }))
        })
      });

      if (response.ok) {
        const result = await response.json();

        const updatedDetails = targetSection.details.map((detail) => {
          const proofreadItem = result.find((item) => item.id === detail.id);
          return {
            ...detail,
            selected_version: 'AI',
            ai_proofread_text: proofreadItem ? proofreadItem.ai_proofread_text : detail.ai_proofread_text,
            ai_columns: proofreadItem ? proofreadItem.ai_columns : detail.ai_columns,
            column_values: proofreadItem ? proofreadItem.column_values : detail.column_values
          };
        });

        setSections((prevSections) =>
          prevSections.map((sec) => (sec.id === sectionId ? { ...sec, details: updatedDetails } : sec))
        );

        await fetch(`${BASE_URL}/api/resumes/sections/${sectionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            selected_version: 'AI',
            details: updatedDetails
          })
        });
      }
    } catch (err) {
      console.error('AI 교정 API 오류:', err);
    } finally {
      setProcessingSections((prev) => ({ ...prev, [sectionId]: null }));
    }
  };

  const handleFetchRecommendationsLsi = async () => {
    try {
      setIsRecommending(true);
      setAnalysisError('');
      setFeedbackReport(null);
      setAnalyzedJobRank(null);
      setSelectedJob(null);

      let currentResumeText = "";
      
      if (profile.name) currentResumeText += `[이름] ${profile.name}\n`;
      if (educations.length > 0) {
        currentResumeText += `[학력]\n` + educations.map(e => `${e.school_name} ${e.major} (${e.status})`).join('\n') + '\n';
      }
      if (certificates.length > 0) {
        currentResumeText += `[자격증]\n` + certificates.map(c => `${c.certificate_name} (${c.issuing_organization || ''})`).join('\n') + '\n';
      }

      formattedSections.forEach((sec) => {
        currentResumeText += `\n[${sec.section_title}]\n`;
        sec.rows.forEach((row) => {
          Object.entries(row.values).forEach(([colName, val]) => {
            if (val) currentResumeText += `${colName}: ${val}\n`;
          });
        });
      });

      if (!currentResumeText.trim()) {
        currentResumeText = resume?.title || "소프트웨어 개발자 이력서";
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000);

      const recRes = await fetch(`${BASE_URL}/api/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_resume: currentResumeText,
          top_n: parseInt(topN, 10)
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!recRes.ok) throw new Error(`서버 응답 오류: ${recRes.status}`);
      const recData = await recRes.json();
      
      setRecommendations(recData.recommendations || []);
      setTopKeywords(recData.top_tech_keywords || []);

      if (recData.recommendations && recData.recommendations.length > 0) {
        setSelectedJob(recData.recommendations[0]);
      }
    } catch (err) {
      console.error('공고 추천 실패:', err);
      if (err.name === 'AbortError') {
        setAnalysisError('서버 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.');
      } else {
        setAnalysisError(err.message || '서버와 통신하지 못했습니다.');
      }
    } finally {
      setIsRecommending(false);
    }
  };

  const handleRunFeedbackAnalysis = async () => {
    if (!selectedJob) {
      alert('분석을 진행할 공고를 먼저 선택해 주세요.');
      return;
    }

    try {
      setIsAnalyzingFeedback(true);
      setAnalysisError('');

      const fbRes = await fetch(`${BASE_URL}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_id: resumeId,
          top_jd_text: selectedJob.full_jd_text
        })
      });

      if (!fbRes.ok) throw new Error('AI 피드백 리포트 생성에 실패했습니다.');
      const fbData = await fbRes.json();
      
      setFeedbackReport(fbData);
      setAnalyzedJobRank(selectedJob.rank);

    } catch (err) {
      console.error('피드백 분석 실패:', err);
      setAnalysisError(err.message);
    } finally {
      setIsAnalyzingFeedback(false);
    }
  };

  useEffect(() => {
    if (!userId) {
      alert('로그인이 필요합니다.');
      navigate('/login');
      return;
    }

    const fetchAllData = async () => {
      try {
        setIsLoading(true);

        const profileRes = await fetch(`${BASE_URL}/users/${userId}`);
        if (profileRes.ok) {
          const result = await profileRes.json();
          const data = result.data ? result.data : result;
          setProfile({
            name: data.name || '',
            email: data.email || '',
            phone_number: data.phone_number || '',
            birth_date: data.birth_date || '',
            gender: data.gender || 'M',
            avatar_url: data.avatar_url || '',
            address: data.address || '',
            detail_address: data.detail_address || ''
          });
        }

        const eduRes = await fetch(`${BASE_URL}/api/profile-settings/educations/${userId}`);
        if (eduRes.ok) {
          const eduData = await eduRes.json();
          setEducations(eduData);
        }

        const certRes = await fetch(`${BASE_URL}/api/profile-settings/certificates/${userId}`);
        if (certRes.ok) {
          const certData = await certRes.json();
          setCertificates(certData);
        }

        const resumeRes = await fetch(`${BASE_URL}/api/resumes/${resumeId}`);
        const resumeData = await resumeRes.json();
        setResume(resumeData);

        if (resumeData.sections && Array.isArray(resumeData.sections)) {
          setSections(resumeData.sections);

          const initialVersions = {};
          resumeData.sections.forEach((sec) => {
            initialVersions[sec.id] = sec.selected_version || 'ORIGINAL';
          });
          setSectionVersions(initialVersions);
        }

      } catch (err) {
        console.error('데이터 로딩 에러:', err);
        setErrorMessage(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    if (resumeId) fetchAllData();
  }, [resumeId, userId, navigate]);

  const getColumnWidthClass = (colName, textValue = '') => {
    const isDetail = colName.includes('상세') || colName.includes('성과') || colName.includes('업무') || colName.includes('내용') || colName.includes('소개');
    const isShort = colName.includes('기간') || colName.includes('날짜') || colName.includes('역할') || colName.includes('일자');

    if (isDetail || textValue.length > 80) {
      return 'flex-[3] min-w-[350px]';
    }
    if (isShort || textValue.length < 20) {
      return 'flex-[1] min-w-[140px] max-w-[200px]';
    }
    return 'flex-[1.5] min-w-[180px]';
  };

  const formattedSections = sections.map((sec) => {
    const secVersion = sectionVersions[sec.id] || sec.selected_version || 'ORIGINAL';
    const { columns, rows } = parseDetailsToTableSchema(sec.details, sec.columns, secVersion);
    return { ...sec, columns, rows, currentVersion: secVersion };
  });

  const fullAddress = profile.address ? `${profile.address} ${profile.detail_address || ''}`.trim() : '';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#070b19] flex flex-col items-center justify-center text-slate-300 gap-3 font-sans">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        <p className="text-sm font-medium">이력서 문서를 구성하는 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070b19] text-slate-100 p-6 md:p-12 font-sans overflow-y-auto">
      <div className="w-full max-w-5xl mx-auto space-y-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0a1024] px-6 py-4 rounded-2xl border border-emerald-950/80 shadow-lg">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/resume')}
              className="flex items-center gap-2 px-3.5 py-2 bg-[#070b19] hover:bg-emerald-950/40 border border-emerald-950 rounded-xl text-slate-300 hover:text-emerald-300 transition text-xs font-semibold"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>이전 목록</span>
            </button>
            <div className="h-4 w-[1px] bg-emerald-950/80 hidden sm:block" />
            <div>
              <span className="text-[10px] font-bold px-2.5 py-0.5 bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 rounded-full">
                {resume?.category || '일반 이력서'}
              </span>
              <h1 className="text-lg md:text-xl font-black text-white mt-0.5 tracking-tight">
                {resume?.title || '이력서 문서'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-auto">
            <button
              onClick={() => navigate(`/resume/${resumeId}/edit`)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-[#070b19] hover:bg-emerald-950/30 text-emerald-300 font-semibold text-xs rounded-xl transition border border-emerald-950/80 shadow-sm"
            >
              <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
              <span>편집</span>
            </button>

            <button
              onClick={() => navigate(`/resume/${resumeId}/download`)}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/30 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>PDF 다운로드</span>
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="p-4 bg-rose-950/40 border border-rose-900/60 rounded-2xl text-xs text-rose-300">
            ⚠️ {errorMessage}
          </div>
        )}

        <div className="flex items-center gap-2 border-b border-emerald-950/80 pb-1">
          <button
            onClick={() => setActiveMainTab('document')}
            className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm rounded-t-2xl transition-all border-t border-x ${
              activeMainTab === 'document'
                ? 'bg-[#0f152d] text-emerald-300 border-emerald-900/80 shadow-lg'
                : 'bg-transparent text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <FileText className="w-4 h-4 text-emerald-400" />
            이력서 상세 및 내역
          </button>

          <button
            onClick={() => setActiveMainTab('analysis')}
            className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm rounded-t-2xl transition-all border-t border-x ${
              activeMainTab === 'analysis'
                ? 'bg-[#0f152d] text-amber-300 border-emerald-900/80 shadow-lg'
                : 'bg-transparent text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <Cpu className="w-4 h-4 text-amber-400" />
            AI 공고 추천 & 역량 피드백 리포트
          </button>
        </div>

        <div className="bg-[#0f152d] border border-emerald-950/60 rounded-3xl p-6 md:p-10 shadow-2xl space-y-10 relative overflow-hidden">
          
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />

          {activeMainTab === 'document' && (
            <>
              <section className="space-y-6">
                <div className="flex items-center justify-between border-b border-emerald-950/80 pb-4">
                  <h2 className="text-sm font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    인적 사항 및 프로필
                  </h2>
                </div>

                <div className="flex flex-col md:flex-row items-center md:items-start gap-6 bg-[#0a1024] p-6 rounded-2xl border border-emerald-950/80">
                  {profile.avatar_url && (
                    <div className="relative shrink-0">
                      <img
                        src={profile.avatar_url}
                        alt="프로필 이미지"
                        className="w-24 h-32 object-cover rounded-xl border-2 border-emerald-500/40 shadow-md"
                      />
                    </div>
                  )}

                  <div className="flex-1 space-y-3 text-center md:text-left w-full">
                    {profile.name && (
                      <div>
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                          <h3 className="text-xl font-extrabold text-white">{profile.name}</h3>
                          {profile.gender && (
                            <span className="text-[11px] font-semibold text-emerald-300 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                              {profile.gender === 'M' ? '남성' : '여성'}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs">
                      {profile.birth_date && (
                        <div className="flex items-center gap-2 p-2.5 bg-[#070b19] rounded-xl border border-emerald-950/60">
                          <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="text-slate-300 truncate">{profile.birth_date}</span>
                        </div>
                      )}
                      {profile.phone_number && (
                        <div className="flex items-center gap-2 p-2.5 bg-[#070b19] rounded-xl border border-emerald-950/60">
                          <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="text-slate-300 truncate">{profile.phone_number}</span>
                        </div>
                      )}
                      {profile.email && (
                        <div className="flex items-center gap-2 p-2.5 bg-[#070b19] rounded-xl border border-emerald-950/60">
                          <Mail className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="text-slate-300 truncate">{profile.email}</span>
                        </div>
                      )}
                      {fullAddress && (
                        <div className="flex items-center gap-2 p-2.5 bg-[#070b19] rounded-xl border border-emerald-950/60 sm:col-span-2 md:col-span-3">
                          <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="text-slate-300 truncate">{fullAddress}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              {(educations.length > 0 || certificates.length > 0) && (
                <div className={`grid grid-cols-1 ${educations.length > 0 && certificates.length > 0 ? 'lg:grid-cols-2' : ''} gap-6 pt-2`}>
                  
                  {educations.length > 0 && (
                    <section className="space-y-4">
                      <div className="flex items-center justify-between border-b border-emerald-950/80 pb-3">
                        <h2 className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                          <GraduationCap className="w-4 h-4" />
                          학력 사항 ({educations.length})
                        </h2>
                      </div>

                      <div className="space-y-2.5">
                        {visibleEducations.map((edu) => (
                          <div key={edu.id} className="p-3.5 bg-[#0a1024] rounded-2xl border border-emerald-950/80 flex items-center justify-between gap-3">
                            <div>
                              <h4 className="text-xs font-bold text-slate-100">{edu.school_name}</h4>
                              <p className="text-[11px] text-emerald-300/80 mt-0.5">{edu.major}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="px-2 py-0.5 bg-[#070b19] text-emerald-300 text-[10px] rounded border border-emerald-950 font-medium">
                                {edu.status}
                              </span>
                              <p className="text-[10px] text-slate-400 font-mono mt-1">
                                {edu.admission_date} ~ {edu.graduation_date || '재학'}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {educations.length > 3 && (
                        <button
                          onClick={() => setShowAllEducations(!showAllEducations)}
                          className="w-full py-2 bg-[#0a1024] hover:bg-emerald-950/30 border border-emerald-950/80 rounded-xl text-[11px] text-emerald-300 font-semibold flex items-center justify-center gap-1 transition"
                        >
                          {showAllEducations ? <><span>접기</span><ChevronUp className="w-3.5 h-3.5" /></> : <><span>더보기 ({educations.length - 3})</span><ChevronDown className="w-3.5 h-3.5" /></>}
                        </button>
                      )}
                    </section>
                  )}

                  {certificates.length > 0 && (
                    <section className="space-y-4">
                      <div className="flex items-center justify-between border-b border-emerald-950/80 pb-3">
                        <h2 className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                          <Award className="w-4 h-4" />
                          자격증 및 면허 ({certificates.length})
                        </h2>
                      </div>

                      <div className="space-y-2.5">
                        {visibleCertificates.map((cert) => (
                          <div key={cert.id} className="p-3.5 bg-[#0a1024] rounded-2xl border border-emerald-950/80 flex items-center justify-between gap-3">
                            <div>
                              <h4 className="text-xs font-bold text-slate-100">{cert.certificate_name}</h4>
                              <p className="text-[11px] text-emerald-300/80 mt-0.5">{cert.issuing_organization || '-'}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-[10px] font-mono text-slate-300 block">{cert.certificate_number || '-'}</span>
                              <p className="text-[10px] text-slate-400 font-mono mt-1">{cert.acquisition_date || '-'}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {certificates.length > 3 && (
                        <button
                          onClick={() => setShowAllCertificates(!showAllCertificates)}
                          className="w-full py-2 bg-[#0a1024] hover:bg-emerald-950/30 border border-emerald-950/80 rounded-xl text-[11px] text-emerald-300 font-semibold flex items-center justify-center gap-1 transition"
                        >
                          {showAllCertificates ? <><span>접기</span><ChevronUp className="w-3.5 h-3.5" /></> : <><span>더보기 ({certificates.length - 3})</span><ChevronDown className="w-3.5 h-3.5" /></>}
                        </button>
                      )}
                    </section>
                  )}

                </div>
              )}

              {formattedSections.length > 0 && (
                <section className="space-y-8 pt-4 border-t border-emerald-950/80">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      이력서 본문 및 경력/프로젝트 성과
                    </h2>
                  </div>

                  <div className="space-y-8">
                    {formattedSections.map((sec) => (
                      <div key={sec.id} className="bg-[#0a1024] border border-emerald-950/80 rounded-2xl p-6 space-y-5 shadow-inner">
                        
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-950 pb-4">
                          <div className="flex items-center gap-2.5">
                            <Briefcase className="w-4 h-4 text-emerald-400" />
                            <h3 className="text-sm font-black text-white">{sec.section_title || '세부 정보'}</h3>
                            <span className="text-[10px] text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                              {sec.rows ? sec.rows.length : 0}개 항목
                            </span>
                          </div>

                          <div className="flex items-center gap-1 bg-[#070b19] p-1 rounded-xl border border-emerald-950/80">
                            <button
                              type="button"
                              onClick={() => handleSectionVersionChange(sec.id, 'ORIGINAL')}
                              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition ${
                                sec.currentVersion === 'ORIGINAL'
                                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm'
                                  : 'text-slate-400 hover:text-emerald-200'
                              }`}
                            >
                              원본
                            </button>

                            <button
                              type="button"
                              onClick={() => handleSpellCheckSection(sec.id)}
                              disabled={processingSections[sec.id] === 'SPELL'}
                              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1 ${
                                sec.currentVersion === 'SPELL'
                                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm'
                                  : 'text-slate-400 hover:text-emerald-200'
                              }`}
                            >
                              {processingSections[sec.id] === 'SPELL' ? <Loader2 className="w-3 h-3 animate-spin" /> : '맞춤법'}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleAIProofreadSection(sec.id)}
                              disabled={processingSections[sec.id] === 'AI'}
                              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1 ${
                                sec.currentVersion === 'AI'
                                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm'
                                  : 'text-slate-400 hover:text-emerald-200'
                              }`}
                            >
                              {processingSections[sec.id] === 'AI' ? (
                                <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                              ) : (
                                <>
                                  <Sparkles className="w-3 h-3 text-amber-400" />
                                  AI 교정
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-4">
                          {sec.rows && sec.rows.length > 0 && (
                            sec.rows.map((row, rIdx) => (
                              <div key={row.id} className="bg-[#070b19] border border-emerald-950 rounded-xl p-4 space-y-3 shadow-sm">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> 항목 #{rIdx + 1}
                                  </span>
                                </div>

                                <div className="overflow-x-auto pb-1">
                                  <div className="flex gap-3 min-w-full items-start">
                                    {(sec.columns || []).map((col) => {
                                      const val = row.values[col] || '';
                                      const cellKey = `${sec.id}-${row.id}-${col}`;
                                      const isExpanded = !!expandedCells[cellKey];

                                      const lines = val ? val.split('\n').filter((l) => l.trim()) : [];
                                      const isLongContent = lines.length > 2 || val.length > 45;

                                      const widthClass = getColumnWidthClass(col, val);

                                      return (
                                        <div
                                          key={col}
                                          className={`${widthClass} bg-[#040711] p-3 rounded-xl border border-emerald-950/80 flex flex-col transition-all ${
                                            isExpanded ? 'h-auto' : 'h-28'
                                          }`}
                                        >
                                          <span className="text-[11px] font-bold text-emerald-300 border-b border-emerald-950 pb-1.5 mb-1.5 truncate shrink-0">
                                            {col}
                                          </span>

                                          <div className="relative flex-1 overflow-hidden">
                                            <div
                                              className={`text-xs text-slate-200 leading-relaxed font-sans ${
                                                !isExpanded && isLongContent ? 'max-h-10 overflow-hidden' : ''
                                              }`}
                                            >
                                              {val ? (
                                                lines.map((line, lIdx) => {
                                                  const clean = line.replace(/^[•\-\*\s]+/, '').trim();
                                                  if (!clean) return null;
                                                  return (
                                                    <div key={lIdx} className="flex items-start gap-1.5 my-0.5">
                                                      <span className="text-emerald-400 shrink-0">•</span>
                                                      <span className="break-all">{clean}</span>
                                                    </div>
                                                  );
                                                })
                                              ) : (
                                                <span className="text-slate-600 italic text-[10px]">내용 없음</span>
                                              )}
                                            </div>

                                            {!isExpanded && isLongContent && (
                                              <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-[#040711] to-transparent pointer-events-none" />
                                            )}
                                          </div>

                                          {isLongContent && (
                                            <button
                                              onClick={() => toggleCellExpand(cellKey)}
                                              className="mt-1.5 pt-1.5 border-t border-emerald-950 text-[10px] font-semibold text-emerald-400 hover:text-emerald-300 flex items-center justify-center gap-1 w-full shrink-0 transition"
                                            >
                                              {isExpanded ? (
                                                <><span>접기</span><ChevronUp className="w-3 h-3" /></>
                                              ) : (
                                                <><span>자세히 보기</span><ChevronDown className="w-3 h-3" /></>
                                              )}
                                            </button>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>

                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          {activeMainTab === 'analysis' && (
            <div className="space-y-6">
              
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0a1024] p-5 rounded-2xl border border-emerald-950/80 shadow-lg">
                <div>
                  <h3 className="text-sm font-bold text-white">AI 채용 공고 매칭 및 역량 피드백</h3>
                  <p className="text-xs text-slate-400 mt-0.5">작성된 이력서 내역 및 프로젝트 경험을 분석하여 최적의 채용 공고를 추천받고 맞춤형 피드백을 확인하세요.</p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-[#070b19] px-3 py-2 rounded-xl border border-emerald-950">
                    <span className="text-xs font-semibold text-emerald-300">개수:</span>
                    <select
                      value={topN}
                      onChange={(e) => setTopN(e.target.value)}
                      className="bg-[#0a1024] text-white text-xs font-bold outline-none cursor-pointer rounded-lg px-2 py-1 border border-emerald-900"
                    >
                      <option value={3}>Top 3</option>
                      <option value={5}>Top 5</option>
                      <option value={10}>Top 10</option>
                    </select>
                  </div>

                  <button
                    onClick={handleFetchRecommendationsLsi}
                    disabled={isRecommending}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center gap-2 shrink-0 disabled:opacity-50"
                  >
                    {isRecommending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    맞춤 공고 추천 실행
                  </button>
                </div>
              </div>

              {analysisError && (
                <div className="p-4 bg-rose-950/40 border border-rose-900/60 rounded-xl text-xs text-rose-300">
                  ⚠️ {analysisError}
                </div>
              )}

              {recommendations.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  
                  <div className="lg:col-span-6 space-y-4">
                    <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                      <Building2 className="w-4 h-4" /> 추천 공고 Top {recommendations.length}
                    </h3>

                    <div className="space-y-3 max-h-[520px] overflow-y-auto pr-2">
                      {recommendations.map((job) => {
                        const isSelected = selectedJob?.rank === job.rank;
                        const isExpanded = !!expandedJobDetails[job.rank];

                        return (
                          <div
                            key={job.rank}
                            onClick={() => handleSelectJob(job)}
                            className={`cursor-pointer transition-all p-5 rounded-2xl border ${
                              isSelected
                                ? 'bg-[#0a1c2e] border-emerald-500 shadow-lg ring-1 ring-emerald-500'
                                : 'bg-[#0a1024] border-emerald-950/80 hover:border-emerald-800/60 opacity-80 hover:opacity-100'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full border ${
                                  isSelected 
                                    ? 'bg-emerald-600 text-white border-emerald-400' 
                                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                }`}>
                                  {job.rank}위 추천
                                </span>
                                {isSelected && (
                                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800">
                                    <Check className="w-3 h-3" /> 선택됨
                                  </span>
                                )}
                              </div>
                              <span className="text-xs font-extrabold text-amber-400">일치도 {job.similarity_score}%</span>
                            </div>

                            <div>
                              <h4 className="text-sm font-bold text-white truncate">{job.title}</h4>
                              <p className="text-xs text-slate-400 mt-0.5">{job.company}</p>
                            </div>

                            {job.matched_keywords && job.matched_keywords.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-3">
                                {job.matched_keywords.map((kw, i) => (
                                  <span key={i} className="px-2 py-0.5 bg-[#070b19] text-emerald-300 border border-emerald-950 text-[10px] font-semibold rounded-md">
                                    #{kw}
                                  </span>
                                ))}
                              </div>
                            )}

                            <div className="mt-4 pt-3 border-t border-emerald-950 flex items-center justify-between">
                              <button
                                type="button"
                                onClick={(e) => toggleJobDetailExpand(job.rank, e)}
                                className="text-xs font-semibold text-emerald-300 hover:text-white flex items-center gap-1"
                              >
                                <Info className="w-3.5 h-3.5 text-emerald-400" />
                                {isExpanded ? "상세 정보 접기" : "공고 상세 자격 보기"}
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>

                              {job.job_url && (
                                <a
                                  href={job.job_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
                                >
                                  원문 <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>

                            {isExpanded && (
                              <div className="mt-3 p-4 bg-[#070b19] rounded-xl border border-emerald-950 text-xs text-slate-300 space-y-2">
                                <p className="leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                                  {job.full_jd_text || "세부 공고 내용이 없습니다."}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {topKeywords.length > 0 && (
                      <div className="bg-[#0a1024] border border-emerald-950/80 rounded-2xl p-5 shadow-lg space-y-3">
                        <h4 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-emerald-400" /> 주요 요구 기술 키워드
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {topKeywords.map((item, idx) => (
                            <span key={idx} className="px-2.5 py-1 bg-[#070b19] text-slate-300 border border-emerald-950 text-xs rounded-lg">
                              {item.keyword} <strong className="text-emerald-400">{item.count}회</strong>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="lg:col-span-6 space-y-4">
                    <div className="bg-[#0a1024] border border-emerald-950/80 rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div>
                        <span className="text-xs font-bold text-amber-400">AI 역량 피드백 분석</span>
                        <h3 className="text-sm font-bold text-white mt-0.5">
                          {selectedJob ? `[${selectedJob.company}] ${selectedJob.title}` : "공고를 선택해주세요."}
                        </h3>
                      </div>

                      <button
                        onClick={handleRunFeedbackAnalysis}
                        disabled={!selectedJob || isAnalyzingFeedback}
                        className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center gap-2 shrink-0 disabled:opacity-40"
                      >
                        {isAnalyzingFeedback ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        {feedbackReport && analyzedJobRank === selectedJob?.rank ? "피드백 다시 실행" : "AI 피드백 실행"}
                      </button>
                    </div>

                    {feedbackReport && analyzedJobRank === selectedJob?.rank ? (
                      <div className="bg-[#0a1024] border border-emerald-950/80 rounded-2xl p-6 shadow-xl space-y-6 animate-fadeIn">
                        <div className="bg-[#070b19] border border-emerald-950 rounded-xl p-4 space-y-2">
                          <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                            <BarChart3 className="w-4 h-4" /> 맞춤 분석 총평
                          </span>
                          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-sans">
                            {feedbackReport.match_summary}
                          </p>
                        </div>

                        <div className="space-y-4">
                          <div className="bg-[#070b19] border border-emerald-950/80 rounded-xl p-4 space-y-2">
                            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                              <CheckCircle className="w-4 h-4" /> 이력서의 주요 강점
                            </span>
                            <ul className="space-y-1 text-xs text-slate-300">
                              {feedbackReport.strengths?.map((item, i) => (
                                <li key={i} className="flex items-start gap-1.5">
                                  <span className="text-emerald-400">•</span>
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className="bg-[#070b19] border border-amber-950/80 rounded-xl p-4 space-y-2">
                            <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                              <AlertTriangle className="w-4 h-4" /> 보완이 필요한 역량 및 키워드
                            </span>
                            <ul className="space-y-1 text-xs text-slate-300">
                              {feedbackReport.missing_skills?.map((item, i) => (
                                <li key={i} className="flex items-start gap-1.5">
                                  <span className="text-amber-400">•</span>
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className="bg-[#070b19] border border-emerald-950/80 rounded-xl p-4 space-y-2">
                            <span className="text-xs font-bold text-teal-400 flex items-center gap-1.5">
                              <Lightbulb className="w-4 h-4" /> 합격률을 높이기 위한 이력서 개선 제안
                            </span>
                            <ul className="space-y-1 text-xs text-slate-300">
                              {feedbackReport.improvement_suggestions?.map((item, i) => (
                                <li key={i} className="flex items-start gap-1.5">
                                  <span className="text-teal-400">•</span>
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-[#0a1024] border border-emerald-950/80 rounded-2xl p-10 text-center text-slate-400 text-xs italic flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="w-5 h-5 text-emerald-400 opacity-60" />
                        <span>{selectedJob ? `[${selectedJob.company}] 공고가 선택되었습니다. 피드백 실행 버튼을 눌러주세요.` : "공고를 선택한 후 피드백을 실행해 주세요."}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-[#0a1024] border border-emerald-950/80 rounded-2xl p-12 text-center text-slate-400 text-xs">
                  상단의 **[맞춤 공고 추천 실행]** 버튼을 눌러 채용 공고를 추천받아보세요.
                </div>
              )}
            </div>
          )}

        </div>

      </div>
    </div>
  );
};

export default ResumeDetail;