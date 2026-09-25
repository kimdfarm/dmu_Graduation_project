import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import html2canvas from 'html2canvas';
import { 
  ArrowLeft, Image as ImageIcon, Code, Printer, 
  GripVertical, ChevronUp, ChevronDown, Loader2, Mail, Phone, MapPin,
  CheckCircle2, Globe2, FileText, Layout, Award, ChevronDown as ChevronIcon
} from 'lucide-react';

const BASE_URL = 'http://localhost:8000';

// ------------------------------------------------------------------
// 💡 selected_version 기준 실시간 텍스트 추출 및 파싱 함수 (완벽 개편)
// ------------------------------------------------------------------
const parseDetailsToTableSchema = (details, secColumns = [], defaultVersion = 'ORIGINAL') => {
  let detectedColumns = Array.isArray(secColumns) && secColumns.length > 0 
    ? [...secColumns] 
    : [];

  if (!details) {
    return { columns: detectedColumns.length > 0 ? detectedColumns : ['상세 내용'], rows: [] };
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
      // 1. 선택된 버전 감지 (카드 자체 버전 > 섹션 버전 > ORIGINAL)
      const versionToUse = cardObj.selected_version || defaultVersion;
      
      // 2. 버전별 텍스트 선택 (우선순위 분기)
      let textToParse = '';
      
      if (versionToUse === 'AI') {
        textToParse = cardObj.ai_proofread_text || cardObj.original_text || '';
      } else if (versionToUse === 'SPELL') {
        textToParse = cardObj.spell_checked_text || cardObj.original_text || '';
      } else {
        textToParse = cardObj.original_text || '';
      }

      // 3. 추출된 텍스트 파싱
      if (textToParse && typeof textToParse === 'string') {
        const blocks = textToParse.split('\n\n');
        
        blocks.forEach((block) => {
          const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
          if (lines.length === 0) return;

          if (lines[0].startsWith('[') && lines[0].endsWith(']')) {
            const keyName = lines[0].slice(1, -1).trim();
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
                const cleanLine = line.replace(/^[•\-\*\s]+/, '').trim();
                if (!cleanLine) return;

                const targetCol = detectedColumns.find(c => c.includes('성과') || c.includes('업무') || c.includes('내용')) || detectedColumns[0] || '상세 내용';
                addColumn(targetCol);
                
                const currentVal = rowValues[targetCol] || '';
                rowValues[targetCol] = currentVal ? `${currentVal}\n${cleanLine}` : cleanLine;
              }
            });
          }
        });
      } else {
        Object.entries(cardObj).forEach(([k, v]) => {
          if (['id', 'selected_version', 'ai_proofread_text', 'spell_checked_text', 'original_text'].includes(k)) return;
          
          if (k === 'title') {
            const titleCol = '프로젝트명';
            addColumn(titleCol);
            rowValues[titleCol] = String(v || '').replace(/^(제목\/역할:\s*)+/, '').trim();
            return;
          }

          addColumn(k);
          let formattedValue = Array.isArray(v) ? v.join('\n') : String(v || '');
          if (formattedValue.startsWith('•')) {
            formattedValue = formattedValue.replace(/^•\s*/, '');
          }
          rowValues[k] = formattedValue;
        });
      }
    } else {
      addColumn('상세 내용');
      let valStr = String(cardObj);
      if (valStr.startsWith('•')) valStr = valStr.replace(/^•\s*/, '');
      rowValues['상세 내용'] = valStr;
    }

    extractedRows.push({
      id: cardObj.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString()),
      values: rowValues
    });
  });

  if (detectedColumns.length === 0) detectedColumns = ['상세 내용'];

  return { columns: detectedColumns, rows: extractedRows };
};

