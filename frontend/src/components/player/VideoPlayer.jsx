import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Hls from 'hls.js'
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

/** Check if the user is on a mobile/touch device */
function isMobile() {
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 0 && window.innerWidth < 1024)
}

/** Check if the device is iOS (iPhone/iPad/iPod) — needs special fullscreen handling */
function isIOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
}

/** Clamp a value between min and max */
function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val))
}

export default function VideoPlayer({
  src,
  title,
  onBack,
  onDownload,
  downloading,
  itemId,
  initialPosition,
  durationFromMeta,
  audioTracks = [],
  subtitleTracks = [],
  activeAudioIndex = 0,
  onSwitchAudio,
}) {
  const videoRef = useRef(null)
  const videoWrapperRef = useRef(null)
  const containerRef = useRef(null)
  const controlsTimeout = useRef(null)
  const progressIntervalRef = useRef(null)
  const hasSeekedRef = useRef(false)
  const lastPositionRef = useRef(0)
  const itemIdRef = useRef(itemId)
  const initialPositionRef = useRef(initialPosition)
  const srcRef = useRef(src)
  // Track audio switching state
  const switchingAudioRef = useRef(false)
  const pendingPositionRef = useRef(null)
  const pendingPlayRef = useRef(false)
  // Track auto-fullscreen to avoid loops
  const autoFullscreenDoneRef = useRef(false)
  // Track whether a touch gesture just happened (to prevent unwanted play/pause)
  const wasGestureRef = useRef(false)
  // Ref for playing state — avoids re-attaching event listeners on play/pause
  const playingRef = useRef(false)
  const gestureClearTimerRef = useRef(null)
  // Holds the active hls.js instance (null when using native HLS)
  const hlsRef = useRef(null)

  useEffect(() => { itemIdRef.current = itemId }, [itemId])
  useEffect(() => { initialPositionRef.current = initialPosition }, [initialPosition])
  useEffect(() => { srcRef.current = src }, [src])

  // ── Attach HLS (or native) source ──────────────────────────────────────────
  // HLS lets seeking/resume jump to a segment instead of restarting a
  // progressive transcode. hls.js drives Chrome/Firefox/Edge over MSE; Safari
  // and iOS play the manifest natively.
  useEffect(() => {
    const v = videoRef.current
    if (!v || !src) return

    // Resume position: audio-switch pending pos takes priority, else the
    // initial resume position from metadata.
    const startPos = switchingAudioRef.current
      ? (pendingPositionRef.current || 0)
      : (initialPositionRef.current || 0)

    const isHls = /\.m3u8(\?|$)/i.test(src)
    const canPlayNativeHls = v.canPlayType('application/vnd.apple.mpegurl')

    // Native HLS (Safari / iOS) or a plain progressive source
    if (!isHls || canPlayNativeHls || !Hls.isSupported()) {
      v.src = src
      return
    }

    const hls = new Hls({
      startPosition: startPos > 0 ? startPos : -1,
      enableWorker: true,
      maxBufferLength: 30,
    })
    hlsRef.current = hls
    hls.loadSource(src)
    hls.attachMedia(v)

    hls.on(Hls.Events.ERROR, (_evt, data) => {
      if (!data.fatal) return
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad()
      else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError()
      else hls.destroy()
    })

    return () => {
      hls.destroy()
      if (hlsRef.current === hls) hlsRef.current = null
    }
  }, [src])

  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(true) // start muted so autoplay works
  const [fullscreen, setFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [buffering, setBuffering] = useState(false)
  const [showVolume, setShowVolume] = useState(false)
  const [showStartScreen, setShowStartScreen] = useState(true) // Hides the initial flash on mobile

  // Brightness state (1.0 = normal, ranges 0.3–1.5)
  const [brightness, setBrightness] = useState(1.0)
  // Use RunTimeTicks fallback for duration when browser reports Infinity
  const durationFromMetaRef = useRef(durationFromMeta)
  useEffect(() => { durationFromMetaRef.current = durationFromMeta }, [durationFromMeta])

  // Compute effective duration early — used by seek callback and render.
  // Prefer browser-reported duration; fall back to metadata (RunTimeTicks).
  const effectiveDuration = (duration && isFinite(duration) && duration > 0)
    ? duration
    : (durationFromMetaRef.current || 0)

  // Touch gesture state
  const touchStartRef = useRef(null)
  const [gestureIndicator, setGestureIndicator] = useState(null) // { type: 'brightness'|'volume'|'seek', value: number }
  const gestureIndicatorTimeout = useRef(null)
  // Seek gesture state
  const seekGestureRef = useRef(null) // { startCurrentTime, startClientX }

  // Tracks — audio & subtitles from props
  const [activeSub, setActiveSub] = useState(null) // null = off
  const [showTrackMenu, setShowTrackMenu] = useState(false) // 'audio' | 'sub' | false

  const mobile = isMobile()

  // ── Playback ──────────────────────────────────────────────────────────────

  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    playing ? v.pause() : v.play()
  }, [playing])

  const seek = useCallback((e) => {
    e.stopPropagation()
    const v = videoRef.current
    const dur = effectiveDuration
    if (!v || !dur) return
    const rect = e.currentTarget.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const ratio = (clientX - rect.left) / rect.width
    v.currentTime = ratio * dur
  }, [effectiveDuration])

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
    const v = videoRef.current
    const el = containerRef.current
    if (!el || !v) return

    // iOS Safari doesn't support the standard Fullscreen API.
    // Use webkitEnterFullscreen on the <video> element instead.
    if (isIOS()) {
      if (v.webkitEnterFullscreen) {
        v.webkitEnterFullscreen()
      }
      return
    }

    if (!document.fullscreenElement) {
      el.requestFullscreen?.()
    } else {
      document.exitFullscreen?.()
    }
  }, [])

  // ── Auto-fullscreen on mobile ─────────────────────────────────────────────

  const enterFullscreen = useCallback(async () => {
    const v = videoRef.current
    const el = containerRef.current
    if (!el || !v) return

    // iOS: use webkitEnterFullscreen on the video element
    if (isIOS()) {
      if (v.webkitEnterFullscreen) {
        v.webkitEnterFullscreen()
      }
      return
    }

    try {
      await el.requestFullscreen?.()
      // Try to lock to landscape on mobile
      if (screen.orientation?.lock) {
        screen.orientation.lock('landscape').catch(() => {})
      }
    } catch {
      // Browser may block fullscreen — that's ok
    }
  }, [])

  // ── Brightness / Dim overlay ─────────────────────────────────────────────
  //
  // The phone's *system* brightness can't be changed from a web browser —
  // no standard API exists on iOS or Android for that.
  // We simulate dimming with two complementary effects:
  //   1) CSS filter (brightness) on the video wrapper — makes the video
  //      appear dimmer/brighter.
  //   2) A dark overlay (<div> with variable opacity) on top of the video
  //      — gives a convincing "screen dimming" feel even when the system
  //      brightness stays fixed.
  //
  // brightness range: 0.3 (most dim) … 1.0 (normal) … 1.5 (brightened)
  const BRIGHTNESS_MIN = 0.3
  const BRIGHTNESS_MAX = 1.5
  const BRIGHTNESS_DEFAULT = 1.0

  const changeBrightness = useCallback((delta) => {
    setBrightness((prev) => {
      const newVal = clamp(prev + delta, BRIGHTNESS_MIN, BRIGHTNESS_MAX)
      return newVal
    })
  }, [])

  // Overlay opacity: 0 when brightness >= 1.0, ramps up to ~0.6 at min.
  // This creates a smooth dimming effect that complements the CSS filter.
  const dimOpacity = brightness < 1
    ? (1 - brightness) / (1 - BRIGHTNESS_MIN) * 0.6
    : 0

  // ── Touch Gestures (mobile brightness/volume) ─────────────────────────────
  //
  // Volume: adjusts HTMLMediaElement.volume (works on Android). On iOS the
  // volume property is read-only — there's no workaround (AudioContext gain
  // nodes are unreliable with HLS on iOS). The gesture indicator still shows
  // the intended level as visual feedback.
  //
  // Brightness: simulated via CSS filter + dark overlay (see above). System
  // brightness cannot be changed from a web browser on any mobile platform.

  const showGestureIndicator = useCallback((type, value) => {
    setGestureIndicator({ type, value })
    clearTimeout(gestureIndicatorTimeout.current)
    gestureIndicatorTimeout.current = setTimeout(() => {
      setGestureIndicator(null)
    }, 1500)
  }, [])

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length !== 1) return
    const touch = e.touches[0]
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      startVolume: volume,
      startBrightness: brightness,
      time: Date.now(),
    }
    // Initialize seek gesture tracking
    const v = videoRef.current
    seekGestureRef.current = {
      startCurrentTime: v ? v.currentTime : 0,
      startClientX: touch.clientX,
      lastClientX: touch.clientX,
    }
  }, [volume, brightness])

  const handleTouchMove = useCallback((e) => {
    if (!touchStartRef.current || e.touches.length !== 1) return
    const touch = e.touches[0]
    const { x: startX, y: startY, startVolume, startBrightness } = touchStartRef.current
    const deltaY = startY - touch.clientY
    const deltaX = touch.clientX - startX
    const absDeltaX = Math.abs(deltaX)
    const absDeltaY = Math.abs(deltaY)

    // Ignore very small movements
    if (absDeltaY < 10 && absDeltaX < 10) return

    // Mark that a gesture is in progress (to prevent click-to-play after swipe)
    wasGestureRef.current = true

    // Determine which side of the screen we're on
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const isLeftSide = startX < rect.width / 2

    // ── Horizontal swipe → seek ────────────────────────────────────────
    if (absDeltaX > absDeltaY * 1.5 && seekGestureRef.current) {
      const v = videoRef.current
      if (!v) return
      const dur = duration || durationFromMetaRef.current || 0
      // Pixels-to-seconds mapping: full screen width = 60 seconds
      const seekDelta = (deltaX / rect.width) * 60
      const newTime = clamp(
        seekGestureRef.current.startCurrentTime + seekDelta,
        0,
        dur || Infinity,
      )
      // Live-update the video position for visual feedback
      v.currentTime = newTime
      seekGestureRef.current.lastClientX = touch.clientX
      // Show seek indicator
      const diff = newTime - seekGestureRef.current.startCurrentTime
      const sign = diff >= 0 ? '+' : ''
      const seekSec = Math.abs(Math.round(diff))
      showGestureIndicator('seek', `${sign}${seekSec}s → ${formatTime(newTime)}`)
      return
    }

    // ── Vertical swipe → brightness / volume ───────────────────────────
    if (isLeftSide) {
      // Left side: brightness control (simulated via CSS filter + dark overlay)
      const deltaBrightness = (deltaY / rect.height) * 1.5
      const newBrightness = clamp(startBrightness + deltaBrightness, BRIGHTNESS_MIN, BRIGHTNESS_MAX)
      setBrightness(newBrightness)
      showGestureIndicator('brightness', newBrightness)
    } else {
      // Right side: volume control
      // HTMLMediaElement.volume works on Android; iOS Safari ignores it
      const v = videoRef.current
      if (!v) return
      const deltaVolume = (deltaY / rect.height) * 1.5
      const newVolume = clamp(startVolume + deltaVolume, 0, 1)
      try {
        v.volume = newVolume
      } catch {
        // iOS may throw when setting read-only volume — safe to ignore
      }
      v.muted = newVolume === 0
      setVolume(newVolume)
      setMuted(newVolume === 0)
      showGestureIndicator('volume', newVolume)
    }
  }, [duration, showGestureIndicator])

  const handleTouchEnd = useCallback(() => {
    touchStartRef.current = null
    seekGestureRef.current = null
    // Keep wasGestureRef true for a short while so click handler can skip
    clearTimeout(gestureClearTimerRef.current)
    gestureClearTimerRef.current = setTimeout(() => {
      wasGestureRef.current = false
    }, 300)
  }, [])

  // ── Audio track switching ────────────────────────────────────────────────

  const switchAudio = useCallback(async (index) => {
    if (!onSwitchAudio || !videoRef.current) return
    const currentPos = videoRef.current.currentTime
    const wasPlaying = !videoRef.current.paused

    switchingAudioRef.current = true
    setShowTrackMenu(false)

    const newUrl = await onSwitchAudio(index, currentPos)
    if (!newUrl) {
      switchingAudioRef.current = false
      return
    }

    pendingPositionRef.current = currentPos
    pendingPlayRef.current = wasPlaying
  }, [onSwitchAudio])

  // ── Subtitle track switching (fetch + blob URL + <track>) ──────────────
  //
  // Strategy: manually fetch VTT via our proxy so we control the network
  // request, then create a local blob URL and attach it via a dynamically
  // created <track> element. This works because:
  //   1) hls.js only overrides tracks from the HLS *manifest* — it won't
  //      touch a track we added after init via appendChild.
  //   2) The blob URL avoids any CORS/content-type issues.
  //   3) <track> elements render correctly with MSE (unlike addTextTrack).
  //
  const subtitleTrackElRef = useRef(null)
  const subtitleBlobUrlRef = useRef(null)

  // Helper: revoke the old blob URL & remove the old track element
  function cleanupSubtitleTrack() {
    if (subtitleTrackElRef.current) {
      subtitleTrackElRef.current.remove()
      subtitleTrackElRef.current = null
    }
    if (subtitleBlobUrlRef.current) {
      URL.revokeObjectURL(subtitleBlobUrlRef.current)
      subtitleBlobUrlRef.current = null
    }
  }

  const switchSub = useCallback(async (trackIndex) => {
    const v = videoRef.current
    if (!v) return
    setShowTrackMenu(false)

    // Clean up previous track
    cleanupSubtitleTrack()

    // Hide all other text tracks (hls.js native ones, etc.)
    for (let i = 0; i < v.textTracks.length; i++) {
      v.textTracks[i].mode = 'hidden'
    }

    if (trackIndex === null || trackIndex === undefined) {
      setActiveSub(null)
      return
    }

    const subTrack = subtitleTracks[trackIndex]
    if (!subTrack || !subTrack.url) {
      setActiveSub(null)
      return
    }

    try {
      // 1) Fetch VTT content from our proxy endpoint
      const resp = await fetch(subTrack.url)
      if (!resp.ok) {
        console.warn('Subtitle fetch failed:', resp.status, resp.statusText)
        setActiveSub(null)
        return
      }
      const vttText = await resp.text()

      // 2) Create a blob URL for the VTT content
      const blob = new Blob([vttText], { type: 'text/vtt' })
      const blobUrl = URL.createObjectURL(blob)
      subtitleBlobUrlRef.current = blobUrl

      // 3) Create a <track> element pointing at the blob URL
      const track = document.createElement('track')
      track.kind = 'subtitles'
      track.src = blobUrl
      track.srclang = subTrack.language || ''
      track.label = subTrack.label
      track.default = false
      v.appendChild(track)
      subtitleTrackElRef.current = track

      // 4) The browser registers the track asynchronously; set mode
      //    on the next microtask so the track is in the DOM.
      queueMicrotask(() => {
        track.track.mode = 'showing'
      })

      setActiveSub(trackIndex)
    } catch (err) {
      console.warn('Subtitle error:', err)
      setActiveSub(null)
    }
  }, [subtitleTracks])

  const disableSubs = useCallback(() => {
    const v = videoRef.current
    if (!v) return

    cleanupSubtitleTrack()

    // Hide any remaining text tracks
    for (let i = 0; i < v.textTracks.length; i++) {
      v.textTracks[i].mode = 'hidden'
    }
    setActiveSub(null)
    setShowTrackMenu(false)
  }, [])

  // ── Helper: send playback progress ────────────────────────────────────────

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
      // silent
    }
  }, [])

  // ── Handle loaded metadata ────────────────────────────────────────────────

  const handleLoadedMetadata = useCallback(() => {
    const v = videoRef.current
    if (!v) return

    // Hide text tracks by default, but preserve the active subtitle track
    for (let i = 0; i < v.textTracks.length; i++) {
      // Don't hide our active subtitle track element
      if (v.textTracks[i] === (subtitleTrackElRef.current?.track)) {
        continue
      }
      v.textTracks[i].mode = 'hidden'
    }

    // When hls.js drives playback, resume is handled by its startPosition —
    // seeking here would fight it. Native HLS / progressive still needs it.
    const usingHls = !!hlsRef.current

    if (switchingAudioRef.current) {
      switchingAudioRef.current = false
      // Always seek to the saved position — works for both hls.js and native.
      // hls.js startPosition only affects initial load, but we still need
      // to set currentTime to ensure the video element seeks immediately.
      const pos = pendingPositionRef.current
      if (pos !== null && pos > 0) {
        v.currentTime = pos
      }
      if (pendingPlayRef.current) {
        v.play().catch(() => {})
      }
      pendingPositionRef.current = null
      pendingPlayRef.current = false
      return
    }

    if (!usingHls) {
      const pos = initialPositionRef.current
      if (pos > 0 && !hasSeekedRef.current) {
        v.currentTime = pos
        hasSeekedRef.current = true
      }
    }
  }, [])

  // ── Periodic progress report ──────────────────────────────────────────────

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

  // ── Report stop + cleanup on unmount ──────────────────────────────────────

  // ── Cleanup on unmount ──────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      // Clear any pending gesture/indicator timeouts
      clearTimeout(gestureClearTimerRef.current)
      clearTimeout(gestureIndicatorTimeout.current)

      // Clean up subtitle track (remove <track> element + revoke blob URL)
      cleanupSubtitleTrack()

      const id = itemIdRef.current
      if (!id) return
      const pos = secToTicks(lastPositionRef.current)
      if (pos <= 0) return
      mediaAPI.reportPlaybackStopped({
        itemId: id,
        positionTicks: pos,
      }).catch(() => {})
    }
  }, [])

  // Sync playingRef with playing state (not inside the effect to avoid deps)
  playingRef.current = playing

  // ── Event listeners ───────────────────────────────────────────────────────

  useEffect(() => {
    const v = videoRef.current
    if (!v) return

    function onPlay() {
      setPlaying(true)
      // Auto-fullscreen on mobile (only on first play)
      if (mobile && !autoFullscreenDoneRef.current && !document.fullscreenElement) {
        autoFullscreenDoneRef.current = true
        enterFullscreen()
      }
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
      canplay: () => {
        setBuffering(false)
        // On non-mobile, hide the start screen once playback is ready
        if (!mobile) setShowStartScreen(false)
      },
      loadedmetadata: handleLoadedMetadata,
    }

    Object.entries(handlers).forEach(([ev, fn]) => v.addEventListener(ev, fn))
    const fsc = () => {
      const isFullscreen = !!document.fullscreenElement
      setFullscreen(isFullscreen)
      // On mobile, hide start screen only when video is playing AND in fullscreen
      // Use ref to avoid adding `playing` to effect deps (which would re-attach all listeners)
      if (mobile && isFullscreen && playingRef.current) {
        setShowStartScreen(false)
      }
    }
    document.addEventListener('fullscreenchange', fsc)

    return () => {
      Object.entries(handlers).forEach(([ev, fn]) => v.removeEventListener(ev, fn))
      document.removeEventListener('fullscreenchange', fsc)
    }
  }, [sendProgress, handleLoadedMetadata, mobile, enterFullscreen])

  // ── Fallback: auto-hide start screen after 5s (safety net) ───────────────
  useEffect(() => {
    if (!showStartScreen) return
    const timer = setTimeout(() => setShowStartScreen(false), 5000)
    return () => clearTimeout(timer)
  }, [showStartScreen])

  // ── Auto-hide controls ────────────────────────────────────────────────────

  function resetControlsTimer() {
    setShowControls(true)
    clearTimeout(controlsTimeout.current)
    controlsTimeout.current = setTimeout(() => {
      if (playing) setShowControls(false)
    }, 3000)
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

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

  const progress = effectiveDuration ? (currentTime / effectiveDuration) * 100 : 0
  const hasAudioChoice = audioTracks.length > 1
  const hasSubChoice = subtitleTracks.length > 0

  const activeAudioLabel = audioTracks[activeAudioIndex]
    ? audioTracks[activeAudioIndex].language || audioTracks[activeAudioIndex].displayTitle
    : 'Audio'

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className="relative bg-black w-full h-full select-none overflow-hidden"
      onMouseMove={resetControlsTimer}
      onMouseLeave={() => { playing && setShowControls(false); setShowTrackMenu(false) }}
      onTouchStart={mobile ? handleTouchStart : undefined}
      onTouchMove={mobile ? handleTouchMove : undefined}
      onTouchEnd={mobile ? handleTouchEnd : undefined}
      onTouchCancel={mobile ? handleTouchEnd : undefined}
      style={{ cursor: showControls ? 'default' : 'none' }}
    >
      {/* Video wrapper with brightness filter */}
      <div
        ref={videoWrapperRef}
        className="absolute inset-0 flex items-center justify-center"
        style={{ filter: `brightness(${brightness})` }}
      >
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          onClick={mobile ? undefined : togglePlay}
          playsInline
          webkit-playsinline="true"
          autoPlay
          muted={muted}
          crossOrigin="anonymous"
        >
          {/* Subtitles handled via Blob URL + dynamic <track> (see switchSub) */}
        </video>
      </div>

      {/* Dark overlay for simulated brightness dimming */}
      {/* Sits on top of the video but behind controls/gesture overlays */}
      <div
        className="absolute inset-0 pointer-events-none z-[5]"
        style={{
          backgroundColor: `rgba(0,0,0,${dimOpacity})`,
          transition: 'background-color 0.15s ease-out',
        }}
      />

      {/* Brightness overlay for click-to-seek on mobile */}
      {mobile && (
        <div
          className="absolute inset-0 z-10"
          onClick={(e) => {
            // Only toggle play if no gesture was just performed
            if (!wasGestureRef.current) {
              togglePlay()
              resetControlsTimer()
            }
          }}
        />
      )}

      {/* Buffering spinner */}
      <AnimatePresence>
        {buffering && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
          >
            <svg className="animate-spin w-14 h-14 text-white/80" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gesture indicator overlay */}
      <AnimatePresence>
        {gestureIndicator && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
          >
            <div className="bg-black/60 backdrop-blur-sm rounded-2xl px-8 py-6 flex flex-col items-center gap-3">
              {gestureIndicator.type === 'seek' ? (
                <>
                  <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-white text-lg font-bold font-mono">
                    {gestureIndicator.value}
                  </span>
                </>
              ) : gestureIndicator.type === 'brightness' ? (
                <>
                  <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <span className="text-white text-sm font-medium">
                    Brightness {Math.round(gestureIndicator.value * 100)}%
                  </span>
                  <div className="w-32 h-1.5 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white rounded-full transition-all"
                      style={{ width: `${((gestureIndicator.value - 0.3) / 1.2) * 100}%` }}
                    />
                  </div>
                </>
              ) : (
                <>
                  {gestureIndicator.value === 0 ? (
                    <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                    </svg>
                  ) : (
                    <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M15.536 8.464a5 5 0 010 7.072M12 6v12m-3.536-9.536a5 5 0 000 7.072M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                  )}
                  <span className="text-white text-sm font-medium">
                    Volume {Math.round(gestureIndicator.value * 100)}%
                  </span>
                  <div className="w-32 h-1.5 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white rounded-full transition-all"
                      style={{ width: `${gestureIndicator.value * 100}%` }}
                    />
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Starting loading screen – hides the initial flash on mobile */}
      <AnimatePresence>
        {mobile && showStartScreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.3 } }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black"
          >
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-violet-950/40 via-transparent to-black/60" />

            {/* Video title */}
            {title && (
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.5 }}
                className="text-white text-lg font-semibold text-center px-8 relative z-10"
              >
                {title}
              </motion.h1>
            )}

            {/* Animated loading indicator */}
            <div className="relative z-10 mt-8 flex flex-col items-center gap-4">
              {/* Pulsing rings */}
              <div className="relative w-16 h-16">
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-violet-500/40"
                  animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-violet-400/60"
                  animate={{ scale: [1, 1.2, 1], opacity: [0.8, 0.2, 0.8] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg className="w-7 h-7 text-violet-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>

              {/* Status text */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                className="text-zinc-400 text-sm font-medium"
              >
                Preparing your video…
              </motion.p>
            </div>

            {/* Bottom hint */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              transition={{ delay: 0.8 }}
              className="absolute bottom-12 text-zinc-600 text-xs text-center px-8"
            >
              Your video will start shortly
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls overlay */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 flex flex-col justify-between z-40"
            onClick={mobile ? (e) => {
              // Only toggle play when tapping the overlay background,
              // not when tapping a button or interactive element inside it
              if (!e.target.closest('button') && !e.target.closest('input') && !e.target.closest('[role="menuitem"]')) {
                togglePlay()
                resetControlsTimer()
              }
            } : undefined}
          >
            {/* Top bar — safe-area-aware padding for notched devices */}
            <div
              className="bg-gradient-to-b from-black/70 to-transparent px-4 flex items-center gap-4"
              style={{
                paddingTop: 'max(env(safe-area-inset-top, 0px), 1rem)',
                paddingBottom: '1rem',
              }}
            >
              {onBack && (
                <button onClick={onBack} className="p-2 text-white hover:text-zinc-300 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              {title && <h2 className="text-white font-semibold text-sm flex-1 truncate">{title}</h2>}
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
                    {formatTime(currentTime)} / {formatTime(effectiveDuration)}
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
                        <span className="hidden sm:inline truncate max-w-[80px]">{activeAudioLabel}</span>
                      </button>
                      <AnimatePresence>
                        {showTrackMenu === 'audio' && (
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 8 }}
                            className="absolute bottom-full right-0 mb-2 min-w-[200px] bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden shadow-2xl"
                          >
                            <p className="text-xs text-zinc-500 px-3 pt-2.5 pb-1 font-medium uppercase tracking-wide">Audio</p>
                            {audioTracks.map((t) => (
                              <button
                                key={t.index}
                                onClick={() => switchAudio(t.index)}
                                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                                  activeAudioIndex === t.index ? 'text-violet-400 bg-violet-500/10' : 'text-white hover:bg-zinc-800'
                                }`}
                              >
                                {activeAudioIndex === t.index && (
                                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                                  </svg>
                                )}
                                <span className={activeAudioIndex === t.index ? '' : 'ml-5'}>
                                  {t.language}
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
                            {subtitleTracks.map((t) => (
                              <button
                                key={t.index}
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
                                  {t.language || t.label}
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
