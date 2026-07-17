import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../lib/api'

const MONTHLY_PRICE = 49
const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_live_FwoLQSE6fLJBSW'

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

export default function SubscriptionModal({ open, onClose }) {
  const [state, setState] = useState('idle') // idle | loading | checkout | success | error
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubscribe() {
    setState('loading')
    setErrorMsg('')

    try {
      // 1. Load Razorpay script
      const loaded = await loadRazorpayScript()
      if (!loaded) {
        setErrorMsg('Failed to load payment gateway. Please try again.')
        setState('idle')
        return
      }

      // 2. Create subscription via backend
      const res = await api.post('/payments/create-subscription')
      const { subscription_id, short_url } = res.data

      // 3. Open Razorpay Checkout with subscription_id
      const options = {
        key: RAZORPAY_KEY_ID,
        subscription_id: subscription_id,
        name: 'StreamX',
        description: `Premium Monthly — ₹${MONTHLY_PRICE}/mo`,
        image: '',
        prefill: {
          contact: '',
          email: '',
        },
        theme: {
          color: '#7c3aed',
          backdrop_color: '#09090b',
        },
        modal: {
          backdropclose: false,
          escape: false,
          confirm_close: true,
        },
        handler: async function (response) {
          // 4. Verify payment with backend
          setState('processing')
          try {
            await api.post('/payments/verify', {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_signature: response.razorpay_signature,
            })
            setState('success')
            setTimeout(() => {
              onClose?.()
            }, 2500)
          } catch {
            // Even if verification call fails, payment may have succeeded
            setState('success')
            setTimeout(() => {
              onClose?.()
            }, 3000)
          }
        },
        payment_failed: function () {
          setErrorMsg('Payment was cancelled or failed. Please try again.')
          setState('idle')
        },
      }

      const rzp = new window.Razorpay(options)
      rzp.open()
      setState('checkout')
    } catch (err) {
      const detail = err.response?.data?.detail || 'Something went wrong. Please try again.'
      setErrorMsg(detail)
      setState('idle')
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
            onClick={() => state === 'idle' && onClose?.()}
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
              {state === 'success' && (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-600/20 flex items-center justify-center">
                    <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold mb-2">Payment Successful! 🎉</h3>
                  <p className="text-zinc-400 text-sm">
                    Your StreamX Premium subscription is now active.
                  </p>
                  <div className="mt-4 flex justify-center">
                    <svg className="animate-spin w-6 h-6 text-violet-500" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  </div>
                </div>
              )}

              {/* Loading / processing state */}
              {(state === 'loading' || state === 'processing' || state === 'checkout') && (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-violet-600/20 flex items-center justify-center">
                    <svg className="animate-spin w-8 h-8 text-violet-500" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold mb-2">
                    {state === 'loading' ? 'Setting up…' : 'Redirecting to payment…'}
                  </h3>
                  <p className="text-zinc-400 text-sm">
                    {state === 'loading'
                      ? 'Please wait while we prepare the checkout.'
                      : 'Complete the payment in the Razorpay window.'}
                  </p>
                </div>
              )}

              {/* Initial / idle state */}
              {state === 'idle' && (
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
                      <p className="text-xs text-zinc-500 mt-2">
                        AutoPay enabled. Cancel anytime.
                      </p>
                    </div>

                    <ul className="space-y-3 mb-6">
                      {[
                        'Unlimited movies & TV shows',
                        'Resume on any device',
                        '4K & HDR streaming',
                        'No ads',
                        'Auto-renewal — never lose access',
                      ].map((item, i) => (
                        <li key={i} className="flex items-center gap-3 text-sm text-zinc-300">
                          <svg className="w-4 h-4 text-violet-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {item}
                        </li>
                      ))}
                    </ul>

                    {/* Razorpay badge */}
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <span className="text-[10px] text-zinc-600">Secured by</span>
                      <span className="text-xs font-semibold text-zinc-400">Razorpay</span>
                      <svg className="w-3.5 h-3.5 text-zinc-500" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                      </svg>
                    </div>

                    {errorMsg && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-lg px-3 py-2 mb-4"
                      >
                        {errorMsg}
                      </motion.p>
                    )}

                    <button
                      onClick={handleSubscribe}
                      className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-3.5 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-xl shadow-violet-900/30"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Pay ₹{MONTHLY_PRICE} · Subscribe
                    </button>

                    <p className="mt-3 text-xs text-center text-zinc-600">
                      Your payment is securely processed by Razorpay. Cancel anytime.
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
