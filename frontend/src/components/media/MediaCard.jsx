import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { mediaAPI } from '../../lib/api'

const JELLYFIN_BASE = import.meta.env.VITE_JELLYFIN_URL || ''

function formatRuntime(ticks) {
  if (!ticks) return null
  const minutes = Math.floor(ticks / 600000000)
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function getJellyfinImageUrl(itemId, tag, width = 300) {
  if (!JELLYFIN_BASE || !tag) return null
  const token = localStorage.getItem('jellyfin_token')
  const params = new URLSearchParams({ width, quality: 90 })
  if (token) params.set('api_key', token)
  return `${JELLYFIN_BASE}/Items/${itemId}/Images/Primary?${params}`
}

export default function MediaCard({ item }) {
  const navigate = useNavigate()
  const [imgError, setImgError] = useState(false)
  const [favorite, setFavorite] = useState(item.UserData?.IsFavorite ?? false)

  const imgUrl = !imgError && item.ImageTags?.Primary
    ? getJellyfinImageUrl(item.Id, item.ImageTags.Primary)
    : null

  const runtime = formatRuntime(item.RunTimeTicks)
  const year = item.ProductionYear

  const toggleWatchlist = useCallback(async (e) => {
    e.stopPropagation()
    const prev = favorite
    setFavorite(!favorite)
    try {
      if (favorite) {
        await mediaAPI.removeFromWatchlist(item.Id)
      } else {
        await mediaAPI.addToWatchlist(item.Id)
      }
    } catch {
      setFavorite(prev)
    }
  }, [favorite, item.Id])

  function goToDetail() {
    if (item.Type === 'Series') {
      navigate(`/show/${item.Id}`)
    } else {
      navigate(`/movie/${item.Id}`)
    }
  }

  function goToPlay(e) {
    e.stopPropagation()
    navigate(`/watch/${item.Id}`)
  }

  return (
    <motion.div
      whileHover={{ scale: 1.05, zIndex: 10 }}
      transition={{ duration: 0.2 }}
      className="relative flex-shrink-0 w-40 sm:w-44 cursor-pointer group"
      onClick={goToDetail}
    >
      {/* Poster */}
      <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-zinc-800">
        {imgUrl ? (
          <img
            src={imgUrl}
            alt={item.Name}
            loading="lazy"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-zinc-800">
            <svg className="w-10 h-10 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
          </div>
        )}

        {/* Overlay on hover — click play button starts playing */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-200 flex items-center justify-center">
          <button
            onClick={goToPlay}
            className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:scale-110 transform"
            aria-label={`Play ${item.Name}`}
          >
            <svg className="w-5 h-5 text-zinc-900 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        </div>

        {/* Watchlist heart button — left of rating badge */}
        <button
          onClick={toggleWatchlist}
          className="absolute bottom-2 right-2 z-20 p-1.5 rounded-full bg-black/60 hover:bg-black/80 transition-all hover:scale-110"
          aria-label={favorite ? 'Remove from watchlist' : 'Add to watchlist'}
        >
          <svg
            className={`w-4 h-4 transition-colors ${favorite ? 'text-red-500' : 'text-white/70 hover:text-red-400'}`}
            fill={favorite ? 'currentColor' : 'none'}
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>

        {/* Rating badge */}
        {item.CommunityRating && (
          <div className="absolute top-2 right-2 bg-black/70 rounded px-1.5 py-0.5 text-xs font-medium flex items-center gap-1">
            <svg className="w-3 h-3 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            {item.CommunityRating.toFixed(1)}
          </div>
        )}

        {/* Watched badge (takes priority over Resume) */}
        {item.UserData?.Played && (
          <div className="absolute top-2 left-2 bg-emerald-600/90 rounded px-1.5 py-0.5 text-[10px] font-semibold text-white flex items-center gap-1 shadow-lg">
            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Watched
          </div>
        )}

        {/* Resume badge (only when not fully played) */}
        {!item.UserData?.Played && item.UserData?.PlaybackPositionTicks > 0 && (
          <div className="absolute top-2 left-2 bg-violet-600/90 rounded px-1.5 py-0.5 text-[10px] font-semibold text-white flex items-center gap-1 shadow-lg">
            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            Resume
          </div>
        )}

        {/* Progress bar for Continue Watching / partially watched items */}
        {item.UserData?.PlaybackPositionTicks > 0 && item.RunTimeTicks > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-800">
            <div
              className="h-full bg-violet-500"
              style={{
                width: `${Math.min(100, (item.UserData.PlaybackPositionTicks / item.RunTimeTicks) * 100)}%`,
              }}
            />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="mt-2 px-1">
        <p className="text-sm font-medium text-white truncate">{item.Name}</p>
        <p className="text-xs text-zinc-500 mt-0.5">
          {[year, runtime].filter(Boolean).join(' · ')}
        </p>
      </div>
    </motion.div>
  )
}
