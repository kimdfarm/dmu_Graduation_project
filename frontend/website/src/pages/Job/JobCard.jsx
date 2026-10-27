import React, { useState } from 'react';
import { 
  Building2, Calendar, ExternalLink, Tag, FileText, CheckCircle2, 
  Sparkles, Gift, Clock, Database, X, ChevronDown, ChevronUp 
} from 'lucide-react';

const JobCard = ({ job }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // 접기/펼치기 상태 관리
  const [isBodyExpanded, setIsBodyExpanded] = useState(false);
  const [isAnotherExpanded, setIsAnotherExpanded] = useState(false);

  // 날짜 포맷팅 함수
  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  return (
    <>
      {/* 💡 카드 전체 클릭 시 모달 오픈 (버튼 누를 필요 없음) */}
      <div 
        onClick={() => setIsModalOpen(true)}
        className="bg-[#0e0b2d] border border-amber-950/60 hover:border-amber-500/60 rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 shadow-xl hover:shadow-amber-500/10 group cursor-pointer"
      >
        <div className="space-y-3.5">
          
          {/* 헤더: 회사명 & 직무 카테고리 & 외부 링크 */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300 bg-amber-950/60 border border-amber-800/40 px-3 py-1 rounded-full">
                <Building2 className="w-3.5 h-3.5 text-amber-400" />
                {job.company_name}
              </span>
              <span className="text-[11px] text-slate-400 block mt-1.5 ml-0.5">
                ID: #{job.id} | 카테고리: {job.job_category || '미지정'}
              </span>
            </div>
            
            {/* 원본 공고 링크 버튼 (이벤트 버블링 방지) */}
            <a
              href={job.job_url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-2 text-slate-400 hover:text-amber-400 hover:bg-amber-950/40 rounded-xl transition-colors border border-transparent hover:border-amber-900/40"
              title="원본 공고 보기"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          {/* 직무 제목 */}
          <h3 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors line-clamp-2">
            {job.job_title}
          </h3>

          {/* 자격요건 요약 */}
          {job.requirements && (
            <div className="text-xs text-slate-300 bg-[#07051a] p-3 rounded-2xl border border-amber-950/60 space-y-1">
              <span className="text-[11px] font-bold text-slate-200 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> 자격 요건
              </span>
              <p className="line-clamp-2 leading-relaxed text-slate-400">{job.requirements}</p>
            </div>
          )}

          {/* 우대사항 요약 */}
          {job.preferred && (
            <div className="text-xs text-slate-300 bg-[#07051a] p-3 rounded-2xl border border-amber-950/60 space-y-1">
              <span className="text-[11px] font-bold text-slate-200 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> 우대 사항
              </span>
              <p className="line-clamp-2 leading-relaxed text-slate-400">{job.preferred}</p>
            </div>
          )}
        </div>

        {/* 💡 푸터 영역 (키워드를 아래쪽에 배치하고 공간 낭비 최소화) */}
        <div className="pt-4 mt-4 border-t border-amber-950/80 space-y-3">
          
          {/* 필요 기술 키워드 (최대 4개만 노출하여 세로 공간 절약) */}
          {job.skills && job.skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {job.skills.slice(0, 4).map((skill, idx) => (
                <span 
                  key={idx} 
                  className="text-[10px] bg-[#07051a] border border-amber-950/80 text-slate-300 px-2.5 py-0.5 rounded-lg flex items-center gap-1"
                >
                  <Tag className="w-2.5 h-2.5 text-amber-400" />
                  {skill}
                </span>
              ))}
              {job.skills.length > 4 && (
                <span className="text-[10px] text-slate-500 self-center">+{job.skills.length - 4}</span>
              )}
            </div>
          )}

          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1 text-slate-200 font-medium">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              마감: {job.closing_date || '상시 채용'}
            </span>
            <span className="flex items-center gap-1 text-slate-400 text-[10px]">
              <Clock className="w-2.5 h-2.5 text-slate-400" />
              {formatDate(job.created_at)}
            </span>
          </div>
        </div>
      </div>

      {/* 상세보기 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0e0b2d] border border-amber-950 rounded-3xl w-full max-w-4xl max-h-[85vh] overflow-y-auto p-8 space-y-6 text-slate-200 shadow-2xl relative">
            
            {/* 모달 헤더 */}
            <div className="flex items-start justify-between border-b border-amber-950/80 pb-5">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-300 bg-amber-950 px-3 py-1 rounded-full border border-amber-800/50">
                    {job.company_name}
                  </span>
                  <span className="text-xs text-slate-400">ID: {job.id}</span>
                </div>
                <h2 className="text-xl md:text-2xl font-black text-white">{job.job_title}</h2>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white bg-[#07051a] hover:bg-amber-950/40 rounded-xl transition-colors border border-amber-950"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 모달 메타데이터 영역 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#07051a] p-5 rounded-2xl border border-amber-950/60 text-xs shadow-inner">
              <div><strong className="text-slate-400">직무 카테고리:</strong> <span className="text-slate-200 font-semibold">{job.job_category || '-'}</span></div>
              <div><strong className="text-slate-400">마감일:</strong> <span className="text-slate-200 font-semibold">{job.closing_date || '상시 채용'}</span></div>
              <div><strong className="text-slate-400">DB 생성일(created_at):</strong> <span className="text-slate-200 font-semibold">{job.created_at || '-'}</span></div>
              <div><strong className="text-slate-400">크롤링 생성일(created_data):</strong> <span className="text-slate-200 font-semibold">{job.created_data || '-'}</span></div>
              <div className="md:col-span-2 truncate">
                <strong className="text-slate-400">공고 URL:</strong>{' '}
                <a href={job.job_url} target="_blank" rel="noreferrer" className="text-amber-400 hover:underline">
                  {job.job_url}
                </a>
              </div>
            </div>

            {/* 세부 정보 영역 */}
            <div className="space-y-5 text-xs">
              {job.skills && job.skills.length > 0 && (
                <div>
                  <h4 className="font-bold text-slate-200 text-sm mb-2.5 flex items-center gap-1.5">
                    <Tag className="w-4 h-4 text-amber-400" /> 필요 기술
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {job.skills.map((s, idx) => (
                      <span key={idx} className="bg-[#07051a] text-slate-200 px-3 py-1.5 rounded-xl border border-amber-950/80 font-medium">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {job.requirements && (
                <div className="bg-[#07051a] p-5 rounded-2xl border border-amber-950/60 shadow-inner">
                  <h4 className="font-bold text-emerald-400 text-sm mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> 자격 요건 (requirements)
                  </h4>
                  <p className="whitespace-pre-wrap leading-relaxed text-slate-300">{job.requirements}</p>
                </div>
              )}

              {job.preferred && (
                <div className="bg-[#07051a] p-5 rounded-2xl border border-amber-950/60 shadow-inner">
                  <h4 className="font-bold text-amber-400 text-sm mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" /> 우대 사항 (preferred)
                  </h4>
                  <p className="whitespace-pre-wrap leading-relaxed text-slate-300">{job.preferred}</p>
                </div>
              )}

              {job.benefits && (
                <div className="bg-[#07051a] p-5 rounded-2xl border border-amber-950/60 shadow-inner">
                  <h4 className="font-bold text-purple-400 text-sm mb-2 flex items-center gap-1.5">
                    <Gift className="w-4 h-4" /> 복지 및 혜택 (benefits)
                  </h4>
                  <p className="whitespace-pre-wrap leading-relaxed text-slate-300">{job.benefits}</p>
                </div>
              )}

              {/* 상세 본문 생 데이터 (body_data) 분리 */}
              {job.body_data && (
                <div className="bg-[#07051a] rounded-2xl border border-amber-950/80 overflow-hidden shadow-inner">
                  <button
                    onClick={() => setIsBodyExpanded(!isBodyExpanded)}
                    className="w-full p-5 flex items-center justify-between text-left hover:bg-amber-950/20 transition-colors"
                  >
                    <h4 className="font-bold text-amber-400 text-sm flex items-center gap-2">
                      <FileText className="w-4 h-4" /> 상세 본문 데이터 (body_data - 가공 전 생 데이터)
                    </h4>
                    <span className="text-xs text-amber-300/80 flex items-center gap-1 font-semibold bg-amber-950/80 px-3 py-1 rounded-xl border border-amber-800/50">
                      {isBodyExpanded ? '접기' : '생 데이터 펼쳐보기'}
                      {isBodyExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </span>
                  </button>

                  {isBodyExpanded && (
                    <div className="px-5 pb-5 border-t border-amber-950/80 pt-4">
                      <div className="bg-[#040211] p-4 rounded-xl border border-amber-950">
                        <p className="whitespace-pre-wrap leading-relaxed font-mono text-slate-300 text-[11px] max-h-96 overflow-y-auto pr-2">
                          {job.body_data}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 기타 생 데이터 (another_data) 분리 */}
              {job.another_data && (
                <div className="bg-[#07051a] rounded-2xl border border-amber-950/80 overflow-hidden shadow-inner">
                  <button
                    onClick={() => setIsAnotherExpanded(!isAnotherExpanded)}
                    className="w-full p-5 flex items-center justify-between text-left hover:bg-amber-950/20 transition-colors"
                  >
                    <h4 className="font-bold text-slate-300 text-sm flex items-center gap-2">
                      <Database className="w-4 h-4 text-amber-400" /> 기타 데이터 (another_data - 가공 전 생 데이터)
                    </h4>
                    <span className="text-xs text-slate-300 flex items-center gap-1 font-semibold bg-amber-950/80 px-3 py-1 rounded-xl border border-amber-800/50">
                      {isAnotherExpanded ? '접기' : '생 데이터 펼쳐보기'}
                      {isAnotherExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </span>
                  </button>

                  {isAnotherExpanded && (
                    <div className="px-5 pb-5 border-t border-amber-950/80 pt-4">
                      <div className="bg-[#040211] p-4 rounded-xl border border-amber-950">
                        <p className="whitespace-pre-wrap leading-relaxed font-mono text-slate-300 text-[11px] max-h-96 overflow-y-auto pr-2">
                          {job.another_data}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 하단 닫기 */}
            <div className="flex justify-end pt-3 border-t border-amber-950/80">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors"
              >
                닫기
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
};

export default JobCard;