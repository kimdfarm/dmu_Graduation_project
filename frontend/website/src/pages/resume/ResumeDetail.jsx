import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Edit3, Loader2, Download, User, Mail, Phone, Calendar, 
  MapPin, GraduationCap, Award, Briefcase, CheckCircle2, ChevronDown, ChevronUp, Sparkles
} from 'lucide-react';

const parseDetailsToTableSchema = (details, secColumns = [], secVersion = 'ORIGINAL') => {
  let detectedColumns = Array.isArray(secColumns) && secColumns.length > 0 
    ? [...secColumns] 
    : [];

  if (!details) {
    return { 
      columns: detectedColumns.length > 0 ? detectedColumns : ['제목/역할', '참여 기간', '상세 내용'], 
      rows: [] 
    };
  }

  const rawList = Array.isArray(details) ? details : [details];
  const extractedRows = [];

  const addColumn = (colName) => {
    if (colName && !detectedColumns.includes(colName)) {
      detectedColumns.push(colName);
    }
  };

  rawList.forEach((cardObj) => {
    const rowValues = {};

    if (typeof cardObj === 'object' && cardObj !== null) {
      let textToParse = cardObj.original_text || '';
      if (secVersion === 'SPELL' && cardObj.spell_checked_text) {
        textToParse = cardObj.spell_checked_text;
      } else if (secVersion === 'AI' && cardObj.ai_proofread_text) {
        textToParse = cardObj.ai_proofread_text;
      }

      if (textToParse) {
        const blocks = textToParse.split('\n\n');
        blocks.forEach((block) => {
          const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
          if (lines.length === 0) return;

          if (lines[0].startsWith('[') && lines[0].endsWith(']')) {
            const keyName = lines[0].slice(1, -1);
            addColumn(keyName);
            rowValues[keyName] = lines
              .slice(1)
              .map((l) => l.replace(/^[•\-\*\s]+/, ''))
              .join('\n');
          } else {
            lines.forEach((line) => {
              const colonIdx = line.indexOf(':');
              if (colonIdx !== -1 && !line.startsWith('•') && !line.startsWith('-')) {
                const k = line.slice(0, colonIdx).trim();
                const v = line.slice(colonIdx + 1).trim();
                addColumn(k);
                rowValues[k] = v;
              } else {
                const targetCol = detectedColumns.find(c => c.includes('성과') || c.includes('업무'));
                if (targetCol) {
                  addColumn(targetCol);
                  const currentVal = rowValues[targetCol] || '';
                  const cleanLine = line.replace(/^[•\-\*\s]+/, '');
                  rowValues[targetCol] = currentVal ? `${currentVal}\n${cleanLine}` : cleanLine;
                }
              }
            });
          }
        });
      } else {
        Object.entries(cardObj).forEach(([k, v]) => {
          if (['id', 'selected_version', 'ai_proofread_text', 'spell_checked_text', 'title', 'original_text'].includes(k)) return;
          addColumn(k);
          rowValues[k] = Array.isArray(v) ? v.join('\n') : String(v || '');
        });
      }

      if (cardObj.title && cardObj.title !== '세부 항목') {
        const cleanTitle = cardObj.title.replace(/^(제목\/역할:\s*)+/, '').trim();
        const existingKey = detectedColumns.find(c => c.includes('제목') || c.includes('역할') || c.includes('프로젝트'));
        if (existingKey && !rowValues[existingKey]) {
          rowValues[existingKey] = cleanTitle;
        }
      }
    } else {
      addColumn('내용');
      rowValues['내용'] = String(cardObj);
    }

    extractedRows.push({
      id: cardObj.id || crypto.randomUUID(),
      rawObj: cardObj,
      values: rowValues
    });
  });

  if (detectedColumns.length === 0) {
    detectedColumns = ['내용'];
  }

  return { columns: detectedColumns, rows: extractedRows };
};

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const ResumeDetail = () => {
  const { resumeId } = useParams();
  const navigate = useNavigate();

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

  const toggleCellExpand = (cellKey) => {
    setExpandedCells((prev) => ({
      ...prev,
      [cellKey]: !prev[cellKey]
    }));
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

      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
      const response = await fetch(`${API_URL}/api/sections/${sectionId}/spell-check`, {
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

      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
      const response = await fetch(`${API_URL}/api/sections/${sectionId}/ai-proofread`, {
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
            ai_proofread_text: proofreadItem ? proofreadItem.ai_proofread_text : detail.ai_proofread_text
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

  const userId = localStorage.getItem('userId');

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
        {/*
        if (!resumeRes.ok) throw new Error('이력서 정보를 불러오는 데 실패했습니다.');
        */}
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
        
        {/* [1] 최상단 제어 컨트롤 바 (이전, 제목, 편집, 다운로드) */}
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

        {/* [마스터 문서 컨테이너] */}
        <div className="bg-[#0f152d] border border-emerald-950/60 rounded-3xl p-6 md:p-10 shadow-2xl space-y-10 relative overflow-hidden">
          
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />

          {/* [2] 프로필 컴포넌트 섹션 */}
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

          {/* [3] 학력 및 자격 컴포넌트 섹션 */}
          {(educations.length > 0 || certificates.length > 0) && (
            <div className={`grid grid-cols-1 ${educations.length > 0 && certificates.length > 0 ? 'lg:grid-cols-2' : ''} gap-6 pt-2`}>
              
              {/* 학력 사항 */}
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

              {/* 자격증 및 면허 */}
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

          {/* [4] 이력서 상세 본문 컴포넌트 섹션 */}
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
                    
                    {/* 섹션 타이틀 & 버전 조절 버튼 */}
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

                    {/* 항목 카드 배열 */}
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

        </div>

      </div>
    </div>
  );
};

export default ResumeDetail;