import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { authAPI } from '../lib/api'
import Navbar from '../components/layout/Navbar'
import SubscriptionModal from '../components/SubscriptionModal'

export default function ProfilePage() {
  const navigate = useNavigate()
  const [sub, setSub] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  const username = localStorage.getItem('username') || 'User'
  const email = localStorage.getItem('email') || '—'
  const avatarUrl = localStorage.getItem('avatar_url') || ''

  useEffect(() => {
    async function load() {
      try {
        const res = await authAPI.getSubscription()
        setSub(res.data)
      } catch {
        // fallback
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const isExpired = sub?.status === 'expired'
  const isTrial = sub?.status === 'trial'
  const isActive = sub?.status === 'active'

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
            <div className="flex justify-between items-center py-2 border-b border-zinc-800/50">
              <span className="text-zinc-400">Member since</span>
              <span className="font-medium">
                {sub?.trial_started_at
                  ? new Date(sub.trial_started_at).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : '—'}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Subscription */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6"
        >
          <h2 className="text-lg font-semibold mb-4">Subscription</h2>

          {loading ? (
            <div className="flex items-center gap-3 py-4">
              <svg className="animate-spin w-5 h-5 text-violet-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span className="text-sm text-zinc-400">Loading subscription info…</span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Status badge */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">Status</span>
                <div className="flex items-center gap-2">
                  {isActive && (
                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Active
                    </span>
                  )}
                  {isTrial && (
                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                      Free Trial
                    </span>
                  )}
                  {isExpired && (
                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                      Expired
                    </span>
                  )}
                </div>
              </div>

              {/* Days remaining */}
              {sub?.days_remaining != null && (
                <div className="flex justify-between items-center py-2 border-b border-zinc-800/50">
                  <span className="text-sm text-zinc-400">
                    {isTrial ? 'Trial ends in' : 'Renews in'}
                  </span>
                  <span className="text-sm font-semibold">
                    {sub.days_remaining > 0
                      ? `${sub.days_remaining} day${sub.days_remaining !== 1 ? 's' : ''}`
                      : 'Today'}
                  </span>
                </div>
              )}

              {/* Plan info */}
              <div className="flex justify-between items-center py-2 border-b border-zinc-800/50">
                <span className="text-sm text-zinc-400">Plan</span>
                <span className="text-sm font-medium">₹49 / month</span>
              </div>

              {/* Upgrade CTA */}
              {(isTrial || isExpired) && (
                <button
                  onClick={() => setShowUpgradeModal(true)}
                  className="w-full mt-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold py-3 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {isExpired ? 'Reactivate Subscription — ₹49/mo' : 'Upgrade to Premium — ₹49/mo'}
                </button>
              )}

              {isActive && (
                <div className="rounded-xl bg-zinc-800/50 p-4">
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    Your subscription is active. Thanks for being a premium member!
                  </p>
                </div>
              )}
            </div>
          )}
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

      {/* Upgrade modal */}
      <SubscriptionModal
        open={showUpgradeModal}
        onClose={() => {
          setShowUpgradeModal(false)
          // Refresh subscription status after closing
          authAPI.getSubscription().then((res) => setSub(res.data)).catch(() => {})
        }}
      />
    </div>
  )
}
