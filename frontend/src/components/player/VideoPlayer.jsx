import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

function formatTime(seconds) {
  if (isNaN(seconds)) return '0:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function VideoPlayer({ src, title, onBack }) {
  const videoRef = useRef(null)
  const containerRef = useRef(null)
  const controlsTimeout = useRef(null)

  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [buffering, setBuffering] = useState(false)
  const [showVolume, setShowVolume] = useState(false)

  // ── Playback ──────────────────────────────────────────────────────────────

  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    playing ? v.pause() : v.play()
  }, [playing])

  const seek = useCallback((e) => {
    const v = videoRef.current
    if (!v || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    v.currentTime = ratio * duration
  }, [duration])

  const handleVolumeChange = useCallback((e) => {
    const v = videoRef.current
    const val = parseFloat(e.target.value)
    if (v) v.volume = val
    setVolume(val)
    setMuted(val === 0)
  }, [])

  const toggleMute = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
  }, [])

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      el.requestFullscreen?.()
    } else {
      document.exitFullscreen?.()
    }
  }, [])

  // ── Event listeners ───────────────────────────────────────────────────────

  useEffect(() => {
    const v = videoRef.current
    if (!v) return

    const handlers = {
      play: () => setPlaying(true),
      pause: () => setPlaying(false),
      timeupdate: () => setCurrentTime(v.currentTime),
      durationchange: () => setDuration(v.duration),
      waiting: () => setBuffering(true),
      canplay: () => setBuffering(false),
    }

    Object.entries(handlers).forEach(([ev, fn]) => v.addEventListener(ev, fn))
    const fsc = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', fsc)

    return () => {
      Object.entries(handlers).forEach(([ev, fn]) => v.removeEventListener(ev, fn))
      document.removeEventListener('fullscreenchange', fsc)
    }
  }, [])

  // Auto-hide controls
  function resetControlsTimer() {
    setShowControls(true)
    clearTimeout(controlsTimeout.current)
    controlsTimeout.current = setTimeout(() => {
      if (playing) setShowControls(false)
    }, 3000)
  }

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e) {
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault()
          togglePlay()
          break
        case 'ArrowRight':
          videoRef.current && (videoRef.current.currentTime += 10)
          break
        case 'ArrowLeft':
          videoRef.current && (videoRef.current.currentTime -= 10)
          break
        case 'm':
          toggleMute()
          break
        case 'f':
          toggleFullscreen()
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePlay, toggleMute, toggleFullscreen])

  const progress = duration ? (currentTime / duration) * 100 : 0

  return (
    <div
      ref={containerRef}
      className="relative bg-black w-full h-full select-none"
      onMouseMove={resetControlsTimer}
      onMouseLeave={() => playing && setShowControls(false)}
      style={{ cursor: showControls ? 'default' : 'none' }}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-contain"
        onClick={togglePlay}
        playsInline
      />

      {/* Buffering spinner */}
      <AnimatePresence>
        {buffering && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <svg className="animate-spin w-14 h-14 text-white/80" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls overlay */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 flex flex-col justify-between"
          >
            {/* Top bar */}
            <div className="bg-gradient-to-b from-black/70 to-transparent px-4 py-4 flex items-center gap-4">
              {onBack && (
                <button onClick={onBack} className="p-2 text-white hover:text-zinc-300 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              {title && <h2 className="text-white font-semibold text-sm">{title}</h2>}
            </div>

            {/* Bottom bar */}
            <div className="bg-gradient-to-t from-black/80 to-transparent px-4 pb-4 pt-10">
              {/* Progress bar */}
              <div
                className="w-full h-1.5 bg-white/20 rounded-full cursor-pointer mb-4 group/progress relative"
                onClick={seek}
              >
                <div
                  className="h-full bg-violet-500 rounded-full relative"
                  style={{ width: `${progress}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white
                    opacity-0 group-hover/progress:opacity-100 transition-opacity" />
                </div>
              </div>

              {/* Buttons row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Play/Pause */}
                  <button
                    onClick={togglePlay}
                    className="p-2 text-white hover:text-zinc-300 transition-colors"
                    aria-label={playing ? 'Pause' : 'Play'}
                  >
                    {playing ? (
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                        <rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </button>

                  {/* Skip ±10s */}
                  <button
                    onClick={() => videoRef.current && (videoRef.current.currentTime -= 10)}
                    className="p-2 text-white hover:text-zinc-300 transition-colors"
                    aria-label="Rewind 10s"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12.5 3a9.5 9.5 0 100 19 9.5 9.5 0 000-19zM2 12.5C2 6.701 6.701 2 12.5 2S23 6.701 23 12.5 18.299 23 12.5 23 2 18.299 2 12.5z"/>
                      <path d="M12.5 7v5.5l3.5 2-1 1.73L11 14V7h1.5z"/>
                      <text x="6" y="16" fontSize="5" fill="currentColor" fontWeight="bold">-10</text>
                    </svg>
                  </button>
                  <button
                    onClick={() => videoRef.current && (videoRef.current.currentTime += 10)}
                    className="p-2 text-white hover:text-zinc-300 transition-colors"
                    aria-label="Forward 10s"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                  </button>

                  {/* Volume */}
                  <div
                    className="relative flex items-center gap-2"
                    onMouseEnter={() => setShowVolume(true)}
                    onMouseLeave={() => setShowVolume(false)}
                  >
                    <button onClick={toggleMute} className="p-2 text-white hover:text-zinc-300 transition-colors">
                      {muted || volume === 0 ? (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M15.536 8.464a5 5 0 010 7.072M12 6v12m-3.536-9.536a5 5 0 000 7.072M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        </svg>
                      )}
                    </button>
                    <AnimatePresence>
                      {showVolume && (
                        <motion.input
                          initial={{ width: 0, opacity: 0 }}
                          animate={{ width: 80, opacity: 1 }}
                          exit={{ width: 0, opacity: 0 }}
                          type="range" min="0" max="1" step="0.05"
                          value={muted ? 0 : volume}
                          onChange={handleVolumeChange}
                          className="accent-violet-500 cursor-pointer"
                          style={{ width: 80 }}
                        />
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Time */}
                  <span className="text-white text-xs font-mono">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>

                {/* Fullscreen */}
                <button
                  onClick={toggleFullscreen}
                  className="p-2 text-white hover:text-zinc-300 transition-colors"
                  aria-label="Toggle fullscreen"
                >
                  {fullscreen ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 9V5H5m0 0v4m0-4l4 4M15 9h4V5m0 0h-4m4 0l-4 4M9 15H5v4m0 0v-4m0 4l4-4M15 15l4 4m0 0v-4m0 4h-4" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
