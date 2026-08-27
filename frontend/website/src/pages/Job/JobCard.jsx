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
      {/* 카드 UI */}
      <div className="bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-xl p-5 flex flex-col justify-between transition-all duration-200 hover:shadow-lg hover:shadow-indigo-950/20 group">
        <div className="space-y-4">
          
          {/* 헤더: 회사명 & 직무 카테고리 */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-400 bg-indigo-950/60 border border-indigo-800/40 px-2.5 py-1 rounded-md">
                <Building2 className="w-3.5 h-3.5" />
                {job.company_name}
              </span>
              <span className="text-[11px] text-slate-500 block mt-1 ml-0.5">
                ID: #{job.id} | 카테고리: {job.job_category || '미지정'}
              </span>
            </div>
            
            {/* 공고 링크 버튼 */}
            <a
              href={job.job_url}
              target="_blank"
              rel="noreferrer"
              className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-indigo-950/50 rounded-lg transition-colors"
              title="원본 공고 보기"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          {/* 직무 제목 */}
          <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-2">
            {job.job_title}
          </h3>

          {/* 기술 스택 */}
          {job.skills && job.skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {job.skills.map((skill, idx) => (
                <span 
                  key={idx} 
                  className="text-[11px] bg-slate-800/80 border border-slate-700/50 text-slate-300 px-2 py-0.5 rounded-md flex items-center gap-1"
                >
                  <Tag className="w-2.5 h-2.5 text-indigo-400" />
                  {skill}
                </span>
              ))}
            </div>
          )}

          {/* 자격요건 요약 */}
          {job.requirements && (
            <div className="text-xs text-slate-400 bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/50 space-y-1">
              <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" /> 자격 요건
              </span>
              <p className="line-clamp-2 leading-relaxed">{job.requirements}</p>
            </div>
          )}

          {/* 우대사항 요약 */}
          {job.preferred && (
            <div className="text-xs text-slate-400 bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/50 space-y-1">
              <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" /> 우대 사항
              </span>
              <p className="line-clamp-2 leading-relaxed">{job.preferred}</p>
            </div>
          )}

          {/* 혜택 및 복지 요약 */}
          {job.benefits && (
            <div className="text-xs text-slate-400 bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/50 space-y-1">
              <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                <Gift className="w-3 h-3 text-purple-400" /> 혜택 및 복지
              </span>
              <p className="line-clamp-1 leading-relaxed">{job.benefits}</p>
            </div>
          )}
        </div>

        {/* 푸터: 마감일, 수집일 & 전체보기 버튼 */}
        <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between gap-2">
          <div className="flex flex-col text-[11px] text-slate-400 gap-0.5">
            <span className="flex items-center gap-1 text-slate-300">
              <Calendar className="w-3 h-3 text-indigo-400" />
              마감: {job.closing_date || '상시 채용'}
            </span>
            <span className="flex items-center gap-1 text-slate-400 text-[10px]">
              <Clock className="w-2.5 h-2.5 text-slate-400" />
              등록: {formatDate(job.created_at)}
            </span>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white rounded-lg text-xs font-medium transition-all"
          >
            모든 정보 보기
          </button>
        </div>
      </div>

      {/* 상세보기 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto p-6 space-y-6 text-slate-200 shadow-2xl relative">
            
            {/* 모달 헤더 */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-indigo-400 bg-indigo-950 px-2.5 py-0.5 rounded border border-indigo-800/50">
                    {job.company_name}
                  </span>
                  <span className="text-xs text-slate-500">ID: {job.id}</span>
                </div>
                <h2 className="text-xl font-bold text-white">{job.job_title}</h2>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 모달 메타데이터 영역 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800/60 text-xs">
              <div><strong className="text-slate-400">직무 카테고리:</strong> {job.job_category || '-'}</div>
              <div><strong className="text-slate-400">마감일:</strong> {job.closing_date || '상시 채용'}</div>
              <div><strong className="text-slate-400">DB 생성일(created_at):</strong> {job.created_at || '-'}</div>
              <div><strong className="text-slate-400">크롤링 생성일(created_data):</strong> {job.created_data || '-'}</div>
              <div className="md:col-span-2 truncate">
                <strong className="text-slate-400">공고 URL:</strong>{' '}
                <a href={job.job_url} target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">
                  {job.job_url}
                </a>
              </div>
            </div>

            {/* 세부 정보 영역 */}
            <div className="space-y-4 text-xs">
              {job.skills && job.skills.length > 0 && (
                <div>
                  <h4 className="font-semibold text-slate-300 text-sm mb-2 flex items-center gap-1.5">
                    <Tag className="w-4 h-4 text-indigo-400" /> 필요 기술
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {job.skills.map((s, idx) => (
                      <span key={idx} className="bg-slate-800 text-slate-200 px-2.5 py-1 rounded border border-slate-700">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {job.requirements && (
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                  <h4 className="font-semibold text-emerald-400 text-sm mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> 자격 요건 (requirements)
                  </h4>
                  <p className="whitespace-pre-wrap leading-relaxed text-slate-300">{job.requirements}</p>
                </div>
              )}

              {job.preferred && (
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                  <h4 className="font-semibold text-amber-400 text-sm mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" /> 우대 사항 (preferred)
                  </h4>
                  <p className="whitespace-pre-wrap leading-relaxed text-slate-300">{job.preferred}</p>
                </div>
              )}

              {job.benefits && (
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                  <h4 className="font-semibold text-purple-400 text-sm mb-2 flex items-center gap-1.5">
                    <Gift className="w-4 h-4" /> 복지 및 혜택 (benefits)
                  </h4>
                  <p className="whitespace-pre-wrap leading-relaxed text-slate-300">{job.benefits}</p>
                </div>
              )}

              {/* 접기/펼치기 기능이 추가된 상세 본문 데이터 (body_data) */}
              {job.body_data && (
                <div className="bg-slate-950 rounded-xl border border-slate-800/80 overflow-hidden">
                  <button
                    onClick={() => setIsBodyExpanded(!isBodyExpanded)}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-900/50 transition-colors"
                  >
                    <h4 className="font-semibold text-blue-400 text-sm flex items-center gap-1.5">
                      <FileText className="w-4 h-4" /> 상세 본문 데이터 (body_data)
                    </h4>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      {isBodyExpanded ? '접기' : '펼쳐보기'}
                      {isBodyExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </span>
                  </button>

                  {isBodyExpanded && (
                    <div className="px-4 pb-4 border-t border-slate-800/50 pt-3">
                      <p className="whitespace-pre-wrap leading-relaxed text-slate-300 max-h-96 overflow-y-auto pr-2">
                        {job.body_data}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* 접기/펼치기 기능이 추가된 기타 데이터 (another_data) */}
              {job.another_data && (
                <div className="bg-slate-950 rounded-xl border border-slate-800/80 overflow-hidden">
                  <button
                    onClick={() => setIsAnotherExpanded(!isAnotherExpanded)}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-900/50 transition-colors"
                  >
                    <h4 className="font-semibold text-slate-400 text-sm flex items-center gap-1.5">
                      <Database className="w-4 h-4" /> 기타 데이터 (another_data)
                    </h4>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      {isAnotherExpanded ? '접기' : '펼쳐보기'}
                      {isAnotherExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </span>
                  </button>

                  {isAnotherExpanded && (
                    <div className="px-4 pb-4 border-t border-slate-800/50 pt-3">
                      <p className="whitespace-pre-wrap leading-relaxed text-slate-300 max-h-96 overflow-y-auto pr-2">
                        {job.another_data}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 하단 닫기 */}
            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-medium transition-colors"
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