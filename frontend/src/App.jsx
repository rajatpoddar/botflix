import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { DownloadProvider } from './contexts/DownloadContext'
import ProtectedRoute from './components/ProtectedRoute'

import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import TermsOfService from './pages/TermsOfService'
import PrivacyPolicy from './pages/PrivacyPolicy'
import RefundPolicy from './pages/RefundPolicy'
import AboutPage from './pages/AboutPage'
import HomePage from './pages/HomePage'
import MoviesPage from './pages/MoviesPage'
import TVShowsPage from './pages/TVShowsPage'
import WatchPage from './pages/WatchPage'
import SearchPage from './pages/SearchPage'
import TVShowDetailPage from './pages/TVShowDetailPage'
import MovieDetailPage from './pages/MovieDetailPage'
import ProfilePage from './pages/ProfilePage'
import WatchlistPage from './pages/WatchlistPage'
import CollectionDetailPage from './pages/CollectionDetailPage'
import DownloadsPage from './pages/DownloadsPage'
import OfflinePage from './pages/OfflinePage'

export default function App() {
  return (
    <AuthProvider>
      <DownloadProvider>
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/terms-of-service" element={<TermsOfService />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/refund-policy" element={<RefundPolicy />} />
        <Route path="/about" element={<AboutPage />} />

        {/* Protected */}
        <Route path="/browse" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route path="/browse/movies" element={<ProtectedRoute><MoviesPage /></ProtectedRoute>} />
        <Route path="/browse/shows" element={<ProtectedRoute><TVShowsPage /></ProtectedRoute>} />
        <Route path="/show/:id" element={<ProtectedRoute><TVShowDetailPage /></ProtectedRoute>} />
        <Route path="/movie/:id" element={<ProtectedRoute><MovieDetailPage /></ProtectedRoute>} />
        <Route path="/collection/:id" element={<ProtectedRoute><CollectionDetailPage /></ProtectedRoute>} />
        <Route path="/watch/:id" element={<ProtectedRoute><WatchPage /></ProtectedRoute>} />
        <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/browse/watchlist" element={<ProtectedRoute><WatchlistPage /></ProtectedRoute>} />
        <Route path="/browse/downloads" element={<ProtectedRoute><DownloadsPage /></ProtectedRoute>} />

        {/* PWA offline fallback */}
        <Route path="/offline" element={<OfflinePage />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </DownloadProvider>
    </AuthProvider>
  )
}
