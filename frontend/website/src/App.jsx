import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Resume from './pages/resume/Resume';
import CoverLetter from './pages/CoverLetter';
import Login from './pages/login/Login'; // 추가
import ProfileSettings from './pages/ProfileSettings'; // 추가
import FindId from './pages/login/FindId'; // 추가
import FindPassword from './pages/login/FindPassword'; // 추가
import SignUp from './pages/login/SignUp'; // 추가
import ResumeNew from './pages/resume/ResumeNew'; // 👈 추가
import ResumeDetail from './pages/resume/ResumeDetail'; // 👈 추가
import ResumeEdit from './pages/resume/ResumeEdit'; // 👈 추가
import GithubCallback from './pages/github/GithubCallback';
import DownloadResumePDF from './pages/resume/ResumeDownload'; // PDF 다운로드 유틸 함수
import JobBoard from './pages/Job/JobBoard'; // 👈 추가
import JobCard from './pages/Job/JobCard';
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 메인 대시보드 (1) */}
        <Route path="/" element={<Dashboard />} />
        
        {/* 서브 페이지들 (N) */}
        <Route path="/login" element={<Login />} />
        <Route path="/resume" element={<Resume />} />
        <Route path="/cover-letter" element={<CoverLetter />} />
        <Route path="/ProfileSettings" element={<ProfileSettings />} />
        <Route path="/find-id" element={<FindId />} />
        <Route path="/find-password" element={<FindPassword />} />
        <Route path="/sign-up" element={<SignUp />} />
        <Route path="/resume/new" element={<ResumeNew />} />
        <Route path="/resume/:resumeId" element={<ResumeDetail />} />
        <Route path="/resume/:resumeId/edit" element={<ResumeEdit />} />
        <Route path="/auth/github/callback" element={<GithubCallback />} />
        <Route path="/resume/:resumeId/download" element={<DownloadResumePDF />} />
        <Route path="/jobBoard" element={<JobBoard />} />
        <Route path="/jobCard" element={<JobCard />} />
        
      </Routes>
    </BrowserRouter>
  );
}