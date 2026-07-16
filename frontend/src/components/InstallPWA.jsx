import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * PWA Install Prompt Component
 *
 * Shows:
 * 1. An install button when the beforeinstallprompt event fires (Chrome/Edge/etc.)
 * 2. A dismissible banner guiding iOS users to "Add to Home Screen"
 * 3. A toast when a new service worker is waiting to update
 */
export default function InstallPWA() {
  const [installPrompt, setInstallPrompt] = useState(null)
  const [showInstallBtn, setShowInstallBtn] = useState(false)
  const [showIOSHint, setShowIOSHint] = useState(false)
  const [dismissedIOS, setDismissedIOS] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    // Detect iOS Safari/iOS WebView
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    // Only show iOS hint if not in standalone mode and not dismissed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    if (isIOS && !isStandalone && !localStorage.getItem('pwa_ios_dismissed')) {
      setShowIOSHint(true)
    }

    // Listen for the install prompt event (Chrome/Edge/Android)
    function handleBeforeInstallPrompt(e) {
      e.preventDefault()
      setInstallPrompt(e)
      setShowInstallBtn(true)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // Listen for app installed event
    window.addEventListener('appinstalled', () => {
      setShowInstallBtn(false)
      setShowIOSHint(false)
    })

    // Listen for service worker updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        setUpdateAvailable(false)
      })
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  // Check for waiting service worker (update available)
  useEffect(() => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed') {
                setUpdateAvailable(true)
              }
            })
          }
        })
      })
    }
  }, [])

  async function handleInstall() {
    if (!installPrompt) return
    installPrompt.prompt()
    const result = await installPrompt.userChoice
    if (result.outcome === 'accepted') {
      setShowInstallBtn(false)
    }
    setInstallPrompt(null)
  }

  function dismissIOS() {
    setShowIOSHint(false)
    setDismissedIOS(true)
    localStorage.setItem('pwa_ios_dismissed', 'true')
  }

  function handleUpdate() {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' })
    }
    window.location.reload()
  }

  return (
    <>
      {/* Install button (non-iOS) */}
      <AnimatePresence>
        {showInstallBtn && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={handleInstall}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-colors"
            aria-label="Install app"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4m-8 8h8" />
            </svg>
            Install App
          </motion.button>
        )}
      </AnimatePresence>

      {/* iOS hint banner (bottom) */}
      <AnimatePresence>
        {showIOSHint && !dismissedIOS && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-4 left-4 right-4 z-[60] max-w-sm mx-auto bg-zinc-900 border border-zinc-700 rounded-xl p-4 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-600/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">Install StreamX</p>
                <p className="text-xs text-zinc-400 mt-1">
                  Tap the <span className="inline-flex items-center gap-0.5">
                    <svg className="w-3.5 h-3.5 inline" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11H9v-2H7v-2h2V7h2v2h2v2h-2v2z" />
                    </svg>
                  </span> Share button, then <strong>Add to Home Screen</strong>
                </p>
              </div>
              <button
                onClick={dismissIOS}
                className="p-1 rounded-full hover:bg-zinc-800 transition-colors flex-shrink-0"
                aria-label="Dismiss"
              >
                <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Update available toast */}
      <AnimatePresence>
        {updateAvailable && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-4 right-4 z-[60] bg-zinc-900 border border-zinc-700 rounded-xl p-4 shadow-2xl max-w-xs"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-600/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">Update Available</p>
                <p className="text-xs text-zinc-400 mt-0.5">A new version is ready</p>
              </div>
              <button
                onClick={handleUpdate}
                className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-colors"
              >
                Update
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
