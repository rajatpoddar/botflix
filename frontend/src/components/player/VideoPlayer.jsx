import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { mediaAPI } from '../../lib/api'

function formatTime(seconds) {
  if (isNaN(seconds)) return '0:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Convert seconds → Jellyfin ticks (10 000 000 ticks/sec) */
function secToTicks(sec) {
  return Math.round(sec * 10_000_000)
}

/** Read audio tracks and text tracks from a <video> element */
function getTracksFromVideo(videoEl) {
  const audio = []
  const subs = []

  if (videoEl.audioTracks) {
    for (let i = 0; i < videoEl.audioTracks.length; i++) {
      const t = videoEl.audioTracks[i]
      audio.push({ id: t.id || String(i), label: t.label || `Audio ${i + 1}`, language: t.language, index: i })
    }
  }

  if (videoEl.textTracks) {
    for (let i = 0; i < videoEl.textTracks.length; i++) {
      const t = videoEl.textTracks[i]
      if (t.kind === 'subtitles' || t.kind === 'captions') {
        subs.push({ id: t.id || String(i), label: t.label || `Subtitle ${i + 1}`, language: t.language, index: i })
      }
    }
  }

  return { audio, subs }
}

export default function VideoPlayer({ src, title, onBack, onDownload, downloading, itemId, initialPosition }) {
  const videoRef = useRef(null)
  const containerRef = useRef(null)
  const controlsTimeout = useRef(null)
  const progressIntervalRef = useRef(null)
  const hasSeekedRef = useRef(false)
  // Tracks the latest playback time so cleanup effects always send the
  // correct position even if the video element is already detached.
  const lastPositionRef = useRef(0)
  // Use refs for values needed in event callbacks to avoid stale closures
  const itemIdRef = useRef(itemId)
  const initialPositionRef = useRef(initialPosition)
  useEffect(() => { itemIdRef.current = itemId }, [itemId])
  useEffect(() => { initialPositionRef.current = initialPosition }, [initialPosition])

  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(true) // start muted so autoplay works
  const [fullscreen, setFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [buffering, setBuffering] = useState(false)
  const [showVolume, setShowVolume] = useState(false)

  // Tracks
  const [audioTracks, setAudioTracks] = useState([])
  const [subTracks, setSubTracks] = useState([])
  const [activeAudio, setActiveAudio] = useState(null)
  const [activeSub, setActiveSub] = useState(null) // null = off
  const [showTrackMenu, setShowTrackMenu] = useState(false) // 'audio' | 'sub' | false

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

  // ── Track switching ───────────────────────────────────────────────────────

  const switchAudio = useCallback((index) => {
    const v = videoRef.current
    if (!v?.audioTracks) return
    for (let i = 0; i < v.audioTracks.length; i++) {
      v.audioTracks[i].enabled = i === index
    }
    setActiveAudio(index)
    setShowTrackMenu(false)
  }, [])

  const switchSub = useCallback((index) => {
    const v = videoRef.current
    if (!v?.textTracks) return
    for (let i = 0; i < v.textTracks.length; i++) {
      v.textTracks[i].mode = i === index ? 'showing' : 'hidden'
    }
    setActiveSub(index)
    setShowTrackMenu(false)
  }, [])

  const disableSubs = useCallback(() => {
    const v = videoRef.current
    if (!v?.textTracks) return
    for (let i = 0; i < v.textTracks.length; i++) {
      v.textTracks[i].mode = 'hidden'
    }
    setActiveSub(null)
    setShowTrackMenu(false)
  }, [])

  // ── Helper: send playback progress ─────────────────────────────────────
  // Uses refs so this is safe to call from any event listener without stale closures
  const sendProgress = useCallback(async (isPaused) => {
    const id = itemIdRef.current
    if (!id) return
    const v = videoRef.current
    if (!v) return
    try {
      await mediaAPI.reportPlaybackProgress({
        itemId: id,
        positionTicks: secToTicks(v.currentTime),
        isPaused,
      })
    } catch {
      // silent — don't break playback for reporting
    }
  }, []) // no deps needed — reads from refs

  // ── Seek to resume position once metadata is loaded ────────────────────
  const handleLoadedMetadata = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    const { audio, subs } = getTracksFromVideo(v)
    setAudioTracks(audio)
    setSubTracks(subs)
    if (audio.length > 0) {
      const enabled = audio.findIndex((_, i) => v.audioTracks[i]?.enabled)
      setActiveAudio(enabled >= 0 ? enabled : 0)
    }
    for (let i = 0; i < v.textTracks.length; i++) {
      v.textTracks[i].mode = 'hidden'
    }

    // Seek to resume position — use ref so we always have the latest value
    const pos = initialPositionRef.current
    if (pos > 0 && !hasSeekedRef.current) {
      v.currentTime = pos
      hasSeekedRef.current = true
    }
  }, []) // no deps — reads from refs

  // ── Periodic progress report (every 15 seconds while playing) ──────────
  useEffect(() => {
    if (!itemId) return
    if (playing) {
      progressIntervalRef.current = setInterval(() => {
        sendProgress(false)
      }, 15_000)
    }
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
    }
  }, [playing, itemId, sendProgress])

  // ── Report stop on unmount ─────────────────────────────────────────────
  useEffect(() => {
    return () => {
      const id = itemIdRef.current
      if (!id) return
      // Use lastPositionRef so we always have the most recent playback
      // position, even if the video element is detached by the time this
      // cleanup runs (e.g. React StrictMode double-mount, quick navigation).
      const pos = secToTicks(lastPositionRef.current)
      if (pos <= 0) return
      mediaAPI.reportPlaybackStopped({
        itemId: id,
        positionTicks: pos,
      }).catch(() => {})
    }
  }, []) // run only on unmount — reads id from ref

  // ── Event listeners ───────────────────────────────────────────────────

  useEffect(() => {
    const v = videoRef.current
    if (!v) return

    function onPlay() {
      setPlaying(true)
    }

    function onPause() {
      setPlaying(false)
      sendProgress(true)
    }

    const handlers = {
      play: onPlay,
      pause: onPause,
      timeupdate: () => {
        setCurrentTime(v.currentTime)
        lastPositionRef.current = v.currentTime
      },
      durationchange: () => setDuration(v.duration),
      waiting: () => setBuffering(true),
      canplay: () => { setBuffering(false); handleLoadedMetadata() },
      loadedmetadata: handleLoadedMetadata,
    }

    Object.entries(handlers).forEach(([ev, fn]) => v.addEventListener(ev, fn))
    const fsc = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', fsc)

    return () => {
      Object.entries(handlers).forEach(([ev, fn]) => v.removeEventListener(ev, fn))
      document.removeEventListener('fullscreenchange', fsc)
    }
  }, [sendProgress, handleLoadedMetadata]) // stable callbacks — safe dep array

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
  const hasAudioChoice = audioTracks.length > 1
  const hasSubChoice = subTracks.length > 0

  return (
    <div
      ref={containerRef}
      className="relative bg-black w-full h-full select-none"
      onMouseMove={resetControlsTimer}
      onMouseLeave={() => { playing && setShowControls(false); setShowTrackMenu(false) }}
      style={{ cursor: showControls ? 'default' : 'none' }}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-contain"
        onClick={togglePlay}
        playsInline
        autoPlay
        muted={muted}
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
              {title && <h2 className="text-white font-semibold text-sm flex-1">{title}</h2>}
              {onDownload && (
                <button
                  onClick={onDownload}
                  disabled={downloading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Download"
                >
                  {downloading ? (
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  )}
                  {downloading ? 'Starting…' : 'Download'}
                </button>
              )}
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
                <div className="flex items-center gap-1">
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

                  {/* Rewind 10s */}
                  <button
                    onClick={() => videoRef.current && (videoRef.current.currentTime -= 10)}
                    className="p-2 text-white hover:text-zinc-300 transition-colors"
                    aria-label="Rewind 10s"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="1 4 1 10 7 10" />
                      <path d="M3.51 15a9 9 0 1 0 .49-4.5" />
                      <text x="8.5" y="14.5" fontSize="5.5" fill="currentColor" stroke="none" fontWeight="bold">-10</text>
                    </svg>
                  </button>

                  {/* Forward 10s */}
                  <button
                    onClick={() => videoRef.current && (videoRef.current.currentTime += 10)}
                    className="p-2 text-white hover:text-zinc-300 transition-colors"
                    aria-label="Forward 10s"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 4 23 10 17 10" />
                      <path d="M20.49 15a9 9 0 1 1-.49-4.5" />
                      <text x="8.5" y="14.5" fontSize="5.5" fill="currentColor" stroke="none" fontWeight="bold">+10</text>
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
                  <span className="text-white text-xs font-mono ml-1">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>

                {/* Right side controls */}
                <div className="flex items-center gap-1">

                  {/* Audio track button */}
                  {hasAudioChoice && (
                    <div className="relative">
                      <button
                        onClick={() => setShowTrackMenu(showTrackMenu === 'audio' ? false : 'audio')}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          showTrackMenu === 'audio' ? 'bg-violet-600 text-white' : 'bg-white/10 hover:bg-white/20 text-white'
                        }`}
                        aria-label="Audio track"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                        Audio
                      </button>
                      <AnimatePresence>
                        {showTrackMenu === 'audio' && (
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 8 }}
                            className="absolute bottom-full right-0 mb-2 min-w-[160px] bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden shadow-2xl"
                          >
                            <p className="text-xs text-zinc-500 px-3 pt-2.5 pb-1 font-medium uppercase tracking-wide">Audio</p>
                            {audioTracks.map((t) => (
                              <button
                                key={t.id}
                                onClick={() => switchAudio(t.index)}
                                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                                  activeAudio === t.index ? 'text-violet-400 bg-violet-500/10' : 'text-white hover:bg-zinc-800'
                                }`}
                              >
                                {activeAudio === t.index && (
                                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                                  </svg>
                                )}
                                <span className={activeAudio === t.index ? '' : 'ml-5'}>
                                  {t.label}{t.language ? ` (${t.language})` : ''}
                                </span>
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Subtitle track button */}
                  {hasSubChoice && (
                    <div className="relative">
                      <button
                        onClick={() => setShowTrackMenu(showTrackMenu === 'sub' ? false : 'sub')}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          showTrackMenu === 'sub' ? 'bg-violet-600 text-white' : 'bg-white/10 hover:bg-white/20 text-white'
                        }`}
                        aria-label="Subtitles"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                        </svg>
                        CC
                      </button>
                      <AnimatePresence>
                        {showTrackMenu === 'sub' && (
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 8 }}
                            className="absolute bottom-full right-0 mb-2 min-w-[160px] bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden shadow-2xl"
                          >
                            <p className="text-xs text-zinc-500 px-3 pt-2.5 pb-1 font-medium uppercase tracking-wide">Subtitles</p>
                            {/* Off option */}
                            <button
                              onClick={disableSubs}
                              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                                activeSub === null ? 'text-violet-400 bg-violet-500/10' : 'text-white hover:bg-zinc-800'
                              }`}
                            >
                              {activeSub === null && (
                                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                                </svg>
                              )}
                              <span className={activeSub === null ? '' : 'ml-5'}>Off</span>
                            </button>
                            {subTracks.map((t) => (
                              <button
                                key={t.id}
                                onClick={() => switchSub(t.index)}
                                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                                  activeSub === t.index ? 'text-violet-400 bg-violet-500/10' : 'text-white hover:bg-zinc-800'
                                }`}
                              >
                                {activeSub === t.index && (
                                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                                  </svg>
                                )}
                                <span className={activeSub === t.index ? '' : 'ml-5'}>
                                  {t.label}{t.language ? ` (${t.language})` : ''}
                                </span>
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
