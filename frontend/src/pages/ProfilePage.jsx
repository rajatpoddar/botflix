import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import Navbar from '../components/layout/Navbar'

export default function ProfilePage() {
  const navigate = useNavigate()

  const username = localStorage.getItem('username') || 'User'
  const email = localStorage.getItem('email') || '—'
  const avatarUrl = localStorage.getItem('avatar_url') || ''

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Navbar />

      {/* Header */}
      <div className="pt-24 pb-8 bg-gradient-to-b from-violet-950/30 to-transparent">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-5">
            {/* Avatar */}
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={username}
                className="w-16 h-16 rounded-2xl object-cover shadow-xl shadow-violet-900/30"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-violet-600 flex items-center justify-center text-2xl font-bold uppercase shadow-xl shadow-violet-900/30">
                {username[0]}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold">{username}</h1>
              <p className="text-sm text-zinc-400">{email}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-20 space-y-6">
        {/* Account Info */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6"
        >
          <h2 className="text-lg font-semibold mb-4">Account Details</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center py-2 border-b border-zinc-800/50">
              <span className="text-zinc-400">Username</span>
              <span className="font-medium">{username}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-zinc-800/50">
              <span className="text-zinc-400">Email</span>
              <span className="font-medium">{email}</span>
            </div>
          </div>
        </motion.div>

        {/* Sign out button */}
        <button
          onClick={() => {
            localStorage.clear()
            navigate('/')
          }}
          className="w-full text-sm text-red-400 hover:text-red-300 py-3 transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign Out
        </button>
      </div>
    </div>
  )
}
