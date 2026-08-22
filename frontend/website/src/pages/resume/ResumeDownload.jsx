import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import html2canvas from 'html2canvas';
import { 
  ArrowLeft, Image as ImageIcon, Code, Printer, 
  GripVertical, ChevronUp, ChevronDown, Loader2, Globe, Mail, Phone, MapPin, Sparkles
} from 'lucide-react';

const BASE_URL = 'http://localhost:8000';

const parseDetailsToTableSchema = (details, secColumns = [], secVersion = 'ORIGINAL') => {
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
      let textToParse = cardObj.original_text || '';
      if (secVersion === 'SPELL' && cardObj.spell_checked_text) {
        textToParse = cardObj.spell_checked_text;
      } else if (secVersion === 'AI' && cardObj.ai_proofread_text) {
        textToParse = cardObj.ai_proofread_text;
      }

      if (textToParse) {
        const lines = textToParse.split('\n').map((l) => l.trim()).filter(Boolean);
        let currentSection = null;

        lines.forEach((line) => {
          if (line.startsWith('[') && line.endsWith(']')) {
            currentSection = line.slice(1, -1).trim();
            addColumn(currentSection);
            if (!rowValues[currentSection]) rowValues[currentSection] = '';
            return;
          }

          const colonIdx = line.indexOf(':');
          if (colonIdx !== -1 && !line.startsWith('•') && !line.startsWith('-')) {
            const k = line.slice(0, colonIdx).trim();
            const v = line.slice(colonIdx + 1).trim();
            addColumn(k);
            rowValues[k] = v;
          } else {
            const cleanLine = line.replace(/^[•\-\*\s]+/, '').trim();
            if (!cleanLine) return;

            const targetCol = currentSection || '상세 내용';
            addColumn(targetCol);
            
            const currentVal = rowValues[targetCol] || '';
            rowValues[targetCol] = currentVal ? `${currentVal}\n• ${cleanLine}` : `• ${cleanLine}`;
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
        if (!resumeRes.ok) throw new Error('이력서 정보를 불러오는데 실패했습니다.');

        const resumeData = await resumeRes.json();
        setResume(resumeData);

        if (resumeData.sections && Array.isArray(resumeData.sections)) {
          const parsedSections = resumeData.sections.map((sec) => {
            const spellMap = {};
            if (Array.isArray(sec.spell_checked_text)) {
              sec.spell_checked_text.forEach((item) => {
                if (item && item.id) spellMap[item.id] = item.spell_checked_text || '';
              });
            }

            const aiMap = {};
            if (Array.isArray(sec.ai_proofread_text)) {
              sec.ai_proofread_text.forEach((item) => {
                if (item && item.id) aiMap[item.id] = item.ai_proofread_text || '';
              });
            }

            const updatedDetails = (sec.details || []).map((detail) => ({
              ...detail,
              spell_checked_text: spellMap[detail.id] || detail.spell_checked_text || '',
              ai_proofread_text: aiMap[detail.id] || detail.ai_proofread_text || ''
            }));

            const secVersion = sec.selected_version || 'ORIGINAL';
            const { columns, rows } = parseDetailsToTableSchema(updatedDetails, sec.columns, secVersion);

            return {
              ...sec,
              details: updatedDetails,
              columns,
              rows,
              currentVersion: secVersion
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
            tr { 
              page-break-inside: avoid !important; 
              break-inside: avoid !important; 
            }
          }
          td { word-break: keep-all !important; overflow-wrap: break-word !important; }
        </style>
      </head>
      <body style="background-color: #f3f4f6; padding: 1rem; display: flex; justify-content: center; font-family: sans-serif;">
        <div style="background-color: #ffffff; color: #000000; width: 210mm; padding: 8mm; box-sizing: border-box;">
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
      
      {/* 인쇄 스타일 제어 */}
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
          /* 행(tr) 단위에서만 페이지 분할 제어 */
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }

        .resume-paper {
          background-color: #ffffff !important;
          color: #111827 !important;
        }
        
        .resume-paper td, .resume-paper div {
          word-break: keep-all !important;
          word-wrap: break-word !important;
        }
      `}</style>

      {/* 헤더 */}
      <div className="max-w-7xl mx-auto flex items-center justify-between mb-6 no-print">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>뒤로가기</span>
        </button>
        <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
          글로벌 이력서 커스텀 & 내보내기
        </h1>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* 제어 패널 */}
        <div className="lg:col-span-4 space-y-6 no-print">
          
          <div className="bg-[#0f0c31] border border-indigo-900/50 rounded-xl p-5 shadow-xl space-y-4">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              이력서 디자인 스타일 선택
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSelectedStyle('KR')}
                className={`p-2.5 rounded-lg text-xs font-medium border transition-all ${
                  selectedStyle === 'KR' 
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' 
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                🇰🇷 한국 (현대식)
              </button>
              <button
                onClick={() => setSelectedStyle('US')}
                className={`p-2.5 rounded-lg text-xs font-medium border transition-all ${
                  selectedStyle === 'US' 
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' 
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                🇺🇸 미국 (ATS 최적화)
              </button>
              <button
                onClick={() => setSelectedStyle('EU')}
                className={`p-2.5 rounded-lg text-xs font-medium border transition-all ${
                  selectedStyle === 'EU' 
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' 
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                🇪🇺 유럽 (2단 CV)
              </button>
              <button
                onClick={() => setSelectedStyle('JP')}
                className={`p-2.5 rounded-lg text-xs font-medium border transition-all ${
                  selectedStyle === 'JP' 
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' 
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                🇯🇵 일본 (정규 履歴書)
              </button>
              <button
                onClick={() => setSelectedStyle('CREATIVE')}
                className={`p-2.5 rounded-lg text-xs font-medium border transition-all ${
                  selectedStyle === 'CREATIVE' 
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' 
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                🎨 크리에이티브
              </button>
              <button
                onClick={() => setSelectedStyle('EXECUTIVE')}
                className={`p-2.5 rounded-lg text-xs font-medium border transition-all ${
                  selectedStyle === 'EXECUTIVE' 
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' 
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                💼 클래식/기업형
              </button>
              <button
                onClick={() => setSelectedStyle('TECH')}
                className={`p-2.5 rounded-lg text-xs font-medium border transition-all ${
                  selectedStyle === 'TECH' 
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' 
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                🚀 테크/스타트업
              </button>
              <button
                onClick={() => setSelectedStyle('MINIMAL')}
                className={`p-2.5 rounded-lg text-xs font-medium border transition-all ${
                  selectedStyle === 'MINIMAL' 
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' 
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                📄 미니멀
              </button>
              <button
                onClick={() => setSelectedStyle('GRID')}
                className={`p-2.5 rounded-lg text-xs font-medium border transition-all col-span-2 ${
                  selectedStyle === 'GRID' 
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' 
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                📑 모던 그리드
              </button>
            </div>
          </div>

          <div className="bg-[#0f0c31] border border-indigo-900/50 rounded-xl p-5 shadow-xl space-y-4">
            <h2 className="text-base font-semibold text-white">이력서 저장</h2>
            <div className="grid grid-cols-1 gap-2.5">
              <button
                onClick={downloadPNG}
                disabled={downloadingFormat !== null}
                className="flex items-center justify-center gap-2 p-3 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {downloadingFormat === 'png' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                PNG 이미지 저장
              </button>

              <button
                onClick={downloadHTML}
                disabled={downloadingFormat !== null}
                className="flex items-center justify-center gap-2 p-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {downloadingFormat === 'html' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Code className="w-4 h-4" />}
                HTML 파일 저장
              </button>

              <button
                onClick={handlePrint}
                className="flex items-center justify-center gap-2 p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Printer className="w-4 h-4" />
                PDF/인쇄 출력하기
              </button>
            </div>
          </div>

          <div className="bg-[#0f0c31] border border-indigo-900/50 rounded-xl p-5 shadow-xl space-y-4">
            <h2 className="text-base font-semibold text-white">프로젝트/경력 순서 관리</h2>
            <DragDropContext onDragEnd={handleOnDragEnd}>
              <Droppable droppableId="sections">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                    {orderedSections.map((sec, index) => (
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
                                disabled={index === orderedSections.length - 1}
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

        {/* 뷰어 영역 */}
        <div className="lg:col-span-8 flex justify-center overflow-x-auto p-2">
          
          {/* 1. 한국 (KR) */}
          {selectedStyle === 'KR' && (
            <div 
              ref={printRef}
              className="print-area resume-paper w-[210mm] !bg-white !text-gray-900 shadow-2xl border border-gray-300 p-[10mm] text-left leading-normal flex flex-col justify-start space-y-5 font-sans"
            >
              <div className="border-b-2 border-gray-900 pb-4 flex justify-between items-start">
                <div className="space-y-1.5">
                  <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{profile.name}</h1>
                  <div className="text-xs text-gray-600 space-y-1">
                    <p className="flex items-center gap-2">
                      <span>{profile.birth_date} ({profile.gender === 'M' ? '남' : '여'})</span>
                      <span>•</span>
                      <span>{profile.phone_number}</span>
                      <span>•</span>
                      <span>{profile.email}</span>
                    </p>
                    <p>{profile.address} {profile.detail_address}</p>
                  </div>
                </div>
                {profile.avatar_url && (
                  <img src={profile.avatar_url} alt="프로필" className="w-20 h-24 object-cover rounded border border-gray-300 shadow-sm" />
                )}
              </div>

              <div className="space-y-2">
                <h2 className="text-sm font-bold text-indigo-900 border-b border-indigo-900/30 pb-1">학력 및 자격사항</h2>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="font-semibold text-gray-700 block mb-1">[학력]</span>
                    {educations.map((edu) => (
                      <div key={edu.id} className="flex justify-between border-b border-gray-100 py-1">
                        <span className="font-medium text-gray-900">{edu.school_name} ({edu.major})</span>
                        <span className="text-gray-500">{edu.status}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700 block mb-1">[자격증]</span>
                    {certificates.map((cert) => (
                      <div key={cert.id} className="flex justify-between border-b border-gray-100 py-1">
                        <span className="font-medium text-gray-900">{cert.certificate_name}</span>
                        <span className="text-gray-500">{cert.acquisition_date}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h2 className="text-sm font-bold text-indigo-900 border-b border-indigo-900/30 pb-1">경력 및 주요 프로젝트</h2>
                {orderedSections.map((sec) => (
                  <div key={sec.id} className="space-y-1.5 bg-gray-50/60 p-3 rounded-lg border border-gray-200/80">
                    <h3 className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                      {sec.section_title || '세부 사항'}
                    </h3>
                    {sec.rows && sec.rows.map((row) => (
                      <div key={row.id} className="text-xs space-y-1">
                        {(sec.columns || []).map((col) => {
                          const val = row.values[col] || '';
                          if (!val) return null;
                          return (
                            <div key={col} className="grid grid-cols-12 gap-2 text-xs">
                              <span className="col-span-3 font-semibold text-gray-700 text-right pr-2 border-r border-gray-200">{col}</span>
                              <div className="col-span-9 whitespace-pre-line text-gray-800 leading-snug">{val}</div>
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

          {/* 2. 미국 (US) */}
          {selectedStyle === 'US' && (
            <div 
              ref={printRef}
              className="print-area resume-paper w-[210mm] !bg-white !text-black shadow-2xl border border-gray-300 p-[12mm] text-left leading-normal flex flex-col justify-start space-y-4 font-serif"
            >
              <div className="text-center border-b border-black pb-3 space-y-1">
                <h1 className="text-2xl font-bold uppercase tracking-widest text-black">{profile.name}</h1>
                <p className="text-xs text-gray-800 font-sans">
                  {profile.email} | {profile.phone_number} | {profile.address} {profile.detail_address}
                </p>
              </div>

              <div className="space-y-1.5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-black border-b border-black pb-0.5">EDUCATION</h2>
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

              <div className="space-y-1.5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-black border-b border-black pb-0.5">CERTIFICATIONS & SKILLS</h2>
                <div className="text-xs font-sans space-y-1">
                  {certificates.map((cert) => (
                    <div key={cert.id} className="flex justify-between text-gray-900">
                      <span>• <strong>{cert.certificate_name}</strong> ({cert.issuer || 'N/A'})</span>
                      <span className="text-gray-600 italic text-[11px]">{cert.acquisition_date}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-black border-b border-black pb-0.5">PROJECTS & EXPERIENCE</h2>
                {orderedSections.map((sec) => (
                  <div key={sec.id} className="space-y-1 font-sans">
                    <h3 className="text-xs font-bold text-black border-l-2 border-black pl-1.5">{sec.section_title || 'Project Detail'}</h3>
                    {sec.rows && sec.rows.map((row) => (
                      <div key={row.id} className="text-xs space-y-1 pl-2">
                        {(sec.columns || []).map((col) => {
                          const val = row.values[col] || '';
                          if (!val) return null;
                          return (
                            <div key={col} className="text-gray-900">
                              <span className="font-semibold text-black">[{col}]</span>
                              <div className="whitespace-pre-line pl-2 text-gray-800 text-[11px] leading-relaxed">{val}</div>
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

          {/* 3. 유럽 (EU) */}
          {selectedStyle === 'EU' && (
            <div 
              ref={printRef}
              className="print-area resume-paper w-[210mm] !bg-white !text-slate-800 shadow-2xl border border-gray-300 p-[10mm] text-left leading-normal flex flex-col justify-start space-y-4 font-sans"
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
                  {orderedSections.map((sec) => (
                    <div key={sec.id} className="space-y-1 bg-indigo-50/30 p-2.5 rounded border border-indigo-100">
                      <h4 className="text-xs font-bold text-indigo-950">{sec.section_title || 'Section Title'}</h4>
                      {sec.rows && sec.rows.map((row) => (
                        <div key={row.id} className="text-xs space-y-1 pl-1">
                          {(sec.columns || []).map((col) => {
                            const val = row.values[col] || '';
                            if (!val) return null;
                            return (
                              <div key={col} className="space-y-0.5">
                                <span className="font-bold text-indigo-900 text-[11px]">[{col}]</span>
                                <div className="whitespace-pre-line text-slate-700 pl-2 border-l-2 border-indigo-300 leading-relaxed text-[11px]">{val}</div>
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

          {/* 4. 일본 (JP) */}
          {selectedStyle === 'JP' && (
            <div 
              ref={printRef}
              className="print-area resume-paper w-[210mm] !bg-white !text-black shadow-2xl border border-gray-300 p-[8mm] text-left leading-normal flex flex-col justify-start space-y-3 font-sans"
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
                {orderedSections.map((sec) => (
                  <div key={sec.id} className="space-y-1">
                    <div className="bg-gray-100 font-bold border border-black p-1 text-xs">
                      ■ {sec.section_title || '세부사항'}
                    </div>
                    {sec.rows && sec.rows.length > 0 && (
                      <table className="w-full border-collapse border border-black text-xs !bg-white" style={{ tableLayout: 'fixed' }}>
                        <tbody>
                          {sec.rows.map((row) => (
                            <React.Fragment key={row.id}>
                              {(sec.columns || []).map((col) => {
                                const val = row.values[col] || '';
                                if (!val) return null;
                                return (
                                  <tr key={col}>
                                    <td className="border border-black bg-gray-50 font-bold w-[90px] p-1.5 text-center align-middle">
                                      {col}
                                    </td>
                                    <td className="border border-black p-1.5 whitespace-pre-line leading-relaxed align-top">
                                      {val}
                                    </td>
                                  </tr>
                                );
                              })}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. 크리에이티브 (CREATIVE) */}
          {selectedStyle === 'CREATIVE' && (
            <div 
              ref={printRef}
              className="print-area resume-paper w-[210mm] !bg-white !text-gray-900 shadow-2xl border border-gray-300 p-[10mm] text-left leading-normal flex flex-col justify-start space-y-5 font-sans"
            >
              <div className="bg-gradient-to-r from-purple-700 to-indigo-600 text-white p-6 rounded-xl flex justify-between items-center shadow-md">
                <div>
                  <h1 className="text-3xl font-extrabold tracking-wide text-white">{profile.name}</h1>
                  <p className="text-xs text-purple-100 mt-1">{profile.email} | {profile.phone_number}</p>
                  <p className="text-xs text-purple-200">{profile.address} {profile.detail_address}</p>
                </div>
                {profile.avatar_url && (
                  <img src={profile.avatar_url} alt="Profile" className="w-20 h-24 object-cover rounded-lg border-2 border-white/50 shadow-md" />
                )}
              </div>

              <div className="space-y-3">
                <h2 className="text-sm font-black text-purple-900 tracking-wider uppercase border-b-2 border-purple-500 pb-0.5">Education & Certification</h2>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="bg-purple-50/50 p-3 rounded-lg border border-purple-100">
                    <span className="font-bold text-purple-900 block mb-1">학력</span>
                    {educations.map((edu) => (
                      <p key={edu.id} className="text-gray-800 font-medium">{edu.school_name} <span className="text-gray-500 text-[11px]">({edu.major})</span></p>
                    ))}
                  </div>
                  <div className="bg-indigo-50/50 p-3 rounded-lg border border-indigo-100">
                    <span className="font-bold text-indigo-900 block mb-1">자격 사항</span>
                    {certificates.map((cert) => (
                      <p key={cert.id} className="text-gray-800 font-medium">{cert.certificate_name} <span className="text-gray-500 text-[11px]">({cert.acquisition_date})</span></p>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h2 className="text-sm font-black text-purple-900 tracking-wider uppercase border-b-2 border-purple-500 pb-0.5">Key Projects</h2>
                {orderedSections.map((sec) => (
                  <div key={sec.id} className="p-4 rounded-xl bg-slate-50 border-l-4 border-purple-600 shadow-sm space-y-2">
                    <h3 className="text-xs font-bold text-purple-950">{sec.section_title || '프로젝트'}</h3>
                    {sec.rows && sec.rows.map((row) => (
                      <div key={row.id} className="text-xs space-y-1">
                        {(sec.columns || []).map((col) => {
                          const val = row.values[col] || '';
                          if (!val) return null;
                          return (
                            <div key={col} className="text-gray-800">
                              <span className="font-bold text-purple-800 text-[11px]">[{col}]</span>
                              <div className="whitespace-pre-line pl-2 text-gray-700 leading-relaxed text-[11px]">{val}</div>
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

          {/* 6. 클래식 / 기업형 (EXECUTIVE) */}
          {selectedStyle === 'EXECUTIVE' && (
            <div 
              ref={printRef}
              className="print-area resume-paper w-[210mm] !bg-white !text-slate-900 shadow-2xl border border-gray-300 p-[12mm] text-left leading-normal flex flex-col justify-start space-y-5 font-serif"
            >
              <div className="text-center border-b-2 border-slate-900 pb-3 space-y-1">
                <h1 className="text-2xl font-bold tracking-widest text-slate-900 uppercase">{profile.name}</h1>
                <p className="text-xs text-slate-700 font-sans">
                  {profile.email} • {profile.phone_number} • {profile.address} {profile.detail_address}
                </p>
              </div>

              <div className="space-y-2 font-sans">
                <h2 className="text-xs font-bold text-slate-900 uppercase border-b border-slate-400 pb-0.5 tracking-wider">Education & Credentials</h2>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    {educations.map((edu) => (
                      <p key={edu.id} className="text-slate-800 font-semibold">{edu.school_name} - <span className="font-normal text-slate-600">{edu.major} ({edu.status})</span></p>
                    ))}
                  </div>
                  <div>
                    {certificates.map((cert) => (
                      <p key={cert.id} className="text-slate-800 font-semibold">{cert.certificate_name} - <span className="font-normal text-slate-600">{cert.acquisition_date}</span></p>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4 font-sans">
                <h2 className="text-xs font-bold text-slate-900 uppercase border-b border-slate-400 pb-0.5 tracking-wider">Professional Projects</h2>
                {orderedSections.map((sec) => (
                  <div key={sec.id} className="space-y-1.5 border-b border-slate-100 pb-3">
                    <h3 className="text-xs font-bold text-slate-900 underline">{sec.section_title || '프로젝트 명'}</h3>
                    {sec.rows && sec.rows.map((row) => (
                      <div key={row.id} className="text-xs space-y-1 pl-2">
                        {(sec.columns || []).map((col) => {
                          const val = row.values[col] || '';
                          if (!val) return null;
                          return (
                            <div key={col} className="text-slate-800">
                              <span className="font-semibold text-slate-900">[{col}]</span>
                              <div className="whitespace-pre-line text-slate-700 leading-relaxed text-[11px] pl-2">{val}</div>
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

          {/* 7. 테크 / 스타트업 (TECH) */}
          {selectedStyle === 'TECH' && (
            <div 
              ref={printRef}
              className="print-area resume-paper w-[210mm] !bg-white !text-slate-900 shadow-2xl border border-gray-300 p-[10mm] text-left leading-normal flex flex-col justify-start space-y-5 font-mono text-xs"
            >
              <div className="border-b-2 border-emerald-500 pb-3 flex justify-between items-end font-sans">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">{profile.name}</h1>
                  <p className="text-xs text-emerald-600 font-mono mt-0.5">&gt; {profile.email} | {profile.phone_number}</p>
                </div>
                <div className="text-right text-[11px] text-gray-500">
                  <p>{profile.address} {profile.detail_address}</p>
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-xs font-bold text-emerald-700 font-sans border-b border-emerald-200 pb-0.5">// ACADEMIC & CERTS</h2>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    {educations.map((edu) => (
                      <p key={edu.id} className="text-slate-800">• {edu.school_name} [{edu.major}]</p>
                    ))}
                  </div>
                  <div>
                    {certificates.map((cert) => (
                      <p key={cert.id} className="text-slate-800">• {cert.certificate_name} ({cert.acquisition_date})</p>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-3 font-sans">
                <h2 className="text-xs font-bold text-emerald-700 font-mono border-b border-emerald-200 pb-0.5">// PROJECT & WORK EXPERIENCE</h2>
                {orderedSections.map((sec) => (
                  <div key={sec.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                    <h3 className="text-xs font-bold text-slate-900 font-mono text-emerald-900"># {sec.section_title || 'Project'}</h3>
                    {sec.rows && sec.rows.map((row) => (
                      <div key={row.id} className="text-xs space-y-1 pl-1">
                        {(sec.columns || []).map((col) => {
                          const val = row.values[col] || '';
                          if (!val) return null;
                          return (
                            <div key={col} className="text-slate-800">
                              <span className="font-bold text-emerald-700 text-[11px]">[{col}]</span>
                              <div className="whitespace-pre-line text-slate-700 leading-relaxed text-[11px] font-sans pl-2">{val}</div>
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

          {/* 8. 미니멀 (MINIMAL) */}
          {selectedStyle === 'MINIMAL' && (
            <div 
              ref={printRef}
              className="print-area resume-paper w-[210mm] !bg-white !text-slate-900 shadow-2xl border border-gray-300 p-[12mm] text-left leading-normal flex flex-col justify-start space-y-6 font-sans"
            >
              <div className="space-y-1 border-b border-slate-200 pb-4">
                <h1 className="text-3xl font-light text-slate-900 tracking-tight">{profile.name}</h1>
                <p className="text-xs text-slate-500">
                  {profile.email} — {profile.phone_number} — {profile.address} {profile.detail_address}
                </p>
              </div>

              <div className="space-y-2">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Education & Certification</h2>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    {educations.map((edu) => (
                      <p key={edu.id} className="text-slate-800 font-medium">{edu.school_name} <span className="text-slate-400">({edu.major})</span></p>
                    ))}
                  </div>
                  <div>
                    {certificates.map((cert) => (
                      <p key={cert.id} className="text-slate-800 font-medium">{cert.certificate_name} <span className="text-slate-400">({cert.acquisition_date})</span></p>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Projects</h2>
                {orderedSections.map((sec) => (
                  <div key={sec.id} className="space-y-1">
                    <h3 className="text-xs font-bold text-slate-800">{sec.section_title || 'Title'}</h3>
                    {sec.rows && sec.rows.map((row) => (
                      <div key={row.id} className="text-xs space-y-1">
                        {(sec.columns || []).map((col) => {
                          const val = row.values[col] || '';
                          if (!val) return null;
                          return (
                            <div key={col} className="text-slate-700">
                              <span className="font-semibold text-slate-900 text-[11px]">[{col}]</span>
                              <div className="whitespace-pre-line text-slate-600 leading-relaxed text-[11px] pl-2">{val}</div>
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

          {/* 9. 모던 그리드 (GRID) */}
          {selectedStyle === 'GRID' && (
            <div 
              ref={printRef}
              className="print-area resume-paper w-[210mm] !bg-white !text-slate-900 shadow-2xl border border-gray-300 p-[10mm] text-left leading-normal flex flex-col justify-start space-y-4 font-sans"
            >
              <div className="grid grid-cols-12 gap-4 border-b-2 border-slate-800 pb-3 items-center">
                <div className="col-span-9 space-y-1">
                  <h1 className="text-2xl font-bold text-slate-900">{profile.name}</h1>
                  <p className="text-xs text-slate-600">{profile.email} | {profile.phone_number}</p>
                  <p className="text-xs text-slate-500">{profile.address} {profile.detail_address}</p>
                </div>
                <div className="col-span-3 text-right">
                  {profile.avatar_url && (
                    <img src={profile.avatar_url} alt="Profile" className="w-16 h-20 object-cover rounded border border-slate-300 ml-auto" />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-6 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                  <h2 className="font-bold text-slate-800 border-b border-slate-300 pb-1 mb-1">학력 사항</h2>
                  {educations.map((edu) => (
                    <div key={edu.id} className="flex justify-between py-0.5">
                      <span className="font-medium text-slate-900">{edu.school_name}</span>
                      <span className="text-slate-500">{edu.major}</span>
                    </div>
                  ))}
                </div>
                <div className="col-span-6 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                  <h2 className="font-bold text-slate-800 border-b border-slate-300 pb-1 mb-1">자격 및 면허</h2>
                  {certificates.map((cert) => (
                    <div key={cert.id} className="flex justify-between py-0.5">
                      <span className="font-medium text-slate-900">{cert.certificate_name}</span>
                      <span className="text-slate-500">{cert.acquisition_date}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-0.5">상세 프로젝트 및 경력</h2>
                {orderedSections.map((sec) => (
                  <div key={sec.id} className="p-3 border border-slate-200 rounded-lg space-y-1">
                    <h3 className="text-xs font-bold text-slate-900 bg-slate-100 p-1 rounded">{sec.section_title || '프로젝트'}</h3>
                    {sec.rows && sec.rows.map((row) => (
                      <div key={row.id} className="text-xs space-y-1">
                        {(sec.columns || []).map((col) => {
                          const val = row.values[col] || '';
                          if (!val) return null;
                          return (
                            <div key={col} className="text-slate-800">
                              <span className="font-bold text-slate-700 text-[11px]">[{col}]</span>
                              <div className="whitespace-pre-line text-slate-600 leading-relaxed text-[11px] pl-2">{val}</div>
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

        </div>

      </div>
    </div>
  );
};

export default ResumeDownload;