const ResumeDownload = () => {
  const { resumeId } = useParams();
  const navigate = useNavigate();
  const printRef = useRef(null);

  const [resume, setResume] = useState(null);
  const [orderedSections, setOrderedSections] = useState([]);
  const [selectedStyle, setSelectedStyle] = useState('KR');
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

  const [isLoading, setIsLoading] = useState(true);
  const [downloadingFormat, setDownloadingFormat] = useState(null);

  const userId = localStorage.getItem('userId');

  const mainStyleOptions = [
    {
      id: 'KR',
      country: '대한민국',
      flag: '🇰🇷',
      name: '한국 모던 이력서',
      desc: '깔끔한 구분선과 구조화된 프로페셔널 서식',
      icon: Globe2,
      badge: '표준'
    },
    {
      id: 'US',
      country: '미국 / 북미',
      flag: '🇺🇸',
      name: '미국 ATS 최적화 Resume',
      desc: '텍스트 파싱 및 불릿포인트 중심의 ATS 최적화 서식',
      icon: FileText,
      badge: 'ATS'
    },
    {
      id: 'EU',
      country: '유럽 연합',
      flag: '🇪🇺',
      name: '유럽형 2단 Curriculum Vitae',
      desc: '좌측 프로필 사이드바와 우측 경력 분리 2단 레이아웃',
      icon: Layout,
      badge: 'CV'
    },
    {
      id: 'JP',
      country: '일본',
      flag: '🇯🇵',
      name: '일본 정규 履歴書 (리레키쇼)',
      desc: '격자 그리드 형태의 규격화된 테이블 레이아웃',
      icon: Award,
      badge: '정규'
    }
  ];

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

        // 💡 [핵심 교정] 백엔드 데이터를 가져올 때 섹션/카드의 버전 데이터 상호 합성
        if (resumeData.sections && Array.isArray(resumeData.sections)) {
          const parsedSections = resumeData.sections.map((sec) => {
            const secVersion = sec.selected_version || 'ORIGINAL';

            // 섹션 단위에 매핑된 배열형 교정본이 있는 경우 ID 맵 생성
            const spellMap = {};
            if (Array.isArray(sec.spell_checked_text)) {
              sec.spell_checked_text.forEach((item) => {
                if (item && item.id) spellMap[item.id] = item.spell_checked_text || item.text || '';
              });
            }

            const aiMap = {};
            if (Array.isArray(sec.ai_proofread_text)) {
              sec.ai_proofread_text.forEach((item) => {
                if (item && item.id) aiMap[item.id] = item.ai_proofread_text || item.text || '';
              });
            }

            // 개별 detail 객체 내부로 교정본 및 selected_version 확실히 주입
            const updatedDetails = (sec.details || []).map((detail) => ({
              ...detail,
              selected_version: detail.selected_version || secVersion,
              spell_checked_text: detail.spell_checked_text || spellMap[detail.id] || (typeof sec.spell_checked_text === 'string' ? sec.spell_checked_text : ''),
              ai_proofread_text: detail.ai_proofread_text || aiMap[detail.id] || (typeof sec.ai_proofread_text === 'string' ? sec.ai_proofread_text : '')
            }));

            return {
              ...sec,
              details: updatedDetails,
              selected_version: secVersion
            };
          });

          setOrderedSections(parsedSections);
        }
      } catch (err) {
        console.error('데이터 로딩 실패:', err);
      } finally {
        setIsLoading(false);
      }
    };

    if (resumeId) fetchAllData();
  }, [resumeId, userId, navigate]);

  const handleOnDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(orderedSections);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setOrderedSections(items);
  };

  const moveUp = (index) => {
    if (index === 0) return;
    const items = [...orderedSections];
    const temp = items[index];
    items[index] = items[index - 1];
    items[index - 1] = temp;
    setOrderedSections(items);
  };

  const moveDown = (index) => {
    if (index === orderedSections.length - 1) return;
    const items = [...orderedSections];
    const temp = items[index];
    items[index] = items[index + 1];
    items[index + 1] = temp;
    setOrderedSections(items);
  };

  const downloadPNG = async () => {
    if (!printRef.current) return;
    setDownloadingFormat('png');
    try {
      const canvas = await html2canvas(printRef.current, { 
        scale: 2, 
        useCORS: true, 
        backgroundColor: '#ffffff' 
      });
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `${profile.name || '이력서'}_${selectedStyle}_Resume.png`;
      link.click();
    } catch (err) {
      console.error('PNG 저장 실패:', err);
      alert('PNG 저장 중 오류가 발생했습니다.');
    } finally {
      setDownloadingFormat(null);
    }
  };

  const downloadHTML = () => {
    if (!printRef.current) return;
    setDownloadingFormat('html');
    const content = printRef.current.innerHTML;
    const fileName = `${profile.name || '이력서'}_${selectedStyle}_Resume`;
    const fullHtml = `
      <!DOCTYPE html>
      <html lang="ko">
      <head>
        <meta charset="UTF-8">
        <title>${fileName}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          @page { size: A4 portrait; margin: 8mm; }
          @media print {
            html, body {
              width: 210mm;
              background: #ffffff !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
          td, div { word-break: keep-all !important; overflow-wrap: break-word !important; }
        </style>
      </head>
      <body style="background-color: #f3f4f6; padding: 1rem; display: flex; justify-content: center; font-family: sans-serif;">
        <div style="background-color: #ffffff; color: #000000; width: 210mm; padding: 10mm; box-sizing: border-box;">
          ${content}
        </div>
      </body>
      </html>
    `;
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}.html`;
    link.click();
    setDownloadingFormat(null);
  };

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = `${profile.name || '이력서'}_${selectedStyle}_Resume`;
    window.print();
    document.title = originalTitle;
  };

  // 💡 실시간 selected_version 상태에 맞춰 렌더링용 섹션 및 rows 동적 파싱
  const activeSections = orderedSections.map((sec) => {
    const defaultVersion = sec.selected_version || 'ORIGINAL';
    const { columns, rows } = parseDetailsToTableSchema(sec.details, sec.columns, defaultVersion);
    return {
      ...sec,
      columns,
      rows
    };
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#07051E] flex flex-col items-center justify-center text-slate-300 gap-3 font-sans">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <p className="text-sm">이력서를 불러오는 중입니다...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07051E] text-slate-100 p-4 sm:p-8 font-sans">
      
      <style>{`
        @page {
          size: A4 portrait;
          margin: 8mm;
        }

        @media print {
          body { background: #ffffff !important; }
          .no-print { display: none !important; }
          .print-area { 
            width: 100% !important; 
            padding: 0 !important; 
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
        }

        .resume-paper {
          background-color: #ffffff !important;
          color: #111827 !important;
        }
        
        .resume-paper td, .resume-paper div, .resume-paper p {
          word-break: keep-all !important;
          word-wrap: break-word !important;
        }
      `}</style>

      {/* 상단 헤더 */}
      <div className="max-w-7xl mx-auto flex items-center justify-between mb-6 no-print">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>뒤로가기</span>
        </button>
        <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
          국가별 이력서 커스텀 & 내보내기
        </h1>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* 좌측 제어 패널 */}
        <div className="lg:col-span-5 space-y-6 no-print">
          
          {/* 국가별 양식 선택 패널 */}
          <div className="bg-[#0f0c31] border border-indigo-900/50 rounded-xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-indigo-900/40 pb-3">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Globe2 className="w-5 h-5 text-indigo-400" />
                국가별 양식 선택 (4종)
              </h2>
            </div>

            {/* 빠른 선택 드롭다운 */}
            <div className="relative">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">템플릿 빠른 선택</label>
              <div className="relative">
                <select
                  value={selectedStyle}
                  onChange={(e) => setSelectedStyle(e.target.value)}
                  className="w-full bg-slate-900 border border-indigo-500/50 rounded-lg px-3.5 py-2.5 text-xs text-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-10 font-medium"
                >
                  {mainStyleOptions.map((style) => (
                    <option key={style.id} value={style.id} className="bg-slate-900 text-slate-200">
                      {style.flag} {style.name} ({style.country})
                    </option>
                  ))}
                </select>
                <ChevronIcon className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
            
            {/* 카드 선택 리스트 */}
            <div className="grid grid-cols-1 gap-2.5 pt-1">
              {mainStyleOptions.map((style) => {
                const IconComponent = style.icon;
                const isSelected = selectedStyle === style.id;
                return (
                  <div
                    key={style.id}
                    onClick={() => setSelectedStyle(style.id)}
                    className={`relative p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                      isSelected
                        ? 'bg-gradient-to-r from-indigo-950/90 to-purple-950/60 border-indigo-500 shadow-md shadow-indigo-950/50 ring-1 ring-indigo-500'
                        : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    <div className={`p-2 rounded-lg border mt-0.5 shrink-0 ${
                      isSelected 
                        ? 'bg-indigo-600 border-indigo-400 text-white' 
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}>
                      <IconComponent className="w-4 h-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className={`text-xs font-bold truncate flex items-center gap-1.5 ${isSelected ? 'text-indigo-200' : 'text-slate-200'}`}>
                          <span className="text-base">{style.flag}</span> {style.name}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0 ${
                          isSelected
                            ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                          {style.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        {style.desc}
                      </p>
                    </div>

                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-1" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 저장 & 내보내기 버튼 */}
          <div className="bg-[#0f0c31] border border-indigo-900/50 rounded-xl p-5 shadow-xl space-y-3">
            <h2 className="text-base font-semibold text-white">이력서 저장 & 내보내기</h2>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={downloadPNG}
                disabled={downloadingFormat !== null}
                className="flex flex-col items-center justify-center gap-1.5 p-3 bg-purple-600/90 hover:bg-purple-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
              >
                {downloadingFormat === 'png' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                <span>PNG 이미지</span>
              </button>

              <button
                onClick={downloadHTML}
                disabled={downloadingFormat !== null}
                className="flex flex-col items-center justify-center gap-1.5 p-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 border border-slate-700"
              >
                {downloadingFormat === 'html' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Code className="w-4 h-4" />}
                <span>HTML 코드</span>
              </button>

              <button
                onClick={handlePrint}
                className="flex flex-col items-center justify-center gap-1.5 p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>PDF / 인쇄</span>
              </button>
            </div>
          </div>

          {/* 섹션 순서 관리 */}
          <div className="bg-[#0f0c31] border border-indigo-900/50 rounded-xl p-5 shadow-xl space-y-4">
            <h2 className="text-base font-semibold text-white">프로젝트/경력 순서 관리</h2>
            <DragDropContext onDragEnd={handleOnDragEnd}>
              <Droppable droppableId="sections">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                    {activeSections.map((sec, index) => (
                      <Draggable key={sec.id} draggableId={String(sec.id)} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                              snapshot.isDragging 
                                ? 'bg-indigo-950 border-indigo-500 shadow-lg' 
                                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-3 overflow-hidden">
                              <div {...provided.dragHandleProps} className="text-slate-500 hover:text-slate-300 cursor-grab">
                                <GripVertical className="w-4 h-4" />
                              </div>
                              <span className="text-xs font-medium text-slate-200 truncate">
                                {sec.section_title || `섹션 ${index + 1}`}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => moveUp(index)}
                                disabled={index === 0}
                                className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                              >
                                <ChevronUp className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => moveDown(index)}
                                disabled={index === activeSections.length - 1}
                                className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                              >
                                <ChevronDown className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </div>

        </div>

        {/* 💡 실시간 이력서 뷰어 영역 (미국 ATS 포함 4종 템플릿) */}
        <div className="lg:col-span-7 flex justify-center overflow-x-auto p-2">
          
          {/* 1. 한국 모던 이력서 (KR) */}
          {selectedStyle === 'KR' && (
            <div 
              ref={printRef}
              className="print-area resume-paper w-[210mm] !bg-white !text-gray-900 shadow-2xl border border-gray-300 p-[12mm] text-left leading-relaxed flex flex-col space-y-6 font-sans"
            >
              <div className="border-b-2 border-gray-900 pb-5 flex justify-between items-start gap-4">
                <div className="space-y-2 flex-1">
                  <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">{profile.name}</h1>
                  <p className="text-sm font-semibold text-indigo-900">{resume?.category || 'SW 개발자 이력서'}</p>
                  
                  <div className="text-xs text-gray-600 space-y-1 pt-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span>생년월일: {profile.birth_date} ({profile.gender === 'M' ? '남' : '여'})</span>
                      <span>연락처: {profile.phone_number}</span>
                      <span>이메일: {profile.email}</span>
                    </div>
                    {profile.address && <p>주소: {profile.address} {profile.detail_address}</p>}
                  </div>
                </div>

                {profile.avatar_url && (
                  <img src={profile.avatar_url} alt="프로필" className="w-24 h-32 object-cover rounded border border-gray-300 shadow-sm shrink-0" />
                )}
              </div>

              <div className="grid grid-cols-2 gap-6 pb-2">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-900 border-b border-indigo-900/30 pb-1 mb-2">학력 사항</h2>
                  <div className="space-y-1.5 text-xs">
                    {educations.map((edu) => (
                      <div key={edu.id} className="flex justify-between items-baseline">
                        <span className="font-semibold text-gray-800">{edu.school_name} <span className="font-normal text-gray-600">({edu.major})</span></span>
                        <span className="text-gray-500 text-[11px]">{edu.status}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-900 border-b border-indigo-900/30 pb-1 mb-2">자격증 및 면허</h2>
                  <div className="space-y-1.5 text-xs">
                    {certificates.map((cert) => (
                      <div key={cert.id} className="flex justify-between items-baseline">
                        <span className="font-semibold text-gray-800">{cert.certificate_name}</span>
                        <span className="text-gray-500 text-[11px]">{cert.acquisition_date}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <h2 className="text-sm font-bold text-indigo-950 border-b-2 border-indigo-900/20 pb-1 uppercase tracking-wider">주요 경력 및 프로젝트</h2>
                
                {activeSections.map((sec) => (
                  <div key={sec.id} className="space-y-3">
                    <h3 className="text-xs font-bold text-indigo-900 bg-indigo-50/80 px-2.5 py-1 rounded border-l-4 border-indigo-600">
                      {sec.section_title || '세부 정보'}
                    </h3>

                    {sec.rows && sec.rows.map((row) => (
                      <div key={row.id} className="pl-2 border-l border-gray-200 space-y-2 mb-3">
                        {(sec.columns || []).map((col) => {
                          const val = row.values[col] || '';
                          if (!val) return null;

                          const lines = val.split('\n').filter(Boolean);

                          return (
                            <div key={col} className="space-y-1">
                              <span className="text-xs font-bold text-gray-700 block">[{col}]</span>
                              <div className="text-xs text-gray-800 space-y-0.5 pl-2">
                                {lines.map((line, idx) => (
                                  <div key={idx} className="flex items-start gap-1.5">
                                    <span className="text-indigo-500 shrink-0">•</span>
                                    <span className="leading-relaxed">{line.replace(/^•\s*/, '')}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. 미국 ATS 최적화 (US) */}
          {selectedStyle === 'US' && (
            <div 
              ref={printRef}
              className="print-area resume-paper w-[210mm] !bg-white !text-black shadow-2xl border border-gray-300 p-[12mm] text-left leading-normal flex flex-col space-y-3.5 font-serif"
            >
              <div className="text-center border-b-2 border-black pb-2 space-y-1">
                <h1 className="text-2xl font-bold uppercase tracking-wider text-black">{profile.name}</h1>
                <p className="text-xs text-gray-800 font-sans tracking-tight">
                  {profile.email} • {profile.phone_number} • {profile.address} {profile.detail_address}
                </p>
              </div>

              {certificates.length > 0 && (
                <div className="space-y-1">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-black border-b border-black pb-0.5">
                    TECHNICAL SKILLS & CERTIFICATIONS
                  </h2>
                  <div className="text-xs font-sans text-gray-900 pt-0.5 space-y-0.5">
                    {certificates.map((cert) => (
                      <div key={cert.id} className="flex justify-between items-baseline">
                        <span>• <strong>{cert.certificate_name}</strong> ({cert.issuer || 'N/A'})</span>
                        <span className="text-gray-600 font-serif italic text-[11px]">{cert.acquisition_date}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-black border-b border-black pb-0.5">
                  PROFESSIONAL EXPERIENCE & PROJECTS
                </h2>
                
                {activeSections.map((sec) => (
                  <div key={sec.id} className="space-y-2 font-sans">
                    <h3 className="text-xs font-bold text-black uppercase tracking-wide border-b border-gray-300 pb-0.5">
                      {sec.section_title || 'Project Detail'}
                    </h3>

                    {sec.rows && sec.rows.map((row) => {
                      const cols = sec.columns || [];
                      const titleCol = cols.find(c => c.includes('제목') || c.includes('역할') || c.includes('프로젝트') || c.includes('카테고리')) || cols[0];
                      const periodCol = cols.find(c => c.includes('기간') || c.includes('일자') || c.includes('날짜'));

                      const mainTitle = row.values[titleCol] || 'Project / Role';
                      const periodText = periodCol ? row.values[periodCol] : '';

                      return (
                        <div key={row.id} className="text-xs space-y-1 pl-0.5">
                          <div className="flex justify-between items-baseline font-bold text-black">
                            <span className="text-[12px]">{mainTitle}</span>
                            {periodText && <span className="text-[11px] font-mono text-gray-700 italic font-normal">{periodText}</span>}
                          </div>

                          <div className="space-y-0.5 pl-2">
                            {cols.map((col) => {
                              if (col === titleCol || col === periodCol) return null;
                              const val = row.values[col] || '';
                              if (!val) return null;

                              const lines = val.split('\n').filter(Boolean);

                              return (
                                <div key={col} className="space-y-0.5">
                                  {lines.map((line, idx) => (
                                    <p key={idx} className="text-gray-800 text-[11px] leading-relaxed flex items-start gap-1.5">
                                      <span className="shrink-0">•</span>
                                      <span>{line.replace(/^[•\-\*\s]+/, '')}</span>
                                    </p>
                                  ))}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {educations.length > 0 && (
                <div className="space-y-1">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-black border-b border-black pb-0.5">
                    EDUCATION
                  </h2>
                  {educations.map((edu) => (
                    <div key={edu.id} className="flex justify-between items-baseline text-xs font-sans">
                      <div>
                        <span className="font-bold text-black">{edu.school_name}</span>
                        <span className="text-gray-800"> — {edu.major}</span>
                      </div>
                      <span className="text-gray-600 font-serif italic text-[11px]">{edu.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 3. 유럽 2단 Curriculum Vitae (EU) */}
          {selectedStyle === 'EU' && (
            <div 
              ref={printRef}
              className="print-area resume-paper w-[210mm] !bg-white !text-slate-800 shadow-2xl border border-gray-300 p-[10mm] text-left leading-normal flex flex-col space-y-5 font-sans"
            >
              <div className="bg-slate-900 text-white p-5 rounded-lg flex justify-between items-center shadow-sm">
                <div className="space-y-1">
                  <h1 className="text-2xl font-bold tracking-tight text-white">{profile.name}</h1>
                  <div className="text-xs text-slate-300 space-y-0.5">
                    <p className="flex items-center gap-2"><Mail className="w-3 h-3"/> {profile.email}</p>
                    <p className="flex items-center gap-2"><Phone className="w-3 h-3"/> {profile.phone_number}</p>
                    <p className="flex items-center gap-2"><MapPin className="w-3 h-3"/> {profile.address} {profile.detail_address}</p>
                  </div>
                </div>
                {profile.avatar_url && (
                  <img src={profile.avatar_url} alt="Profile" className="w-16 h-20 object-cover rounded border border-slate-700 shadow-inner" />
                )}
              </div>

              <div className="grid grid-cols-12 gap-5">
                <div className="col-span-4 space-y-4 border-r border-slate-200 pr-3">
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700 border-b border-indigo-200 pb-0.5">Profile</h3>
                    <div className="text-xs text-slate-600 space-y-0.5">
                      <p><span className="font-semibold text-slate-800">DOB:</span> {profile.birth_date}</p>
                      <p><span className="font-semibold text-slate-800">Gender:</span> {profile.gender === 'M' ? 'Male' : 'Female'}</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700 border-b border-indigo-200 pb-0.5">Education</h3>
                    {educations.map((edu) => (
                      <div key={edu.id} className="text-xs space-y-0.5 mb-2">
                        <p className="font-bold text-slate-900">{edu.school_name}</p>
                        <p className="text-slate-700">{edu.major}</p>
                        <p className="text-slate-400 text-[10px]">{edu.status}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700 border-b border-indigo-200 pb-0.5">Certificates</h3>
                    {certificates.map((cert) => (
                      <div key={cert.id} className="text-xs text-slate-700 space-y-0.5 mb-1">
                        <p className="font-semibold text-slate-900">{cert.certificate_name}</p>
                        <p className="text-slate-500 text-[10px]">{cert.issuer || '-'} | {cert.acquisition_date}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="col-span-8 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700 border-b border-indigo-200 pb-0.5">Projects & Work Experience</h3>
                  {activeSections.map((sec) => (
                    <div key={sec.id} className="space-y-2 bg-indigo-50/30 p-3 rounded border border-indigo-100">
                      <h4 className="text-xs font-bold text-indigo-950">{sec.section_title || 'Section Title'}</h4>
                      {sec.rows && sec.rows.map((row) => (
                        <div key={row.id} className="text-xs space-y-1.5 pl-1">
                          {(sec.columns || []).map((col) => {
                            const val = row.values[col] || '';
                            if (!val) return null;
                            const lines = val.split('\n').filter(Boolean);

                            return (
                              <div key={col} className="space-y-0.5">
                                <span className="font-bold text-indigo-900 text-[11px]">[{col}]</span>
                                <div className="text-slate-700 pl-2 border-l-2 border-indigo-300 leading-relaxed text-[11px] space-y-0.5">
                                  {lines.map((line, idx) => (
                                    <p key={idx}>• {line.replace(/^•\s*/, '')}</p>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 4. 일본 정규 履歴書 (JP) */}
          {selectedStyle === 'JP' && (
            <div 
              ref={printRef}
              className="print-area resume-paper w-[210mm] !bg-white !text-black shadow-2xl border border-gray-300 p-[8mm] text-left leading-normal flex flex-col space-y-4 font-sans"
            >
              <div className="border-b-2 border-black pb-1 flex justify-between items-center">
                <h1 className="text-lg font-bold tracking-widest text-black">履 歴 書</h1>
                <span className="text-[11px] text-gray-600">작성일자: {new Date().toLocaleDateString('ko-KR')}</span>
              </div>

              <div>
                <table className="w-full border-collapse border border-black text-xs text-center !bg-white" style={{ tableLayout: 'fixed' }}>
                  <tbody>
                    <tr>
                      <td className="border border-black bg-gray-100 font-bold w-[65px] py-1.5">성 명</td>
                      <td className="border border-black font-semibold text-left px-2">{profile.name}</td>
                      <td className="border border-black bg-gray-100 font-bold w-[60px]">성 별</td>
                      <td className="border border-black w-[40px]">{profile.gender === 'M' ? '남' : '여'}</td>
                      <td rowSpan={3} className="border border-black w-[80px] h-[95px] p-1 align-middle">
                        {profile.avatar_url ? (
                          <img src={profile.avatar_url} alt="사진" className="w-full h-full object-cover max-h-[90px]" />
                        ) : (
                          <span className="text-gray-400 text-[11px]">사진</span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-black bg-gray-100 font-bold py-1.5">생년월일</td>
                      <td className="border border-black text-left px-2">{profile.birth_date}</td>
                      <td className="border border-black bg-gray-100 font-bold">연락처</td>
                      <td className="border border-black text-left px-1">{profile.phone_number}</td>
                    </tr>
                    <tr>
                      <td className="border border-black bg-gray-100 font-bold py-1.5">주 소</td>
                      <td colSpan={3} className="border border-black text-left px-2">
                        {profile.address} {profile.detail_address}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="space-y-1">
                <h2 className="text-xs font-bold text-black border-l-2 border-black pl-1.5 py-0.5">学歴・免許・資格 (학력 및 자격사항)</h2>
                <table className="w-full border-collapse border border-black text-xs text-center !bg-white" style={{ tableLayout: 'fixed' }}>
                  <thead>
                    <tr className="bg-gray-100 font-bold border-b border-black">
                      <th className="border border-black py-1 w-[60px]">구분</th>
                      <th className="border border-black py-1">항목명 / 전공 / 발급기관</th>
                      <th className="border border-black py-1 w-[90px]">상태 / 취득일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {educations.map((edu) => (
                      <tr key={edu.id}>
                        <td className="border border-black bg-gray-50 py-1">学歴</td>
                        <td className="border border-black text-left px-2">{edu.school_name} ({edu.major})</td>
                        <td className="border border-black">{edu.status}</td>
                      </tr>
                    ))}
                    {certificates.map((cert) => (
                      <tr key={cert.id}>
                        <td className="border border-black bg-gray-50 py-1">資格</td>
                        <td className="border border-black text-left px-2">{cert.certificate_name} ({cert.issuer || '-'})</td>
                        <td className="border border-black">{cert.acquisition_date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-2">
                <h2 className="text-xs font-bold text-black border-l-2 border-black pl-1.5 py-0.5">職歴・プロジェクト (경력 및 프로젝트)</h2>
                {activeSections.map((sec) => (
                  <div key={sec.id} className="space-y-1">
                    <div className="bg-gray-100 font-bold border border-black p-1 text-xs">
                      ■ {sec.section_title || '세부사항'}
                    </div>
                    {sec.rows && sec.rows.length > 0 && (
                      <div className="border border-black p-2 space-y-2 text-xs">
                        {sec.rows.map((row) => (
                          <div key={row.id} className="space-y-1 border-b border-gray-200 pb-1.5 last:border-0 last:pb-0">
                            {(sec.columns || []).map((col) => {
                              const val = row.values[col] || '';
                              if (!val) return null;
                              return (
                                <div key={col} className="space-y-0.5">
                                  <span className="font-bold text-black block">[{col}]</span>
                                  <p className="whitespace-pre-line leading-relaxed pl-2 text-gray-800">{val}</p>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};

export default ResumeDownload;