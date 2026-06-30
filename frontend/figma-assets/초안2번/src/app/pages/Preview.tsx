import { useState, useEffect } from "react";
import { useParams, Link } from "react-router";
import { getResumeById, Resume } from "../mockData";
import { ChevronLeft, Mail, Phone, Github, Globe, Briefcase } from "lucide-react";

export function Preview() {
  const { id } = useParams<{ id: string }>();
  const [resume, setResume] = useState<Resume | null>(null);

  useEffect(() => {
    if (id) {
      setResume(getResumeById(id) || null);
    }
  }, [id]);

  if (!resume) return <div className="p-8 text-center text-slate-500">불러오는 중...</div>;

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Header */}
      <header className="bg-white px-4 py-3 flex items-center border-b border-slate-100 z-10 shrink-0 sticky top-0">
        <Link to={`/editor/${resume.id}`} className="p-2 -ml-2 text-slate-500 active:bg-slate-100 rounded-full">
          <ChevronLeft className="w-6 h-6" />
        </Link>
        <span className="font-bold text-slate-900 ml-2">미리보기</span>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 pb-12">
        <header className="mb-10 text-center">
          <h1 className="text-3xl font-black tracking-tight mb-1 text-slate-900">{resume.basicInfo.name}</h1>
          <h2 className="text-sm font-bold text-indigo-600 mb-6">{resume.basicInfo.position}</h2>
          
          <div className="flex flex-col items-center gap-2 text-sm text-slate-600 font-medium bg-slate-50 py-4 px-2 rounded-2xl">
            {resume.basicInfo.email && (
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-400" />
                <span>{resume.basicInfo.email}</span>
              </div>
            )}
            {resume.basicInfo.phone && (
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-slate-400" />
                <span>{resume.basicInfo.phone}</span>
              </div>
            )}
            <div className="flex gap-4 mt-2">
              {resume.basicInfo.github && (
                <a href={resume.basicInfo.github} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900">
                  <Github className="w-4 h-4" />
                  <span className="text-xs">GitHub</span>
                </a>
              )}
              {resume.basicInfo.blog && (
                <a href={resume.basicInfo.blog} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900">
                  <Globe className="w-4 h-4" />
                  <span className="text-xs">Blog</span>
                </a>
              )}
              {resume.basicInfo.portfolio && (
                <a href={resume.basicInfo.portfolio} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900">
                  <Briefcase className="w-4 h-4" />
                  <span className="text-xs">Portfolio</span>
                </a>
              )}
            </div>
          </div>
        </header>

        <div className="space-y-10">
          {/* Skills */}
          {resume.skills.length > 0 && resume.skills.some(c => c.items.length > 0) && (
            <section>
              <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
                <div className="w-1.5 h-5 bg-indigo-600 rounded-full" />
                Skills
              </h3>
              <div className="space-y-4">
                {resume.skills.filter(c => c.items.length > 0).map((category, idx) => (
                  <div key={idx}>
                    <div className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">{category.category}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {category.items.map((item, i) => (
                        <span key={i} className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md text-xs font-bold">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Experience */}
          {resume.experiences.length > 0 && (
            <section>
              <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
                <div className="w-1.5 h-5 bg-indigo-600 rounded-full" />
                Experience
              </h3>
              <div className="space-y-6">
                {resume.experiences.map((exp) => (
                  <div key={exp.id} className="relative pl-4 border-l-2 border-slate-100">
                    <div className="absolute w-2 h-2 bg-indigo-600 rounded-full -left-[5px] top-1.5" />
                    <h4 className="text-base font-bold text-slate-900">{exp.company}</h4>
                    <div className="text-sm font-semibold text-slate-700 mb-1">{exp.role}</div>
                    <div className="text-xs font-bold text-slate-400 font-mono mb-2">
                      {exp.startDate} ~ {exp.isCurrent ? "현재" : exp.endDate}
                    </div>
                    <div className="text-slate-600 whitespace-pre-line leading-relaxed text-sm">
                      {exp.description}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Projects */}
          {resume.projects.length > 0 && (
            <section>
              <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
                <div className="w-1.5 h-5 bg-indigo-600 rounded-full" />
                Projects
              </h3>
              <div className="space-y-8">
                {resume.projects.map((proj) => (
                  <div key={proj.id} className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-base font-bold text-slate-900 flex-1 pr-2">{proj.name}</h4>
                      {proj.link && (
                        <a href={proj.link} target="_blank" rel="noreferrer" className="text-indigo-600 p-1">
                          <Globe className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                    <div className="text-xs font-bold text-slate-400 font-mono mb-3">
                      {proj.startDate} ~ {proj.endDate}
                    </div>
                    <div className="text-sm font-semibold text-slate-700 mb-3">
                      {proj.description} <span className="text-slate-400 font-normal">| {proj.role}</span>
                    </div>
                    
                    {proj.techStack && proj.techStack.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {proj.techStack.map((tech, i) => (
                          <span key={i} className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">
                            {tech}
                          </span>
                        ))}
                      </div>
                    )}

                    <ul className="space-y-2 text-slate-600 text-sm">
                      {proj.achievements.filter(a => a.trim()).map((ach, i) => (
                        <li key={i} className="flex items-start">
                          <span className="mr-2 mt-1.5 w-1 h-1 bg-slate-400 rounded-full shrink-0"></span>
                          <span className="leading-relaxed">{ach}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Essays */}
          {resume.essays.length > 0 && (
            <section>
              <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
                <div className="w-1.5 h-5 bg-indigo-600 rounded-full" />
                Cover Letter
              </h3>
              <div className="space-y-6">
                {resume.essays.map((essay, i) => (
                  <div key={essay.id} className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                    <h4 className="text-sm font-bold text-slate-900 mb-3 flex gap-1.5 items-start">
                      <span className="text-indigo-600">Q{i+1}.</span>
                      {essay.title}
                    </h4>
                    <p className="text-slate-700 whitespace-pre-wrap leading-relaxed text-sm">
                      {essay.content}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
