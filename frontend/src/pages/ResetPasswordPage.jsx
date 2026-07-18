import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import FloatingInput from '../components/ui/FloatingInput'
import Button from '../components/ui/Button'
import PosterCollage from '../components/media/PosterCollage'
import { authAPI, mediaAPI } from '../lib/api'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')

  const [form, setForm] = useState({ password: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [collageItems, setCollageItems] = useState([])

  useEffect(() => {
    mediaAPI.getLandingData()
      .then((res) => setCollageItems(res.data?.collage || []))
      .catch(() => {})
  }, [])

  // If no token in URL, show an error state
  const invalidToken = !token

  function set(field) {
    return (e) => {
      setForm((f) => ({ ...f, [field]: e.target.value }))
      setErrors((err) => ({ ...err, [field]: '' }))
    }
  }

  function validate() {
    const errs = {}
    if (!form.password) errs.password = 'Required'
    else if (form.password.length < 8) errs.password = 'At least 8 characters'
    if (form.password !== form.confirm) errs.confirm = 'Passwords do not match'
    return errs
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (invalidToken) return

    const errs = validate()
    if (Object.keys(errs).length) return setErrors(errs)

    setLoading(true)
    setServerError('')
    try {
      await authAPI.resetPassword(token, form.password)
      setSuccess(true)
      setTimeout(() => navigate('/login'), 2500)
    } catch (err) {
      setServerError(
        err.response?.data?.detail || 'Reset failed. The link may have expired.'
      )
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
          <div className="absolute top-1/3 left-1/3 w-96 h-96 bg-violet-900/15 rounded-full blur-3xl" />
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
          {success ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-4"
            >
              <div className="w-14 h-14 rounded-full bg-green-900/50 border border-green-700 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold mb-2">Password Reset! 🔐</h2>
              <p className="text-zinc-400 text-sm">
                Your password has been updated. Redirecting to sign in…
              </p>
            </motion.div>
          ) : invalidToken ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-4"
            >
              <div className="w-14 h-14 rounded-full bg-red-900/50 border border-red-700 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-xl font-bold mb-2">Invalid Link</h2>
              <p className="text-zinc-400 text-sm mb-6">
                This password reset link is missing or invalid. Please request a new one.
              </p>
              <Link
                to="/forgot-password"
                className="inline-block bg-violet-600 hover:bg-violet-500 text-white font-semibold px-6 py-3 rounded-xl text-sm transition-all"
              >
                Request New Link
              </Link>
            </motion.div>
          ) : (
            <>
              <h1 className="text-2xl font-bold mb-1">Set new password</h1>
              <p className="text-zinc-500 text-sm mb-8">
                Choose a strong password for your account.
              </p>

              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <FloatingInput
                  id="password"
                  label="New password"
                  type="password"
                  value={form.password}
                  onChange={set('password')}
                  error={errors.password}
                  autoComplete="new-password"
                />
                <FloatingInput
                  id="confirm"
                  label="Confirm password"
                  type="password"
                  value={form.confirm}
                  onChange={set('confirm')}
                  error={errors.confirm}
                  autoComplete="new-password"
                />

                {serverError && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-md px-3 py-2"
                  >
                    {serverError}
                  </motion.p>
                )}

                <Button type="submit" loading={loading} className="w-full mt-2">
                  Reset Password
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-zinc-500">
                Remember your password?{' '}
                <Link to="/login" className="text-violet-400 hover:text-violet-300 font-medium transition-colors">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}
