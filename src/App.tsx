import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { QuizProvider } from './context/QuizContext';
import { HomePage } from './pages/HomePage';
import { RegisterPage } from './pages/RegisterPage';
import { ParticipantPage } from './pages/ParticipantPage';
import { LiveStagePage } from './pages/LiveStagePage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminParticipantsPage } from './pages/admin/AdminParticipantsPage';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage';
import { AdminHistoryPage } from './pages/admin/AdminHistoryPage';
import { AdminCompetitionPage } from './pages/admin/AdminCompetitionPage';

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <QuizProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/inscription" element={<RegisterPage />} />
            <Route path="/participant/:id" element={<ParticipantPage />} />
            <Route path="/live" element={<LiveStagePage />} />
            <Route path="/classement" element={<LeaderboardPage />} />

            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
            <Route path="/admin/participants" element={<AdminParticipantsPage />} />
            <Route path="/admin/parametres" element={<AdminSettingsPage />} />
            <Route path="/admin/historique" element={<AdminHistoryPage />} />
            <Route path="/admin/competition" element={<AdminCompetitionPage />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </QuizProvider>
    </MotionConfig>
  );
}
