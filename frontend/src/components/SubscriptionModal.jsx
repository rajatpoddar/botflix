import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { authAPI } from '../lib/api'

const MONTHLY_PRICE = 49

export default function SubscriptionModal({ open, onClose }) {
  const [activating, setActivating] = useState(false)
  const [activated, setActivated] = useState(false)
  const [error, setError] = useState('')

  async function handleActivate() {
    setActivating(true)
    setError('')
    try {
      await authAPI.activateSubscription()
      setActivated(true)
      setTimeout(() => {
        setActivated(false)
        onClose?.()
      }, 2000)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setActivating(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
            onClick={() => !activating && onClose?.()}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="relative w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/95 backdrop-blur-xl shadow-2xl overflow-hidden">
              {/* Success state */}
              {activated ? (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-violet-600/20 flex items-center justify-center">
                    <svg className="w-8 h-8 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold mb-2">Subscription Active!</h3>
                  <p className="text-zinc-400 text-sm">Enjoy unlimited streaming for the next 30 days.</p>
                </div>
              ) : (
                <>
                  {/* Header gradient */}
                  <div className="bg-gradient-to-br from-violet-600/20 to-transparent p-6 pb-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-xl font-bold">Your Trial Ended</h2>
                        <p className="text-sm text-zinc-400 mt-1">
                          Subscribe to continue watching
                        </p>
                      </div>
                      <button
                        onClick={() => onClose?.()}
                        className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                      >
                        <svg className="w-5 h-5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Pricing */}
                  <div className="p-6">
                    <div className="text-center mb-6">
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-4xl font-black">₹{MONTHLY_PRICE}</span>
                        <span className="text-zinc-400">/month</span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-2">Cancel anytime</p>
                    </div>

                    <ul className="space-y-3 mb-6">
                      {[
                        'Unlimited movies & TV shows',
                        'Resume on any device',
                        '4K & HDR streaming',
                        'No ads',
                      ].map((item, i) => (
                        <li key={i} className="flex items-center gap-3 text-sm text-zinc-300">
                          <svg className="w-4 h-4 text-violet-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {item}
                        </li>
                      ))}
                    </ul>

                    {error && (
                      <p className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-lg px-3 py-2 mb-4">
                        {error}
                      </p>
                    )}

                    <button
                      onClick={handleActivate}
                      disabled={activating}
                      className="w-full bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/50 text-white font-bold py-3.5 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      {activating ? (
                        <>
                          <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          Processing…
                        </>
                      ) : (
                        `Pay ₹${MONTHLY_PRICE} · Subscribe`
                      )}
                    </button>

                    <p className="mt-3 text-xs text-center text-zinc-600">
                      Your payment is securely processed. Cancel anytime.
                    </p>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
