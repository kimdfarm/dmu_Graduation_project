import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Edit3, Loader2, Download, User, Mail, Phone, Calendar, 
  MapPin, GraduationCap, Award, Briefcase, CheckCircle2, ChevronDown, ChevronUp, Sparkles
} from 'lucide-react';

// ------------------------------------------------------------------
// Table Schema 파싱 로직 (섹션별 선택된 텍스트 버전에 맞춰 동적 파싱)
// ------------------------------------------------------------------
const parseDetailsToTableSchema = (details, secColumns = [], secVersion = 'ORIGINAL') => {
  let detectedColumns = Array.isArray(secColumns) && secColumns.length > 0 
    ? [...secColumns] 
    : [];

  if (!details) {
    return { 
      columns: detectedColumns.length > 0 ? detectedColumns : ['제목/역할', '참여 기간', '1'], 
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
      // 섹션의 선택한 버튼 버전에 맞추어 표시할 텍스트 선택
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
    detectedColumns = ['123'];
  }

  return { columns: detectedColumns, rows: extractedRows };
};

const BASE_URL = 'http://localhost:8000';

const ResumeDetail = () => {
  const { resumeId } = useParams();
  const navigate = useNavigate();

  const [resume, setResume] = useState(null);
  const [sections, setSections] = useState([]);
  
  // 섹션별 텍스트 선택 버전 관리 상태 ({ [sectionId]: 'ORIGINAL' | 'SPELL' | 'AI' })
  const [sectionVersions, setSectionVersions] = useState({});

  // 섹션별 로딩/교정 처리 상태 ({ [sectionId]: 'SPELL' | 'AI' | null })
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

  // 1. 버전 변경 (원본 등 클릭 시 DB document_sections selected_version 업데이트)
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

  // 2. 맞춤법 검사 및 교정 실행 함수
  const handleSpellCheckSection = async (sectionId) => {
  setSectionVersions((prev) => ({ ...prev, [sectionId]: 'SPELL' }));

  const targetSection = sections.find((s) => s.id === sectionId);
  if (!targetSection || !targetSection.details) return;

  // 모든 항목에 이미 spell_checked_text가 있는지 확인
  const hasUncheckedDetails = targetSection.details.some(
    (d) => !d.spell_checked_text || !d.spell_checked_text.trim()
  );

  // 이미 전부 검사되어 있다면 API 호출 없이 버전만 DB 업데이트 후 종료
  if (!hasUncheckedDetails) {
    await fetch(`${BASE_URL}/api/sections/${sectionId}/version`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selected_version: 'SPELL' })
    });
    return;
  }

  // 데이터가 없을 때만 POST 요청
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
  const result = await response.json(); // [{ id: 'card_4_1', spell_checked_text: '...' }, ...]
  setSections((prevSections) =>
    prevSections.map((sec) => {
      if (sec.id !== sectionId) return sec;
      
      const updatedDetails = sec.details.map((detail) => {
        const checkedItem = result.find((item) => item.id === detail.id);
        return checkedItem
          ? { ...detail, spell_checked_text: checkedItem.spell_checked_text }
          : detail;
      });

      return { 
        ...sec, 
        spell_checked_text: result, // 섹션 레벨에도 저장
        details: updatedDetails 
      };
    })
  );
}
  } catch (err) {
    console.error('맞춤법 교정 API 오류:', err);
  } finally {
    setProcessingSections((prev) => ({ ...prev, [sectionId]: null }));
  }
};

  // 3. AI 교정 실행 함수
  const handleAIProofreadSection = async (sectionId) => {
    setSectionVersions((prev) => ({ ...prev, [sectionId]: 'AI' }));

    const targetSection = sections.find((s) => s.id === sectionId);
    if (!targetSection || !targetSection.details) return;

    const hasUnproofreadDetails = targetSection.details.some((d) => !d.ai_proofread_text);

    try {
      if (hasUnproofreadDetails) {
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
  const result = await response.json(); // [{ id: 'card_4_1', ai_proofread_text: '...' }, ...]
  setSections((prevSections) =>
    prevSections.map((sec) => {
      if (sec.id !== sectionId) return sec;

      const updatedDetails = sec.details.map((detail) => {
        const proofreadItem = result.find((item) => item.id === detail.id);
        return proofreadItem
          ? { ...detail, ai_proofread_text: proofreadItem.ai_proofread_text }
          : detail;
      });

      return { 
        ...sec, 
        ai_proofread_text: result, // 섹션 레벨에도 저장
        details: updatedDetails 
      };
    })
  );
}
      } else {
        // 이미 교정된 데이터가 존재하면 백엔드 DB 버전만 업데이트
        await fetch(`${BASE_URL}/api/sections/${sectionId}/version`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ selected_version: 'AI' })
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
        if (!resumeRes.ok) throw new Error('이력서 정보를 불러오는 데 실패했습니다.');

        const resumeData = await resumeRes.json();
        setResume(resumeData);

        // useEffect 내 resumeRes 성공 처리 부분
        if (resumeData.sections && Array.isArray(resumeData.sections)) {
          const parsedSections = resumeData.sections.map((sec) => {
            // 1. spell_checked_text 배열을 { "card_4_1": "교정된 텍스트..." } 형태의 맵으로 변환
            const spellMap = {};
            if (Array.isArray(sec.spell_checked_text)) {
              sec.spell_checked_text.forEach((item) => {
                if (item && item.id) spellMap[item.id] = item.spell_checked_text || '';
              });
            }

            // 2. ai_proofread_text 배열을 { "card_4_1": "교정된 텍스트..." } 형태의 맵으로 변환
            const aiMap = {};
            if (Array.isArray(sec.ai_proofread_text)) {
              sec.ai_proofread_text.forEach((item) => {
                if (item && item.id) aiMap[item.id] = item.ai_proofread_text || '';
              });
            }

            // 3. details의 각 detail 객체에 1:1로 텍스트 값을 정확히 병합
            const updatedDetails = (sec.details || []).map((detail) => ({
              ...detail,
              spell_checked_text: spellMap[detail.id] || detail.spell_checked_text || '',
              ai_proofread_text: aiMap[detail.id] || detail.ai_proofread_text || ''
            }));

            return { 
              ...sec, 
              details: updatedDetails 
            };
          });

          setSections(parsedSections);

          const initialVersions = {};
          parsedSections.forEach((sec) => {
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
      return 'flex-[3] min-w-[400px]';
    }
    if (isShort || textValue.length < 20) {
      return 'flex-[1] min-w-[150px] max-w-[220px]';
    }
    return 'flex-[1.5] min-w-[200px]';
  };

  const formattedSections = sections.map((sec) => {
    const secVersion = sectionVersions[sec.id] || sec.selected_version || 'ORIGINAL';
    const { columns, rows } = parseDetailsToTableSchema(sec.details, sec.columns, secVersion);
    return { ...sec, columns, rows, currentVersion: secVersion };
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#07051E] flex flex-col items-center justify-center text-slate-300 gap-3 font-sans">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <p className="text-sm">데이터를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07051E] text-slate-100 p-4 sm:p-8 font-sans">
      <div className="w-full max-w-[3200px] mx-auto space-y-8">
        
        {/* 상단 컨트롤 헤더 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0E0B2D] p-5 rounded-2xl border border-indigo-950 shadow-xl">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/resume')}
              className="p-2 bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-800/50 rounded-xl text-slate-300 hover:text-white transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[11px] font-bold rounded-full">
                  {resume?.category || '일반 이력서'}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white mt-1">
                {resume?.title || '이력서 상세'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            <button
              onClick={() => navigate(`/resume/${resumeId}/edit`)}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#130E3D] hover:bg-[#1A144E] text-indigo-200 font-semibold text-xs sm:text-sm rounded-xl transition-all border border-indigo-800/60 shadow-sm"
            >
              <Edit3 className="w-4 h-4 text-indigo-400" />
              구성 편집
            </button>

            <button
              onClick={() => navigate(`/resume/${resumeId}/download`)}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-lg transition-all"
            >
              <Download className="w-4 h-4" />
              PDF 다운로드
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="p-4 bg-rose-950/40 border border-rose-900/60 rounded-xl text-xs text-rose-300">
            ⚠️ {errorMessage}
          </div>
        )}

        {/* 프로필 요약 카드 */}
        <div className="bg-[#0E0B2D] border border-indigo-950 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6 relative z-10">
            <div className="relative shrink-0">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="프로필 이미지"
                  className="w-28 h-36 object-cover rounded-xl border-2 border-indigo-500/40 shadow-lg"
                />
              ) : (
                <div className="w-28 h-36 border border-dashed border-indigo-800/80 bg-[#07051E] rounded-xl flex flex-col items-center justify-center text-indigo-400/60 gap-2">
                  <User className="w-8 h-8" />
                  <span className="text-[11px]">증명사진</span>
                </div>
              )}
            </div>

            <div className="flex-1 space-y-4 text-center md:text-left">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center justify-center md:justify-start gap-2">
                  {profile.name || '사용자'}
                  <span className="text-xs font-normal text-indigo-400 bg-indigo-950 px-2 py-0.5 rounded-md border border-indigo-900">
                    {profile.gender === 'M' ? '남성' : '여성'}
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">기본 프로필 정보</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 text-xs">
                <div className="flex items-center gap-2.5 p-2.5 bg-[#07051E] rounded-xl border border-indigo-950">
                  <Calendar className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span className="text-slate-300 truncate">{profile.birth_date || '생년월일 미입력'}</span>
                </div>
                <div className="flex items-center gap-2.5 p-2.5 bg-[#07051E] rounded-xl border border-indigo-950">
                  <Phone className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span className="text-slate-300 truncate">{profile.phone_number || '연락처 미입력'}</span>
                </div>
                <div className="flex items-center gap-2.5 p-2.5 bg-[#07051E] rounded-xl border border-indigo-950">
                  <Mail className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span className="text-slate-300 truncate">{profile.email || '이메일 미입력'}</span>
                </div>
                <div className="flex items-center gap-2.5 p-2.5 bg-[#07051E] rounded-xl border border-indigo-950 sm:col-span-2 xl:col-span-1">
                  <MapPin className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span className="text-slate-300 truncate">
                    {profile.address ? `${profile.address} ${profile.detail_address || ''}`.trim() : '주소 미입력'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 학력 & 자격증 정보 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* 학력 사항 */}
        <div className="bg-[#0E0B2D] border border-indigo-950 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-indigo-900/40 pb-3">
            <h2 className="text-base font-bold text-indigo-200 flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-indigo-400" /> 학력 사항
            </h2>
            <span className="text-xs text-indigo-400 font-semibold bg-indigo-950 px-2.5 py-0.5 rounded-full border border-indigo-900">
              총 {educations.length}개
            </span>
          </div>

          <div className="space-y-3">
            {visibleEducations.length > 0 ? (
              visibleEducations.map((edu) => (
                <div key={edu.id} className="p-3.5 bg-[#07051E] rounded-xl border border-indigo-950 flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-white">{edu.school_name}</h3>
                    <p className="text-xs text-indigo-300 mt-0.5">{edu.major}</p>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 bg-indigo-950 text-indigo-300 text-[10px] rounded border border-indigo-900 font-semibold">
                      {edu.status}
                    </span>
                    <p className="text-[11px] text-slate-400 font-mono mt-1">
                      {edu.admission_date} ~ {edu.graduation_date || '재학'}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 italic py-2">등록된 학력 정보가 없습니다.</p>
            )}
          </div>

          {/* 💡 3개 초과 시에만 '더보기 / 접기' 버튼 노출 */}
          {educations.length > 3 && (
            <button
              onClick={() => setShowAllEducations(!showAllEducations)}
              className="w-full py-2 bg-[#07051E] hover:bg-indigo-950/50 border border-indigo-900/60 rounded-xl text-xs text-indigo-300 font-semibold flex items-center justify-center gap-1.5 transition-all mt-2"
            >
              {showAllEducations ? (
                <>
                  <span>접기</span>
                  <ChevronUp className="w-4 h-4" />
                </>
              ) : (
                <>
                  <span>더보기 ({educations.length - 3}개 더보기)</span>
                  <ChevronDown className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>

        {/* 자격증 및 면허 */}
        <div className="bg-[#0E0B2D] border border-indigo-950 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-indigo-900/40 pb-3">
            <h2 className="text-base font-bold text-indigo-200 flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-400" /> 자격증 및 면허
            </h2>
            <span className="text-xs text-indigo-400 font-semibold bg-indigo-950 px-2.5 py-0.5 rounded-full border border-indigo-900">
              총 {certificates.length}개
            </span>
          </div>

          <div className="space-y-3">
            {visibleCertificates.length > 0 ? (
              visibleCertificates.map((cert) => (
                <div key={cert.id} className="p-3.5 bg-[#07051E] rounded-xl border border-indigo-950 flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-white">{cert.certificate_name}</h3>
                    <p className="text-xs text-indigo-300 mt-0.5">{cert.issuing_organization || '-'}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-mono text-slate-300 block">{cert.certificate_number || '-'}</span>
                    <p className="text-[11px] text-slate-400 font-mono mt-1">{cert.acquisition_date || '-'}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 italic py-2">등록된 자격증 정보가 없습니다.</p>
            )}
          </div>

          {/* 💡 3개 초과 시에만 '더보기 / 접기' 버튼 노출 */}
          {certificates.length > 3 && (
            <button
              onClick={() => setShowAllCertificates(!showAllCertificates)}
              className="w-full py-2 bg-[#07051E] hover:bg-indigo-950/50 border border-indigo-900/60 rounded-xl text-xs text-indigo-300 font-semibold flex items-center justify-center gap-1.5 transition-all mt-2"
            >
              {showAllCertificates ? (
                <>
                  <span>접기</span>
                  <ChevronUp className="w-4 h-4" />
                </>
              ) : (
                <>
                  <span>더보기 ({certificates.length - 3}개 더보기)</span>
                  <ChevronDown className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>

      </div>

        {/* 세부 항목 영역 */}
        <div className="space-y-8">
          {formattedSections.map((sec) => (
            <div key={sec.id} className="bg-[#0E0B2D] border border-indigo-950 rounded-2xl p-6 shadow-xl space-y-6">
              
              {/* 섹션 헤더 & 섹션 전체 텍스트 버전을 조절하는 버튼 그룹 */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-900/40 pb-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-indigo-400" />
                    {sec.section_title || '세부 정보'}
                  </h2>
                  <span className="text-xs text-indigo-400 font-semibold bg-indigo-950 px-3 py-1 rounded-full border border-indigo-900">
                    총 {sec.rows ? sec.rows.length : 0}개 항목
                  </span>
                </div>

                {/* 섹션별 버전 전환 버튼 */}
                <div className="flex items-center gap-1 bg-[#07051E] p-1.5 rounded-xl border border-indigo-900/60 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => handleSectionVersionChange(sec.id, 'ORIGINAL')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      sec.currentVersion === 'ORIGINAL'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-indigo-950/60'
                    }`}
                  >
                    원본
                  </button>

                  {/* 맞춤법 검사 및 적용 버튼 */}
                  <button
                    type="button"
                    onClick={() => handleSpellCheckSection(sec.id)}
                    disabled={processingSections[sec.id] === 'SPELL'}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      sec.currentVersion === 'SPELL'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-indigo-950/60'
                    }`}
                  >
                    {processingSections[sec.id] === 'SPELL' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                    ) : (
                      '맞춤법'
                    )}
                  </button>

                  {/* AI 교정 버튼 */}
                  <button
                    type="button"
                    onClick={() => handleAIProofreadSection(sec.id)}
                    disabled={processingSections[sec.id] === 'AI'}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      sec.currentVersion === 'AI'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-indigo-950/60'
                    }`}
                  >
                    {processingSections[sec.id] === 'AI' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        AI 교정
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                {sec.rows && sec.rows.length > 0 ? (
                  sec.rows.map((row, rIdx) => (
                    <div key={row.id} className="bg-[#07051E] border border-indigo-900/60 rounded-xl p-4 space-y-3">
                      
                      <div className="flex items-center justify-between border-b border-indigo-950 pb-2">
                        <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" /> 항목 #{rIdx + 1}
                        </span>
                      </div>

                      <div className="overflow-x-auto pb-2">
                        <div className="flex gap-4 min-w-full items-start">
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
                                className={`${widthClass} bg-[#0B0826] p-3 rounded-xl border border-indigo-950 flex flex-col transition-all duration-200 ${
                                  isExpanded ? 'h-auto' : 'h-28'
                                }`}
                              >
                                <span className="text-[11px] font-bold text-indigo-300 border-b border-indigo-950 pb-1 mb-1.5 truncate shrink-0">
                                  {col}
                                </span>

                                <div className="relative flex-1 overflow-hidden">
                                  <div
                                    className={`text-xs text-slate-200 leading-snug font-sans ${
                                      !isExpanded && isLongContent ? 'max-h-10 overflow-hidden' : ''
                                    }`}
                                  >
                                    {val ? (
                                      lines.map((line, lIdx) => {
                                        const clean = line.replace(/^[•\-\*\s]+/, '').trim();
                                        if (!clean) return null;
                                        return (
                                          <div key={lIdx} className="flex items-start gap-1 my-0.5">
                                            <span className="text-indigo-400 shrink-0">•</span>
                                            <span className="break-all">{clean}</span>
                                          </div>
                                        );
                                      })
                                    ) : (
                                      <span className="text-slate-600 italic text-[11px]">내용 없음</span>
                                    )}
                                  </div>

                                  {!isExpanded && isLongContent && (
                                    <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-[#0B0826] to-transparent pointer-events-none" />
                                  )}
                                </div>

                                {isLongContent && (
                                  <button
                                    onClick={() => toggleCellExpand(cellKey)}
                                    className="mt-1 pt-1 border-t border-indigo-950/80 text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center justify-center gap-1 w-full shrink-0 transition-colors"
                                  >
                                    {isExpanded ? (
                                      <>
                                        <span>접기</span>
                                        <ChevronUp className="w-3 h-3" />
                                      </>
                                    ) : (
                                      <>
                                        <span>자세히 보기</span>
                                        <ChevronDown className="w-3 h-3" />
                                      </>
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
                ) : (
                  <p className="text-xs text-slate-500 italic py-2">등록된 항목이 없습니다.</p>
                )}
              </div>

            </div>
          ))}
        </div>

      </div>
    </div>
  );
};

export default ResumeDetail;