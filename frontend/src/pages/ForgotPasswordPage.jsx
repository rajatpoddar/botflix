import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import FloatingInput from '../components/ui/FloatingInput'
import Button from '../components/ui/Button'
import PosterCollage from '../components/media/PosterCollage'
import { authAPI, mediaAPI } from '../lib/api'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [collageItems, setCollageItems] = useState([])

  useEffect(() => {
    mediaAPI.getLandingData()
      .then((res) => setCollageItems(res.data?.collage || []))
      .catch(() => {})
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) return setError('Required')
    if (!/\S+@\S+\.\S+/.test(email)) return setError('Invalid email')

    setLoading(true)
    setError('')
    try {
      await authAPI.forgotPassword(email)
      setSuccess(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4 relative overflow-hidden">
      {/* Poster Collage Background */}
      {collageItems.length > 0 ? (
        <PosterCollage items={collageItems} />
      ) : (
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-900/15 rounded-full blur-3xl" />
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="mb-8 text-center">
          <span className="text-3xl font-black tracking-tight text-white inline-flex items-center">
            <img src="/logo.png" alt="StreamX" className="w-7 h-7 mr-1.5 -mt-0.5" />
            STREAM<span className="text-violet-500">X</span>
          </span>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-xl p-8 shadow-2xl">
          <AnimatePresence mode="wait">
            {success ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-4"
              >
                <div className="w-14 h-14 rounded-full bg-green-900/50 border border-green-700 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold mb-2">Check your email</h2>
                <p className="text-zinc-400 text-sm">
                  If that address is registered, you'll receive a reset link shortly.
                </p>
                <Link
                  to="/login"
                  className="mt-6 inline-block text-sm text-violet-400 hover:text-violet-300 transition-colors"
                >
                  ← Back to sign in
                </Link>
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h1 className="text-2xl font-bold mb-1">Reset password</h1>
                <p className="text-zinc-500 text-sm mb-8">
                  Enter your email and we'll send a reset link.
                </p>

                <form onSubmit={handleSubmit} noValidate className="space-y-4">
                  <FloatingInput
                    id="email"
                    label="Email address"
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError('') }}
                    error={error}
                    autoComplete="email"
                  />
                  <Button type="submit" loading={loading} className="w-full">
                    Send Reset Link
                  </Button>
                </form>

                <p className="mt-6 text-center text-sm text-zinc-500">
                  Remember it?{' '}
                  <Link to="/login" className="text-violet-400 hover:text-violet-300 font-medium transition-colors">
                    Sign in
                  </Link>
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
