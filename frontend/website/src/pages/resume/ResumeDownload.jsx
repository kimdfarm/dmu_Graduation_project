import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import html2canvas from 'html2canvas';
import {
  ArrowLeft, Image as ImageIcon, Code, Printer,
  GripVertical, ChevronUp, ChevronDown, Loader2, Mail, Phone, MapPin,
  CheckCircle2, Globe2, FileText, Layout, Award, ChevronDown as ChevronIcon, User, Building2
} from 'lucide-react';

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

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
      const versionToUse = cardObj.selected_version || defaultVersion;

      let textToParse = '';
      if (versionToUse === 'AI') {
        textToParse = cardObj.ai_proofread_text || cardObj.original_text || '';
      } else if (versionToUse === 'SPELL') {
        textToParse = cardObj.spell_checked_text || cardObj.original_text || '';
      } else {
        textToParse = cardObj.original_text || '';
      }

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
  const location = useLocation();
  const printRef = useRef(null);

  const [resume, setResume] = useState(null);
  const [orderedSections, setOrderedSections] = useState([]);
  const [selectedStyle, setSelectedStyle] = useState('KR_V2');
  const [accentColor, setAccentColor] = useState('emerald');

  // 한국형 v2 입사지원서 추가 필드 상태
  const [krV2Meta, setKrV2Meta] = useState({
    companyName: 'OO주식회사',
    targetRole: '프론트엔드',
    militaryService: '육군병장 만기 전역',
    veteranStatus: '비대상',
    portfolio: 'GitHub, Notion 외',
    coreCompetencies: [
      'React, TypeScript, JavaScript 등 모던 프론트엔드 기술 스택을 활용한 웹 애플리케이션 설계 및 구현 역량 보유.',
      'RESTful API / GraphQL 연동, 상태 관리 및 컴포넌트 모듈화를 통한 유지보수성과 확장성 고려 개발 경험.',
      '자료구조, 알고리즘, 컴퓨터구조, 네트워크 등 컴퓨터공학 기초 이론을 바탕으로 한 문제 해결 및 성능 개선 역량.',
      '협업 도구(Git, Jira, Notion 등) 및 팀 프로젝트 경험을 바탕으로 한 원활한 커뮤니케이션과 일정 관리 능력.'
    ].join('\n'),
    techStack: {
      languages: 'JavaScript (ES6+), TypeScript, Python, Java, C/C++',
      frameworks: 'React, Next.js, Tailwind CSS, FastAPI, Spring Boot',
      server: 'Node.js, PostgreSQL, Supabase, SQLite',
      tooling: 'Git, GitHub, Docker, Vercel, Render',
      environment: 'Windows, Linux, VS Code, IntelliJ IDEA',
      etc: 'REST API, GraphQL, Figma'
    },
    activities: [
      { period: '2024.03 ~ 2024.07', org: '컴퓨터공학부', role: '사무보조 및 실습실 관리', type: '근로장학생' },
      { period: '2024.07 ~ 2024.08', org: 'OO기업', role: '업무보조 및 자료정리', type: '현장실습' }
    ],
    trainings: [
      { period: '2023.02.12 ~ 2023.02.19', course: 'SW/클라우드 역량 강화 교육 (56시간)', institution: '동양미래대학교' }
    ],
    awards: [
      { title: '캡스톤디자인 / 학술제 우수상', org: '동양미래대학교', date: '2025.11.01' }
    ],
    computerSkills: {
      ms: 'Word (상), Excel (중), PPT (상)',
      graphic: 'Figma (중), Photoshop (중)',
      hwp: '한글 (상)',
      language: 'TOEIC (보유 시 기입), OPIc (보유 시 기입)'
    },
    selfIntro: {
      growth: '',
      personality: '',
      schoolLife: '',
      motivation: ''
    },
    consent: {
      agreedCollection: true,
      agreedThirdParty: true,
      recipientCompany: '지원 기업명 기입',
      dateStr: new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '년 ').replace(/\./g, '월 ').replace(/ $/, '일'),
      signerName: ''
    }
  });

  const colorThemes = {
    emerald: { name: '에메랄드 그린', hex: '#059669' },
    indigo: { name: '모던 인디고', hex: '#4f46e5' },
    slate: { name: '프로페셔널 블랙', hex: '#0f172a' },
    blue: { name: '클래식 블루', hex: '#2563eb' },
    burgundy: { name: '와인 버건디', hex: '#9f1239' },
  };

  const currentTheme = colorThemes[accentColor] || colorThemes.emerald;
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
    { id: 'KR_V2', country: '대한민국 v2', flag: '🇰🇷', name: '한국어 입사지원서 v2', desc: '기본사항·핵심역량·기술스택·프로젝트·학력/활동/자격·자소서·동의서 통합 서식', icon: Building2, badge: 'v2 신규' },
    { id: 'KR', country: '대한민국', flag: '🇰🇷', name: '한국 모던 이력서', desc: '깔끔한 구분선과 구조화된 프로페셔널 서식', icon: Globe2, badge: '표준' },
    { id: 'US', country: '미국 / 북미', flag: '🇺🇸', name: '미국 ATS 최적화 Resume', desc: '텍스트 파싱 및 불릿포인트 중심의 ATS 최적화 서식', icon: FileText, badge: 'ATS' },
    { id: 'EU', country: '유럽 연합', flag: '🇪🇺', name: '유럽형 2단 Curriculum Vitae', desc: '좌측 프로필 사이드바와 우측 경력 분리 2단 레이아웃', icon: Layout, badge: 'CV' },
    { id: 'JP', country: '일본', flag: '🇯🇵', name: '일본 정규 履歴書 (리레키쇼)', desc: '격자 그리드 형태의 규격화된 테이블 레이아웃', icon: Award, badge: '정규' }
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
          setKrV2Meta((prev) => ({
            ...prev,
            consent: {
              ...prev.consent,
              signerName: data.name || prev.consent.signerName
            }
          }));
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
        if (resumeData.category) {
          setKrV2Meta((prev) => ({ ...prev, targetRole: resumeData.category }));
        }

        const queryParams = new URLSearchParams(location.search);

        if (resumeData.sections && Array.isArray(resumeData.sections)) {
          const parsedSections = resumeData.sections.map((sec) => {
            const queryVer = queryParams.get(`ver_${sec.id}`);
            const queryMode = queryParams.get(`mode_${sec.id}`) || sec.ai_style || 'STAR';
            const secVersion = queryVer || sec.selected_version || 'ORIGINAL';

            const spellMap = {};
            if (Array.isArray(sec.spell_checked_text)) {
              sec.spell_checked_text.forEach((item) => {
                if (item && item.id) spellMap[item.id] = item.spell_checked_text || item.text || '';
              });
            }

            const modeItemMap = {};
            if (Array.isArray(sec.ai_proofread_text)) {
              sec.ai_proofread_text.forEach((group) => {
                if (group && group.mode === queryMode && Array.isArray(group.items)) {
                  group.items.forEach((it) => {
                    if (it && it.id !== undefined) {
                      modeItemMap[String(it.id)] = it.ai_proofread_text || '';
                    }
                  });
                }
              });
            }

            const updatedDetails = (sec.details || []).map((detail) => {
              const detailIdStr = detail.id !== undefined ? String(detail.id) : '';
              return {
                ...detail,
                selected_version: secVersion,
                spell_checked_text: detail.spell_checked_text || spellMap[detailIdStr] || '',
                ai_proofread_text: modeItemMap[detailIdStr] || detail.ai_proofread_text || ''
              };
            });

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
  }, [resumeId, userId, navigate, location.search]);

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
          .resume-section { page-break-inside: avoid; break-inside: avoid; }
          td, div, th { word-break: keep-all !important; overflow-wrap: break-word !important; }
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

  const activeSections = orderedSections.map((sec) => {
    const defaultVersion = sec.selected_version || 'ORIGINAL';
    const { columns, rows } = parseDetailsToTableSchema(sec.details, sec.columns, defaultVersion);
    return {
      ...sec,
      columns,
      rows
    };
  });

  // 한국어 v2 프로젝트 항목 추출(실제 섹션 데이터가 있으면 활용하고, 없으면 기본 3개 슬롯 제공)
  const v2Projects = (() => {
    const flattened = [];
    activeSections.forEach((sec) => {
      if (sec.rows && sec.rows.length > 0) {
        sec.rows.forEach((row, rIdx) => {
          const cols = sec.columns || [];
          const getVal = (keywords) => {
            const foundKey = cols.find((c) => keywords.some((k) => c.includes(k)));
            return foundKey ? row.values[foundKey] || '' : '';
          };
          flattened.push({
            id: row.id || `${sec.id}_${rIdx}`,
            title: row.values['프로젝트명'] || getVal(['제목', '프로젝트', '역할', '카테고리']) || sec.section_title || `프로젝트 ${flattened.length + 1}`,
            period: getVal(['기간', '일자', '날짜', '기여도']) || '0000.00.00 ~ 0000.00.00',
            team: getVal(['인력', '구성', '팀']) || '',
            purpose: getVal(['목적', '개요']) || '',
            tasks: getVal(['업무', '역할', '성과', '상세', '내용']) || Object.values(row.values).filter(Boolean).join('\n'),
            stack: getVal(['언어', '개발환경', '기술', '스택']) || '',
            lessons: getVal(['느낀', '회고', '배운']) || '',
            link: getVal(['링크', 'URL', 'GitHub', '깃허브']) || ''
          });
        });
      }
    });

    if (flattened.length > 0) return flattened;

    return [1, 2, 3].map((num) => ({
      id: `empty-proj-${num}`,
      title: `프로젝트 ${num} : `,
      period: '0000.00.00 ~ 0000.00.00 / 기여도 00%',
      team: '',
      purpose: '',
      tasks: '',
      stack: '',
      lessons: '',
      link: ''
    }));
  })();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#070b19] flex flex-col items-center justify-center text-slate-300 gap-3 font-sans">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        <p className="text-sm font-medium">이력서를 불러오는 중입니다...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070b19] text-slate-100 p-6 md:p-10 font-sans">

      <style>{`
        @page { size: A4 portrait; margin: 8mm; }
        @media print {
          body { background: #ffffff !important; }
          .no-print { display: none !important; }
          .print-area { width: 100% !important; padding: 0 !important; margin: 0 !important; box-shadow: none !important; border: none !important; }
        }
        .resume-paper { background-color: #ffffff !important; color: #111827 !important; }
        .resume-section { page-break-inside: avoid !important; break-inside: avoid !important; }
        .resume-paper td, .resume-paper th, .resume-paper div, .resume-paper p { word-break: keep-all !important; word-wrap: break-word !important; }
      `}</style>

      {/* 상단 헤더 */}
      <div className="max-w-7xl mx-auto flex items-center justify-between mb-6 no-print bg-[#0f152d] px-6 py-4 rounded-3xl border border-emerald-950/60 shadow-xl">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#0a1024] hover:bg-emerald-950/40 text-emerald-300 border border-emerald-950/80 rounded-xl text-xs font-bold transition-all shadow-sm"
        >
          <ArrowLeft className="w-4 h-4 text-emerald-400" />
          <span>뒤로가기</span>
        </button>
        <h1 className="text-base md:text-xl font-black text-white tracking-tight">
          국가별 이력서 커스텀 & 내보내기
        </h1>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* 좌측 제어 패널 */}
        <div className="lg:col-span-5 space-y-6 no-print">

          {/* 국가별 양식 선택 패널 */}
          <div className="bg-[#0f152d] border border-emerald-950/60 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-emerald-950/60 pb-4">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Globe2 className="w-4 h-4 text-emerald-400" />
                국가별 양식 선택 (5종)
              </h2>
            </div>

            <div className="relative">
              <label className="block text-xs font-bold text-slate-300 mb-2">템플릿 빠른 선택</label>
              <div className="relative">
                <select
                  value={selectedStyle}
                  onChange={(e) => setSelectedStyle(e.target.value)}
                  className="w-full bg-[#0a1024] border border-emerald-950/80 rounded-2xl px-4 py-3 text-xs text-white appearance-none cursor-pointer focus:outline-none focus:border-emerald-500 pr-10 font-bold shadow-inner"
                >
                  {mainStyleOptions.map((style) => (
                    <option key={style.id} value={style.id} className="bg-[#0f152d] text-white">
                      {style.flag} {style.name} ({style.country})
                    </option>
                  ))}
                </select>
                <ChevronIcon className="w-4 h-4 text-emerald-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5 pt-1">
              {mainStyleOptions.map((style) => {
                const IconComponent = style.icon;
                const isSelected = selectedStyle === style.id;
                return (
                  <div
                    key={style.id}
                    onClick={() => setSelectedStyle(style.id)}
                    className={`relative p-4 rounded-2xl border cursor-pointer transition-all flex items-start gap-3.5 ${
                      isSelected
                        ? 'bg-emerald-950/40 border-emerald-500 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500'
                        : 'bg-[#0a1024] border-emerald-950/80 hover:border-emerald-800/60'
                    }`}
                  >
                    <div className={`p-2.5 rounded-xl border mt-0.5 shrink-0 ${
                      isSelected ? 'bg-emerald-600 border-emerald-400 text-white shadow-md' : 'bg-[#070b19] border-emerald-950 text-emerald-400'
                    }`}>
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className={`text-xs font-extrabold truncate flex items-center gap-1.5 ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                          <span className="text-base">{style.flag}</span> {style.name}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-md border font-semibold shrink-0 ${
                          isSelected ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-[#070b19] text-slate-400 border-emerald-950'
                        }`}>
                          {style.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">{style.desc}</p>
                    </div>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-1" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 한국어 v2 전용 세부 항목 편집 패널 */}
          {selectedStyle === 'KR_V2' && (
            <div className="bg-[#0f152d] border border-emerald-950/60 rounded-3xl p-6 shadow-xl space-y-4">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-400" />
                한국어 입사지원서 v2 항목 입력
              </h2>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">회사명</label>
                  <input
                    type="text"
                    value={krV2Meta.companyName}
                    onChange={(e) => setKrV2Meta({ ...krV2Meta, companyName: e.target.value })}
                    className="w-full bg-[#0a1024] border border-emerald-950/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">지원직무</label>
                  <input
                    type="text"
                    value={krV2Meta.targetRole}
                    onChange={(e) => setKrV2Meta({ ...krV2Meta, targetRole: e.target.value })}
                    className="w-full bg-[#0a1024] border border-emerald-950/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">병역사항</label>
                  <input
                    type="text"
                    value={krV2Meta.militaryService}
                    onChange={(e) => setKrV2Meta({ ...krV2Meta, militaryService: e.target.value })}
                    className="w-full bg-[#0a1024] border border-emerald-950/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">보훈대상 / 포트폴리오</label>
                  <input
                    type="text"
                    value={krV2Meta.portfolio}
                    onChange={(e) => setKrV2Meta({ ...krV2Meta, portfolio: e.target.value })}
                    className="w-full bg-[#0a1024] border border-emerald-950/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">핵심역량 (줄바꿈으로 구분)</label>
                <textarea
                  rows={4}
                  value={krV2Meta.coreCompetencies}
                  onChange={(e) => setKrV2Meta({ ...krV2Meta, coreCompetencies: e.target.value })}
                  className="w-full bg-[#0a1024] border border-emerald-950/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-2 pt-1 border-t border-emerald-950/60">
                <p className="text-[11px] font-bold text-emerald-300">자기소개서 문항 작성</p>
                {[
                  { key: 'growth', label: '성장배경' },
                  { key: 'personality', label: '성격 장단점' },
                  { key: 'schoolLife', label: '학교생활 / 대내외 활동' },
                  { key: 'motivation', label: '지원동기 및 입사 후 포부' }
                ].map((item) => (
                  <div key={item.key}>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">{item.label}</label>
                    <textarea
                      rows={2}
                      value={krV2Meta.selfIntro[item.key]}
                      onChange={(e) =>
                        setKrV2Meta({
                          ...krV2Meta,
                          selfIntro: { ...krV2Meta.selfIntro, [item.key]: e.target.value }
                        })
                      }
                      placeholder={`${item.label} 내용을 입력하세요...`}
                      className="w-full bg-[#0a1024] border border-emerald-950/80 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 문서 강조 색상 선택 패널 */}
          <div className="bg-[#0f152d] border border-emerald-950/60 rounded-3xl p-6 shadow-xl space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span>🎨 문서 강조 색상 선택 (제출용)</span>
            </h2>
            <p className="text-[11px] text-slate-400">회사 제출용 문서의 포인트 색상을 설정할 수 있습니다.</p>
            <div className="grid grid-cols-5 gap-2 pt-1">
              {Object.entries(colorThemes).map(([key, theme]) => (
                <button
                  key={key}
                  onClick={() => setAccentColor(key)}
                  className={`flex flex-col items-center gap-1.5 p-2 rounded-2xl border transition-all ${
                    accentColor === key ? 'bg-[#0a1024] border-white shadow-md ring-2 ring-white/50' : 'bg-[#0a1024]/50 border-emerald-950 hover:border-emerald-800'
                  }`}
                  title={theme.name}
                >
                  <div className="w-6 h-6 rounded-full shadow-inner" style={{ backgroundColor: theme.hex }} />
                  <span className="text-[10px] text-slate-300 font-medium truncate w-full text-center">{theme.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 저장 & 내보내기 버튼 (PNG, HTML, PDF/인쇄) */}
          <div className="bg-[#0f152d] border border-emerald-950/60 rounded-3xl p-6 shadow-xl space-y-4">
            <h2 className="text-sm font-bold text-white">이력서 저장 & 내보내기</h2>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                onClick={downloadPNG}
                disabled={downloadingFormat !== null}
                className="flex flex-col items-center justify-center gap-1.5 p-3.5 bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 border border-emerald-700/50 rounded-2xl text-xs font-bold transition-all shadow-sm disabled:opacity-50"
              >
                {downloadingFormat === 'png' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4 text-emerald-400" />}
                <span>PNG 이미지</span>
              </button>
              <button
                onClick={downloadHTML}
                disabled={downloadingFormat !== null}
                className="flex flex-col items-center justify-center gap-1.5 p-3.5 bg-[#0a1024] hover:bg-emerald-950/40 text-slate-300 border border-emerald-950/80 rounded-2xl text-xs font-bold transition-all shadow-sm disabled:opacity-50"
              >
                {downloadingFormat === 'html' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Code className="w-4 h-4 text-emerald-400" />}
                <span>HTML 코드</span>
              </button>
              <button
                onClick={handlePrint}
                className="flex flex-col items-center justify-center gap-1.5 p-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl text-xs font-bold transition-all shadow-lg shadow-emerald-600/30"
              >
                <Printer className="w-4 h-4 text-white" />
                <span>PDF / 인쇄</span>
              </button>
            </div>
          </div>

          {/* 섹션 순서 관리 */}
          <div className="bg-[#0f152d] border border-emerald-950/60 rounded-3xl p-6 shadow-xl space-y-4">
            <h2 className="text-sm font-bold text-white">프로젝트/경력 순서 관리</h2>
            <DragDropContext onDragEnd={handleOnDragEnd}>
              <Droppable droppableId="sections">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2.5">
                    {activeSections.map((sec, index) => (
                      <Draggable key={sec.id} draggableId={String(sec.id)} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                              snapshot.isDragging ? 'bg-emerald-950 border-emerald-500 shadow-xl' : 'bg-[#0a1024] border-emerald-950/80 hover:border-emerald-800/60'
                            }`}
                          >
                            <div className="flex items-center gap-3 overflow-hidden">
                              <div {...provided.dragHandleProps} className="text-slate-500 hover:text-emerald-400 cursor-grab">
                                <GripVertical className="w-4 h-4" />
                              </div>
                              <span className="text-xs font-bold text-slate-200 truncate">
                                {sec.section_title || `섹션 ${index + 1}`}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => moveUp(index)} disabled={index === 0} className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 rounded-lg hover:bg-emerald-950/30 transition">
                                <ChevronUp className="w-4 h-4" />
                              </button>
                              <button onClick={() => moveDown(index)} disabled={index === activeSections.length - 1} className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 rounded-lg hover:bg-emerald-950/30 transition">
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

        {/* 뷰어 영역 (한국어 v2 + 기존 4종 템플릿) */}
        <div className="lg:col-span-7 flex justify-center overflow-x-auto p-2">

          {/* 0. 한국어 입사지원서 v2 (KR_V2) */}
          {selectedStyle === 'KR_V2' && (
            <div
              ref={printRef}
              className="print-area resume-paper w-[210mm] !bg-white !text-gray-900 shadow-2xl border border-gray-300 p-[10mm] text-left leading-normal flex flex-col space-y-5 font-sans"
            >
              {/* 상단 타이틀 및 지원직무 */}
              <div className="pb-3 flex items-end justify-between" style={{ borderBottom: `2px solid ${currentTheme.hex}` }}>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: currentTheme.hex }}>입사지원서 (v2)</p>
                  <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
                    {krV2Meta.companyName || '회사명'} 입사지원서
                  </h1>
                </div>
                <div className="text-xs font-bold px-3 py-1 rounded-md border" style={{ borderColor: currentTheme.hex, color: currentTheme.hex, backgroundColor: `${currentTheme.hex}10` }}>
                  지원직무 : {krV2Meta.targetRole || '프론트엔드'}
                </div>
              </div>

              {/* 1. 기본사항 + 증명사진 */}
              <div className="space-y-1.5 resume-section">
                <h2 className="text-xs font-bold px-2 py-1 rounded" style={{ color: currentTheme.hex, backgroundColor: `${currentTheme.hex}12`, borderLeft: `4px solid ${currentTheme.hex}` }}>
                  기본사항
                </h2>
                <div className="grid grid-cols-12 gap-2 items-stretch">
                  <div className="col-span-9">
                    <table className="w-full border-collapse border border-gray-400 text-[11px] !bg-white">
                      <tbody>
                        <tr>
                          <th className="border border-gray-400 bg-gray-100 px-2 py-1.5 w-[85px] text-left font-bold">성명</th>
                          <td className="border border-gray-400 px-2 py-1.5 font-semibold">{profile.name || '성명 입력'}</td>
                          <th className="border border-gray-400 bg-gray-100 px-2 py-1.5 w-[85px] text-left font-bold">생년월일</th>
                          <td className="border border-gray-400 px-2 py-1.5">{profile.birth_date || '0000.00.00 (만 00세)'}</td>
                        </tr>
                        <tr>
                          <th className="border border-gray-400 bg-gray-100 px-2 py-1.5 text-left font-bold">연락처</th>
                          <td colSpan={3} className="border border-gray-400 px-2 py-1.5">
                            {[profile.phone_number, profile.email].filter(Boolean).join(' / ') || '010-0000-0000 / email@example.com'}
                          </td>
                        </tr>
                        <tr>
                          <th className="border border-gray-400 bg-gray-100 px-2 py-1.5 text-left font-bold">병역사항</th>
                          <td className="border border-gray-400 px-2 py-1.5">{krV2Meta.militaryService}</td>
                          <th className="border border-gray-400 bg-gray-100 px-2 py-1.5 text-left font-bold">보훈대상</th>
                          <td className="border border-gray-400 px-2 py-1.5">{krV2Meta.veteranStatus}</td>
                        </tr>
                        <tr>
                          <th className="border border-gray-400 bg-gray-100 px-2 py-1.5 text-left font-bold">포트폴리오</th>
                          <td colSpan={3} className="border border-gray-400 px-2 py-1.5">{krV2Meta.portfolio}</td>
                        </tr>
                        {(profile.address || profile.detail_address) && (
                          <tr>
                            <th className="border border-gray-400 bg-gray-100 px-2 py-1.5 text-left font-bold">주소</th>
                            <td colSpan={3} className="border border-gray-400 px-2 py-1.5">{profile.address} {profile.detail_address}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="col-span-3 border border-gray-400 bg-gray-50 flex flex-col items-center justify-center p-1.5 min-h-[115px]">
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt="증명사진" className="w-full h-full object-cover max-h-[125px]" />
                    ) : (
                      <span className="text-[11px] text-gray-500 font-medium">사진 (3x4cm)</span>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. 핵심역량 */}
              <div className="space-y-1.5 resume-section">
                <h2 className="text-xs font-bold px-2 py-1 rounded" style={{ color: currentTheme.hex, backgroundColor: `${currentTheme.hex}12`, borderLeft: `4px solid ${currentTheme.hex}` }}>
                  핵심역량 <span className="font-normal text-[10px] text-gray-600">(지원직무 관련 핵심역량 3~4가지 정리)</span>
                </h2>
                <div className="border border-gray-400 p-3 text-[11px] space-y-1 bg-white">
                  {krV2Meta.coreCompetencies.split('\n').filter(Boolean).map((line, i) => (
                    <p key={i} className="flex items-start gap-1.5 leading-relaxed">
                      <span style={{ color: currentTheme.hex }}>-</span>
                      <span>{line.replace(/^-\s*/, '')}</span>
                    </p>
                  ))}
                </div>
              </div>

              {/* 3. 기술스택 */}
              <div className="space-y-1.5 resume-section">
                <h2 className="text-xs font-bold px-2 py-1 rounded" style={{ color: currentTheme.hex, backgroundColor: `${currentTheme.hex}12`, borderLeft: `4px solid ${currentTheme.hex}` }}>
                  기술스택 <span className="font-normal text-[10px] text-gray-600">(자신있는 기술 또는 직무에 필요한 역량 우선 배치)</span>
                </h2>
                <table className="w-full border-collapse border border-gray-400 text-[11px] !bg-white">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-400 px-2 py-1 w-[155px] text-left font-bold">구분</th>
                      <th className="border border-gray-400 px-2 py-1 text-left font-bold">Skill</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><th className="border border-gray-400 bg-gray-50 px-2 py-1 text-left">Programming Languages</th><td className="border border-gray-400 px-2 py-1">{krV2Meta.techStack.languages}</td></tr>
                    <tr><th className="border border-gray-400 bg-gray-50 px-2 py-1 text-left">Framework / Library</th><td className="border border-gray-400 px-2 py-1">{krV2Meta.techStack.frameworks}</td></tr>
                    <tr><th className="border border-gray-400 bg-gray-50 px-2 py-1 text-left">Server / DB</th><td className="border border-gray-400 px-2 py-1">{krV2Meta.techStack.server}</td></tr>
                    <tr><th className="border border-gray-400 bg-gray-50 px-2 py-1 text-left">Tooling / DevOps</th><td className="border border-gray-400 px-2 py-1">{krV2Meta.techStack.tooling}</td></tr>
                    <tr><th className="border border-gray-400 bg-gray-50 px-2 py-1 text-left">Environment</th><td className="border border-gray-400 px-2 py-1">{krV2Meta.techStack.environment}</td></tr>
                    <tr><th className="border border-gray-400 bg-gray-50 px-2 py-1 text-left">ETC</th><td className="border border-gray-400 px-2 py-1">{krV2Meta.techStack.etc}</td></tr>
                  </tbody>
                </table>
              </div>

              {/* 4. 프로젝트 경험 */}
              <div className="space-y-2">
                <h2 className="text-xs font-bold px-2 py-1 rounded" style={{ color: currentTheme.hex, backgroundColor: `${currentTheme.hex}12`, borderLeft: `4px solid ${currentTheme.hex}` }}>
                  프로젝트 경험 <span className="font-normal text-[10px] text-gray-600">(혼자 혹은 팀 구성으로 수행한 프로젝트 최신순 작성)</span>
                </h2>
                {v2Projects.map((proj, idx) => (
                  <div key={proj.id} className="resume-section">
                    <table className="w-full border-collapse border border-gray-400 text-[11px] !bg-white">
                      <tbody>
                        <tr className="bg-gray-100">
                          <th colSpan={2} className="border border-gray-400 px-2 py-1 text-left font-bold">
                            {proj.title.startsWith('프로젝트') ? proj.title : `프로젝트 ${idx + 1} : ${proj.title}`}
                          </th>
                        </tr>
                        <tr>
                          <th className="border border-gray-400 bg-gray-50 px-2 py-1 w-[125px] text-left">작업 기간 / 기여도</th>
                          <td className="border border-gray-400 px-2 py-1">{proj.period}</td>
                        </tr>
                        <tr>
                          <th className="border border-gray-400 bg-gray-50 px-2 py-1 text-left">인력 구성</th>
                          <td className="border border-gray-400 px-2 py-1">{proj.team || '-'}</td>
                        </tr>
                        <tr>
                          <th className="border border-gray-400 bg-gray-50 px-2 py-1 text-left">프로젝트 목적</th>
                          <td className="border border-gray-400 px-2 py-1 whitespace-pre-line">{proj.purpose || '-'}</td>
                        </tr>
                        <tr>
                          <th className="border border-gray-400 bg-gray-50 px-2 py-1 text-left">주요업무 및 상세역할</th>
                          <td className="border border-gray-400 px-2 py-1 whitespace-pre-line">{proj.tasks || '-'}</td>
                        </tr>
                        <tr>
                          <th className="border border-gray-400 bg-gray-50 px-2 py-1 text-left">사용언어 및 개발환경</th>
                          <td className="border border-gray-400 px-2 py-1 whitespace-pre-line">{proj.stack || '-'}</td>
                        </tr>
                        <tr>
                          <th className="border border-gray-400 bg-gray-50 px-2 py-1 text-left">느낀 점</th>
                          <td className="border border-gray-400 px-2 py-1 whitespace-pre-line">{proj.lessons || '-'}</td>
                        </tr>
                        <tr>
                          <th className="border border-gray-400 bg-gray-50 px-2 py-1 text-left">프로젝트 링크</th>
                          <td className="border border-gray-400 px-2 py-1 break-all">{proj.link || '-'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>

              {/* 5. 학력사항 */}
              <div className="space-y-1.5 resume-section">
                <h2 className="text-xs font-bold px-2 py-1 rounded" style={{ color: currentTheme.hex, backgroundColor: `${currentTheme.hex}12`, borderLeft: `4px solid ${currentTheme.hex}` }}>
                  학력사항
                </h2>
                <table className="w-full border-collapse border border-gray-400 text-[11px] !bg-white">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-400 px-2 py-1 text-left">기간</th>
                      <th className="border border-gray-400 px-2 py-1 text-left">학교명</th>
                      <th className="border border-gray-400 px-2 py-1 text-left">전공/계열</th>
                      <th className="border border-gray-400 px-2 py-1 text-left">학점/상태</th>
                      <th className="border border-gray-400 px-2 py-1 text-left">소재지</th>
                    </tr>
                  </thead>
                  <tbody>
                    {educations.length > 0 ? (
                      educations.map((edu) => (
                        <tr key={edu.id}>
                          <td className="border border-gray-400 px-2 py-1">{edu.period || edu.graduation_date || '-'}</td>
                          <td className="border border-gray-400 px-2 py-1 font-semibold">{edu.school_name}</td>
                          <td className="border border-gray-400 px-2 py-1">{edu.major || '-'}</td>
                          <td className="border border-gray-400 px-2 py-1">{edu.gpa ? `${edu.gpa} (${edu.status || ''})` : (edu.status || '-')}</td>
                          <td className="border border-gray-400 px-2 py-1">{edu.location || '-'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="border border-gray-400 px-2 py-1">2024.03 ~ 2027.02</td>
                        <td className="border border-gray-400 px-2 py-1 font-semibold">동양미래대학교</td>
                        <td className="border border-gray-400 px-2 py-1">컴퓨터소프트웨어공학과</td>
                        <td className="border border-gray-400 px-2 py-1">재학 / 졸업예정</td>
                        <td className="border border-gray-400 px-2 py-1">서울 구로구</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* 6. 대내외활동 / 교육사항 / 수상경력 */}
              <div className="space-y-1.5 resume-section">
                <h2 className="text-xs font-bold px-2 py-1 rounded" style={{ color: currentTheme.hex, backgroundColor: `${currentTheme.hex}12`, borderLeft: `4px solid ${currentTheme.hex}` }}>
                  대내외활동
                </h2>
                <table className="w-full border-collapse border border-gray-400 text-[11px] !bg-white">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-400 px-2 py-1 text-left w-[140px]">기간</th>
                      <th className="border border-gray-400 px-2 py-1 text-left">기관/조직</th>
                      <th className="border border-gray-400 px-2 py-1 text-left">주요활동</th>
                      <th className="border border-gray-400 px-2 py-1 text-left w-[95px]">구분</th>
                    </tr>
                  </thead>
                  <tbody>
                    {krV2Meta.activities.map((act, idx) => (
                      <tr key={idx}>
                        <td className="border border-gray-400 px-2 py-1">{act.period}</td>
                        <td className="border border-gray-400 px-2 py-1">{act.org}</td>
                        <td className="border border-gray-400 px-2 py-1">{act.role}</td>
                        <td className="border border-gray-400 px-2 py-1">{act.type}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 resume-section">
                <div className="space-y-1">
                  <h2 className="text-xs font-bold px-2 py-1 rounded" style={{ color: currentTheme.hex, backgroundColor: `${currentTheme.hex}12`, borderLeft: `4px solid ${currentTheme.hex}` }}>
                    교육사항 / 해외연수
                  </h2>
                  <table className="w-full border-collapse border border-gray-400 text-[11px] !bg-white">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-400 px-2 py-1 text-left">기간</th>
                        <th className="border border-gray-400 px-2 py-1 text-left">교육명</th>
                        <th className="border border-gray-400 px-2 py-1 text-left">기관</th>
                      </tr>
                    </thead>
                    <tbody>
                      {krV2Meta.trainings.map((tr, idx) => (
                        <tr key={idx}>
                          <td className="border border-gray-400 px-2 py-1">{tr.period}</td>
                          <td className="border border-gray-400 px-2 py-1">{tr.course}</td>
                          <td className="border border-gray-400 px-2 py-1">{tr.institution}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="space-y-1">
                  <h2 className="text-xs font-bold px-2 py-1 rounded" style={{ color: currentTheme.hex, backgroundColor: `${currentTheme.hex}12`, borderLeft: `4px solid ${currentTheme.hex}` }}>
                    수상경력
                  </h2>
                  <table className="w-full border-collapse border border-gray-400 text-[11px] !bg-white">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-400 px-2 py-1 text-left">대회/상명</th>
                        <th className="border border-gray-400 px-2 py-1 text-left">수여기관</th>
                        <th className="border border-gray-400 px-2 py-1 text-left">일자</th>
                      </tr>
                    </thead>
                    <tbody>
                      {krV2Meta.awards.map((aw, idx) => (
                        <tr key={idx}>
                          <td className="border border-gray-400 px-2 py-1">{aw.title}</td>
                          <td className="border border-gray-400 px-2 py-1">{aw.org}</td>
                          <td className="border border-gray-400 px-2 py-1">{aw.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 7. 컴퓨터 활용 / 외국어 / 자격증 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 resume-section">
                <div className="space-y-1">
                  <h2 className="text-xs font-bold px-2 py-1 rounded" style={{ color: currentTheme.hex, backgroundColor: `${currentTheme.hex}12`, borderLeft: `4px solid ${currentTheme.hex}` }}>
                    OA 및 외국어 능력
                  </h2>
                  <table className="w-full border-collapse border border-gray-400 text-[11px] !bg-white">
                    <tbody>
                      <tr><th className="border border-gray-400 bg-gray-50 px-2 py-1 w-[75px] text-left">MS Office</th><td className="border border-gray-400 px-2 py-1">{krV2Meta.computerSkills.ms}</td></tr>
                      <tr><th className="border border-gray-400 bg-gray-50 px-2 py-1 text-left">디자인/툴</th><td className="border border-gray-400 px-2 py-1">{krV2Meta.computerSkills.graphic}</td></tr>
                      <tr><th className="border border-gray-400 bg-gray-50 px-2 py-1 text-left">한글</th><td className="border border-gray-400 px-2 py-1">{krV2Meta.computerSkills.hwp}</td></tr>
                      <tr><th className="border border-gray-400 bg-gray-50 px-2 py-1 text-left">외국어</th><td className="border border-gray-400 px-2 py-1">{krV2Meta.computerSkills.language}</td></tr>
                    </tbody>
                  </table>
                </div>

                <div className="space-y-1">
                  <h2 className="text-xs font-bold px-2 py-1 rounded" style={{ color: currentTheme.hex, backgroundColor: `${currentTheme.hex}12`, borderLeft: `4px solid ${currentTheme.hex}` }}>
                    자격증 (최신순)
                  </h2>
                  <table className="w-full border-collapse border border-gray-400 text-[11px] !bg-white">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-400 px-2 py-1 text-left">자격증명</th>
                        <th className="border border-gray-400 px-2 py-1 text-left">발급기관</th>
                        <th className="border border-gray-400 px-2 py-1 text-left">취득일</th>
                      </tr>
                    </thead>
                    <tbody>
                      {certificates.length > 0 ? (
                        certificates.map((cert) => (
                          <tr key={cert.id}>
                            <td className="border border-gray-400 px-2 py-1 font-semibold">{cert.certificate_name}</td>
                            <td className="border border-gray-400 px-2 py-1">{cert.issuer || '-'}</td>
                            <td className="border border-gray-400 px-2 py-1">{cert.acquisition_date}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="border border-gray-400 px-2 py-1">정보처리산업기사 (준비/보유)</td>
                          <td className="border border-gray-400 px-2 py-1">한국산업인력공단</td>
                          <td className="border border-gray-400 px-2 py-1">0000.00.00</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 8. 자기소개서 */}
              <div className="space-y-2">
                <h2 className="text-xs font-bold px-2 py-1 rounded" style={{ color: currentTheme.hex, backgroundColor: `${currentTheme.hex}12`, borderLeft: `4px solid ${currentTheme.hex}` }}>
                  자기소개서
                </h2>
                {[
                  {
                    title: '성장배경',
                    guide: '흥미와 관심분야, 지속 시도/성취 경험, 전공 진학 후 관심 분야 및 취업 준비 목표',
                    value: krV2Meta.selfIntro.growth
                  },
                  {
                    title: '성격 장단점',
                    guide: '직무·조직생활 장점 및 발휘 사례, 단점 인지 및 보완·개선 노력',
                    value: krV2Meta.selfIntro.personality
                  },
                  {
                    title: '학교생활 / 대내외 활동',
                    guide: '전공 이론·실습 역량, 기억에 남는 팀 과제 및 문제 해결 경험, 학업 외 활동',
                    value: krV2Meta.selfIntro.schoolLife
                  },
                  {
                    title: '지원동기 및 입사 후 포부',
                    guide: '관심 산업·직무 이해, 지원기업 동기, 직무 준비 과정 및 입사 후 기여 목표',
                    value: krV2Meta.selfIntro.motivation
                  }
                ].map((secItem, idx) => (
                  <div key={idx} className="border border-gray-400 p-2.5 text-[11px] space-y-1 bg-white resume-section">
                    <p className="font-bold text-gray-900">{idx + 1}. {secItem.title}</p>
                    <p className="text-[10px] text-gray-500">{secItem.guide}</p>
                    <p className="whitespace-pre-line text-gray-800 pt-1 min-h-[36px]">
                      {secItem.value || '내용을 입력하세요.'}
                    </p>
                  </div>
                ))}
              </div>

              {/* 9. 개인정보 수집 및 이용 동의서 */}
              <div className="space-y-1.5 resume-section">
                <h2 className="text-xs font-bold px-2 py-1 rounded" style={{ color: currentTheme.hex, backgroundColor: `${currentTheme.hex}12`, borderLeft: `4px solid ${currentTheme.hex}` }}>
                  개인정보 수집 및 이용 동의서
                </h2>
                <table className="w-full border-collapse border border-gray-400 text-[10.5px] !bg-white">
                  <tbody>
                    <tr>
                      <th className="border border-gray-400 bg-gray-100 px-2 py-1 w-[120px] text-left">수집·이용 목적</th>
                      <td className="border border-gray-400 px-2 py-1">채용 전형 및 취업 추천 진행</td>
                    </tr>
                    <tr>
                      <th className="border border-gray-400 bg-gray-100 px-2 py-1 text-left">수집 항목</th>
                      <td className="border border-gray-400 px-2 py-1">성명, 생년월일, 주소, 연락처, 이메일, 학력사항, 경력·프로젝트, 자격증</td>
                    </tr>
                    <tr>
                      <th className="border border-gray-400 bg-gray-100 px-2 py-1 text-left">보유·이용 기간</th>
                      <td className="border border-gray-400 px-2 py-1">개인정보 수집 및 이용 목적 달성 시까지</td>
                    </tr>
                    <tr>
                      <th className="border border-gray-400 bg-gray-100 px-2 py-1 text-left">제3자 제공</th>
                      <td className="border border-gray-400 px-2 py-1">지원 기업({krV2Meta.consent.recipientCompany})에 채용 심사를 목적으로 제공</td>
                    </tr>
                  </tbody>
                </table>
                <div className="border border-gray-400 p-2.5 text-[11px] flex flex-wrap items-center justify-between gap-2 bg-gray-50">
                  <div className="flex items-center gap-4">
                    <span>개인정보 수집·이용 동의: <strong>[☑ 동의함] [☐ 동의하지 않음]</strong></span>
                    <span>제3자 제공 동의: <strong>[☑ 동의함] [☐ 동의하지 않음]</strong></span>
                  </div>
                  <div className="text-right font-semibold">
                    <span>{krV2Meta.consent.dateStr}</span>
                    <span className="ml-4">성명 : {krV2Meta.consent.signerName || profile.name || 'O O O'} (서명 또는 인)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 1. 한국 모던 이력서 (KR) */}
          {selectedStyle === 'KR' && (
            <div
              ref={printRef}
              className="print-area resume-paper w-[210mm] !bg-white !text-gray-900 shadow-2xl border border-gray-300 p-[12mm] text-left leading-relaxed flex flex-col space-y-6 font-sans"
            >
              <div className="pb-5 flex justify-between items-start gap-4" style={{ borderBottom: `2px solid ${currentTheme.hex}` }}>
                <div className="space-y-2 flex-1">
                  <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">{profile.name || '김동혁'}</h1>
                  <p className="text-sm font-bold" style={{ color: currentTheme.hex }}>{resume?.category || 'SW 개발자 이력서'}</p>

                  <div className="text-xs text-gray-600 space-y-1 pt-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      {profile.birth_date && <span>생년월일: {profile.birth_date} ({profile.gender === 'M' ? '남' : '여'})</span>}
                      {profile.phone_number && <span>연락처: {profile.phone_number}</span>}
                      {profile.email && <span>이메일: {profile.email}</span>}
                    </div>
                    {profile.address && <p>주소: {profile.address} {profile.detail_address}</p>}
                  </div>
                </div>

                <div className="w-24 h-32 bg-gray-100 rounded-xl border border-gray-300 shadow-sm shrink-0 flex items-center justify-center overflow-hidden">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="프로필" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-10 h-10 text-gray-400" />
                  )}
                </div>
              </div>

              {(educations.length > 0 || certificates.length > 0) && (
                <div className="grid grid-cols-2 gap-6 pb-2 resume-section">
                  {educations.length > 0 && (
                    <div>
                      <h2 className="text-xs font-bold uppercase tracking-wider pb-1 mb-2" style={{ color: currentTheme.hex, borderBottom: `1px solid ${currentTheme.hex}40` }}>학력 사항</h2>
                      <div className="space-y-1.5 text-xs">
                        {educations.map((edu) => (
                          <div key={edu.id} className="flex justify-between items-baseline">
                            <span className="font-semibold text-gray-800">{edu.school_name} <span className="font-normal text-gray-600">({edu.major})</span></span>
                            <span className="text-gray-500 text-[11px]">{edu.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {certificates.length > 0 && (
                    <div>
                      <h2 className="text-xs font-bold uppercase tracking-wider pb-1 mb-2" style={{ color: currentTheme.hex, borderBottom: `1px solid ${currentTheme.hex}40` }}>자격증 및 면허</h2>
                      <div className="space-y-1.5 text-xs">
                        {certificates.map((cert) => (
                          <div key={cert.id} className="flex justify-between items-baseline">
                            <span className="font-semibold text-gray-800">{cert.certificate_name}</span>
                            <span className="text-gray-500 text-[11px]">{cert.acquisition_date}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-5">
                <h2 className="text-sm font-bold uppercase tracking-wider pb-1" style={{ color: currentTheme.hex, borderBottom: `2px solid ${currentTheme.hex}30` }}>주요 경력 및 프로젝트</h2>

                {activeSections.map((sec) => (
                  <div key={sec.id} className="space-y-3 resume-section">
                    <h3 className="text-xs font-bold px-2.5 py-1 rounded" style={{ color: currentTheme.hex, backgroundColor: `${currentTheme.hex}10`, borderLeft: `4px solid ${currentTheme.hex}` }}>
                      {sec.section_title || '세부 정보'}
                    </h3>

                    {sec.rows && sec.rows.map((row) => (
                      <div key={row.id} className="pl-3 space-y-2 mb-4" style={{ borderLeft: `2px solid ${currentTheme.hex}30` }}>
                        {(sec.columns || []).map((col) => {
                          const val = row.values[col] || '';
                          if (!val) return null;

                          const lines = val.split('\n').filter(Boolean);

                          return (
                            <div key={col} className="space-y-1">
                              <span className="text-xs font-bold text-gray-800 block">[{col}]</span>
                              <div className="text-xs text-gray-700 space-y-0.5 pl-2">
                                {lines.map((line, idx) => (
                                  <div key={idx} className="flex items-start gap-1.5 leading-relaxed">
                                    <span className="shrink-0" style={{ color: currentTheme.hex }}>•</span>
                                    <span>{line.replace(/^•\s*/, '')}</span>
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
              className="print-area resume-paper w-[210mm] !bg-white !text-black shadow-2xl border border-gray-300 p-[12mm] text-left leading-normal flex flex-col space-y-4 font-serif"
            >
              <div className="text-center pb-3 space-y-1" style={{ borderBottom: `2px solid ${currentTheme.hex}` }}>
                <h1 className="text-2xl font-bold uppercase tracking-widest text-black">{profile.name || 'DONGOO KIM'}</h1>
                <p className="text-xs text-gray-800 font-sans tracking-tight">
                  {[profile.email, profile.phone_number, `${profile.address || ''} ${profile.detail_address || ''}`.trim()].filter(Boolean).join(' • ')}
                </p>
              </div>

              {certificates.length > 0 && (
                <div className="space-y-1.5 resume-section">
                  <h2 className="text-xs font-bold uppercase tracking-wider pb-0.5" style={{ color: currentTheme.hex, borderBottom: `1px solid ${currentTheme.hex}` }}>
                    TECHNICAL SKILLS & CERTIFICATIONS
                  </h2>
                  <div className="text-xs font-sans text-gray-900 pt-0.5 space-y-0.5">
                    {certificates.map((cert) => (
                      <div key={cert.id} className="flex justify-between items-baseline">
                        <span>• <strong>{cert.certificate_name}</strong> {cert.issuer ? `(${cert.issuer})` : ''}</span>
                        <span className="text-gray-600 font-serif italic text-[11px]">{cert.acquisition_date}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3.5">
                <h2 className="text-xs font-bold uppercase tracking-wider pb-0.5" style={{ color: currentTheme.hex, borderBottom: `1px solid ${currentTheme.hex}` }}>
                  PROFESSIONAL EXPERIENCE & PROJECTS
                </h2>

                {activeSections.map((sec) => (
                  <div key={sec.id} className="space-y-2.5 font-sans resume-section">
                    <h3 className="text-xs font-bold uppercase tracking-wide border-b border-gray-200 pb-0.5" style={{ color: currentTheme.hex }}>
                      {sec.section_title || 'Projects & Achievements'}
                    </h3>

                    {sec.rows && sec.rows.map((row) => {
                      const cols = sec.columns || [];
                      const titleCol = cols.find(c => c.includes('제목') || c.includes('역할') || c.includes('프로젝트') || c.includes('카테고리')) || cols[0];
                      const periodCol = cols.find(c => c.includes('기간') || c.includes('일자') || c.includes('날짜'));

                      const mainTitle = row.values[titleCol] || 'Project / Role';
                      const periodText = periodCol ? row.values[periodCol] : '';

                      return (
                        <div key={row.id} className="text-xs space-y-1">
                          <div className="flex justify-between items-baseline font-bold text-black">
                            <span className="text-[12px]">{mainTitle}</span>
                            {periodText && <span className="text-[11px] font-mono text-gray-600 italic font-normal">{periodText}</span>}
                          </div>

                          <div className="space-y-1 pl-1">
                            {cols.map((col) => {
                              if (col === titleCol || col === periodCol) return null;
                              const val = row.values[col] || '';
                              if (!val) return null;

                              const lines = val.split('\n').filter(Boolean);

                              return (
                                <div key={col} className="space-y-0.5">
                                  {lines.map((line, idx) => (
                                    <p key={idx} className="text-gray-800 text-[11px] leading-relaxed flex items-start gap-1.5">
                                      <span className="shrink-0" style={{ color: currentTheme.hex }}>•</span>
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
                <div className="space-y-1.5 resume-section">
                  <h2 className="text-xs font-bold uppercase tracking-wider pb-0.5" style={{ color: currentTheme.hex, borderBottom: `1px solid ${currentTheme.hex}` }}>
                    EDUCATION
                  </h2>
                  {educations.map((edu) => (
                    <div key={edu.id} className="flex justify-between items-baseline text-xs font-sans">
                      <div>
                        <span className="font-bold text-black">{edu.school_name}</span>
                        {edu.major && <span className="text-gray-800"> — {edu.major}</span>}
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
              <div className="text-white p-5 rounded-xl flex justify-between items-center shadow-sm" style={{ backgroundColor: currentTheme.hex }}>
                <div className="space-y-1.5">
                  <h1 className="text-2xl font-bold tracking-tight text-white">{profile.name || '김동혁'}</h1>
                  <div className="text-xs text-white/90 space-y-1">
                    {profile.email && <p className="flex items-center gap-2"><Mail className="w-3.5 h-3.5"/> {profile.email}</p>}
                    {profile.phone_number && <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5"/> {profile.phone_number}</p>}
                    {profile.address && <p className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5"/> {profile.address} {profile.detail_address}</p>}
                  </div>
                </div>

                <div className="w-20 h-24 bg-black/20 rounded-xl border border-white/20 shadow-inner shrink-0 flex items-center justify-center overflow-hidden">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-8 h-8 text-white/60" />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-4 space-y-4 border-r border-slate-200 pr-4">
                  <div className="space-y-1.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider pb-0.5" style={{ color: currentTheme.hex, borderBottom: `1px solid ${currentTheme.hex}40` }}>Profile</h3>
                    <div className="text-xs text-slate-600 space-y-1">
                      {profile.birth_date && <p><span className="font-semibold text-slate-800">DOB:</span> {profile.birth_date}</p>}
                      <p><span className="font-semibold text-slate-800">Gender:</span> {profile.gender === 'M' ? 'Male' : 'Female'}</p>
                    </div>
                  </div>

                  {educations.length > 0 && (
                    <div className="space-y-1.5">
                      <h3 className="text-xs font-bold uppercase tracking-wider pb-0.5" style={{ color: currentTheme.hex, borderBottom: `1px solid ${currentTheme.hex}40` }}>Education</h3>
                      {educations.map((edu) => (
                        <div key={edu.id} className="text-xs space-y-0.5 mb-2">
                          <p className="font-bold text-slate-900">{edu.school_name}</p>
                          <p className="text-slate-700">{edu.major}</p>
                          <p className="text-slate-400 text-[10px]">{edu.status}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {certificates.length > 0 && (
                    <div className="space-y-1.5">
                      <h3 className="text-xs font-bold uppercase tracking-wider pb-0.5" style={{ color: currentTheme.hex, borderBottom: `1px solid ${currentTheme.hex}40` }}>Certificates</h3>
                      {certificates.map((cert) => (
                        <div key={cert.id} className="text-xs text-slate-700 space-y-0.5 mb-1.5">
                          <p className="font-semibold text-slate-900">{cert.certificate_name}</p>
                          <p className="text-slate-500 text-[10px]">{cert.issuer || '-'} | {cert.acquisition_date}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="col-span-8 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider pb-0.5" style={{ color: currentTheme.hex, borderBottom: `1px solid ${currentTheme.hex}40` }}>Projects & Work Experience</h3>
                  {activeSections.map((sec) => (
                    <div key={sec.id} className="space-y-2 p-3 rounded-xl border resume-section" style={{ backgroundColor: `${currentTheme.hex}08`, borderColor: `${currentTheme.hex}30` }}>
                      <h4 className="text-xs font-bold" style={{ color: currentTheme.hex }}>{sec.section_title || 'Section Title'}</h4>
                      {sec.rows && sec.rows.map((row) => (
                        <div key={row.id} className="text-xs space-y-1.5 pl-1">
                          {(sec.columns || []).map((col) => {
                            const val = row.values[col] || '';
                            if (!val) return null;
                            const lines = val.split('\n').filter(Boolean);

                            return (
                              <div key={col} className="space-y-0.5">
                                <span className="font-bold text-[11px]" style={{ color: currentTheme.hex }}>[{col}]</span>
                                <div className="text-slate-700 pl-2 leading-relaxed text-[11px] space-y-0.5" style={{ borderLeft: `2px solid ${currentTheme.hex}60` }}>
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

              <div className="resume-section">
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
                          <div className="w-full h-full bg-gray-50 flex items-center justify-center text-gray-400 text-[10px]">사진</div>
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

              <div className="space-y-1 resume-section">
                <h2 className="text-xs font-bold text-black border-l-2 pl-1.5 py-0.5" style={{ borderColor: currentTheme.hex }}>학력 및 자격사항 (学歴・免許・資格)</h2>
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
                <h2 className="text-xs font-bold text-black border-l-2 pl-1.5 py-0.5" style={{ borderColor: currentTheme.hex }}>경력 및 프로젝트 (職歴・プロジェクト)</h2>
                {activeSections.map((sec) => (
                  <div key={sec.id} className="space-y-1 resume-section">
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
