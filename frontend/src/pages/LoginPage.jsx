import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import FloatingInput from '../components/ui/FloatingInput'
import Button from '../components/ui/Button'
import PosterCollage from '../components/media/PosterCollage'
import { useAuth } from '../contexts/AuthContext'
import { mediaAPI } from '../lib/api'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

export default function LoginPage() {
  const { login, googleLogin } = useAuth()
  const [form, setForm] = useState({ username: '', password: '' })
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [collageItems, setCollageItems] = useState([])
  const googleBtnRef = useRef(null)
  const gisInitialized = useRef(false)
  const googleLoadingRef = useRef(false)

  useEffect(() => {
    mediaAPI.getLandingData()
      .then((res) => setCollageItems(res.data?.collage || []))
      .catch(() => {})
  }, [])

  // Initialize Google Sign-In
  const handleGoogleCredential = useCallback(async (response) => {
    if (googleLoadingRef.current) return
    googleLoadingRef.current = true
    setGoogleLoading(true)
    setServerError('')
    try {
      await googleLogin(response.credential)
    } catch (err) {
      setServerError(err.response?.data?.detail || 'Google sign-in failed. Please try again.')
    } finally {
      googleLoadingRef.current = false
      setGoogleLoading(false)
    }
  }, [googleLogin])

  useEffect(() => {
    if (gisInitialized.current || !GOOGLE_CLIENT_ID || !window.google?.accounts?.id) return
    gisInitialized.current = true

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredential,
      cancel_on_tap_outside: false,
    })

    if (googleBtnRef.current) {
      window.google.accounts.id.renderButton(
        googleBtnRef.current,
        {
          theme: 'outline',
          size: 'large',
          shape: 'rectangular',
          logo_alignment: 'center',
          text: 'signin_with',
        }
      )
    }
  }, [handleGoogleCredential])

  function set(field) {
    return (e) => {
      setForm((f) => ({ ...f, [field]: e.target.value }))
      setErrors((err) => ({ ...err, [field]: '' }))
    }
  }

  function validate() {
    const errs = {}
    if (!form.username.trim()) errs.username = 'Required'
    if (!form.password) errs.password = 'Required'
    return errs
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) return setErrors(errs)

    setLoading(true)
    setServerError('')
    try {
      await login(form)
    } catch (err) {
      setServerError(err.response?.data?.detail || 'Login failed. Please try again.')
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
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-violet-900/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-violet-800/10 rounded-full blur-3xl" />
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Logo */}
        <div className="mb-8 text-center">
          <span className="text-3xl font-black tracking-tight text-white inline-flex items-center">
            <img src="/logo.png" alt="StreamX" className="w-7 h-7 mr-1.5 -mt-0.5" />
            STREAM<span className="text-violet-500">X</span>
          </span>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-xl p-8 shadow-2xl">
          <h1 className="text-2xl font-bold mb-1">Welcome back</h1>
          <p className="text-zinc-500 text-sm mb-8">Sign in to your account</p>

          {/* Google Sign-In */}
          <div className="relative mb-6">
            <div ref={googleBtnRef} className="flex justify-center" />
            {googleLoading && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-center gap-2 mt-2"
              >
                <svg className="animate-spin w-4 h-4 text-violet-400" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span className="text-xs text-zinc-400">Connecting to Google…</span>
              </motion.div>
            )}
          </div>

          {!GOOGLE_CLIENT_ID && (
            <p className="text-xs text-center text-zinc-600 mb-6">
              Google Sign-In not configured.
            </p>
          )}

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-zinc-800" />
            <span className="text-xs text-zinc-600 font-medium">OR</span>
            <div className="flex-1 h-px bg-zinc-800" />
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <FloatingInput
              id="username"
              label="Username or email"
              value={form.username}
              onChange={set('username')}
              error={errors.username}
              autoComplete="username"
            />
            <FloatingInput
              id="password"
              label="Password"
              type="password"
              value={form.password}
              onChange={set('password')}
              error={errors.password}
              autoComplete="current-password"
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

            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            <Button type="submit" loading={loading} className="w-full mt-2">
              Sign In
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-zinc-500">
            New here?{' '}
            <Link to="/signup" className="text-violet-400 hover:text-violet-300 font-medium transition-colors">
              Create an account
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
