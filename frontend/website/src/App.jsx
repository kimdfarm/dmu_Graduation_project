import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import ProfileSettings from './pages/ProfileSettings';

// Login 관련 (Signup.jsx 대소문자 수정)
import Login from './pages/login/Login';
import FindId from './pages/login/FindId';
import FindPassword from './pages/login/FindPassword';
import SignUp from './pages/login/Signup'; // 👈 Signup.jsx 파일명에 맞춰 소문자 u로 수정

// Resume 관련
import Resume from './pages/resume/Resume';
import ResumeNew from './pages/resume/ResumeNew';
import ResumeDetail from './pages/resume/ResumeDetail';
import ResumeEdit from './pages/resume/ResumeEdit';
import DownloadResumePDF from './pages/resume/ResumeDownload';

// CoverLetter 관련
import CoverLetter from './pages/CoverLetter/CoverLetter';
import CoverLetterNew from './pages/CoverLetter/CoverLetterNew';
import CoverLetterDetail from './pages/CoverLetter/CoverLetterDetail';
import CoverLetterEdit from './pages/CoverLetter/CoverLetterEdit';
import CoverLetterDownload from './pages/CoverLetter/CoverLetterDownload';

// Job 관련
import JobBoard from './pages/Job/JobBoard';
import JobCard from './pages/Job/JobCard';

// Github 관련
import GithubCallback from './pages/github/GithubCallback';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 메인 대시보드 */}
        <Route path="/" element={<Dashboard />} />
        
        {/* 인증 / 계정 */}
        <Route path="/login" element={<Login />} />
        <Route path="/sign-up" element={<SignUp />} />
        <Route path="/find-id" element={<FindId />} />
        <Route path="/find-password" element={<FindPassword />} />
        <Route path="/ProfileSettings" element={<ProfileSettings />} />
        <Route path="/auth/github/callback" element={<GithubCallback />} />

        {/* 이력서 */}
        <Route path="/resume" element={<Resume />} />
        <Route path="/resume/new" element={<ResumeNew />} />
        <Route path="/resume/:resumeId" element={<ResumeDetail />} />
        <Route path="/resume/:resumeId/edit" element={<ResumeEdit />} />
        <Route path="/resume/:resumeId/download" element={<DownloadResumePDF />} />

        {/* 자기소개서 */}
        <Route path="/cover-letter" element={<CoverLetter />} />
        <Route path="/cover-letter/new" element={<CoverLetterNew />} />
        <Route path="/cover-letter/:coverLetterId" element={<CoverLetterDetail />} />
        <Route path="/cover-letter/:coverLetterId/edit" element={<CoverLetterEdit />} />
        <Route path="/cover-letter/:coverLetterId/download" element={<CoverLetterDownload />} />

        {/* 채용 정보 */}
        <Route path="/jobBoard" element={<JobBoard />} />
        <Route path="/jobCard" element={<JobCard />} />
      </Routes>
    </BrowserRouter>
  );
}