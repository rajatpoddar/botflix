import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { isAuthenticated } from '../lib/auth'
import { authAPI } from '../lib/api'
import SubscriptionModal from './SubscriptionModal'

export default function ProtectedRoute({ children }) {
  const [subStatus, setSubStatus] = useState(null) // 'loading' | 'ok' | 'expired'
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function check() {
      if (!isAuthenticated()) {
        if (!cancelled) setSubStatus('ok')
        return
      }
      try {
        const res = await authAPI.getSubscription()
        const status = res.data?.status
        if (!cancelled) {
          if (status === 'expired') {
            setSubStatus('expired')
            setShowModal(true)
          } else {
            setSubStatus('ok')
          }
        }
      } catch {
        // If subscription check fails, still allow access
        if (!cancelled) setSubStatus('ok')
      }
    }
    check()
    return () => { cancelled = true }
  }, [])

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }

  // Show a brief loading state while checking subscription
  if (subStatus === null) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <svg className="animate-spin w-8 h-8 text-violet-500" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    )
  }

  return (
    <>
      {children}
      <SubscriptionModal
        open={showModal}
        onClose={() => {
          // If expired and no payment, keep showing the modal
          if (subStatus === 'expired') return
          setShowModal(false)
        }}
      />
    </>
  )
}
