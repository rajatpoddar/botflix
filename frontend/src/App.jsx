import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import HomePage from './pages/HomePage'
import MoviesPage from './pages/MoviesPage'
import TVShowsPage from './pages/TVShowsPage'
import WatchPage from './pages/WatchPage'
import SearchPage from './pages/SearchPage'
import TVShowDetailPage from './pages/TVShowDetailPage'
import MovieDetailPage from './pages/MovieDetailPage'
import ProfilePage from './pages/ProfilePage'
import WatchlistPage from './pages/WatchlistPage'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        {/* Protected */}
        <Route path="/browse" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route path="/browse/movies" element={<ProtectedRoute><MoviesPage /></ProtectedRoute>} />
        <Route path="/browse/shows" element={<ProtectedRoute><TVShowsPage /></ProtectedRoute>} />
        <Route path="/show/:id" element={<ProtectedRoute><TVShowDetailPage /></ProtectedRoute>} />
        <Route path="/movie/:id" element={<ProtectedRoute><MovieDetailPage /></ProtectedRoute>} />
        <Route path="/watch/:id" element={<ProtectedRoute><WatchPage /></ProtectedRoute>} />
        <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/browse/watchlist" element={<ProtectedRoute><WatchlistPage /></ProtectedRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
