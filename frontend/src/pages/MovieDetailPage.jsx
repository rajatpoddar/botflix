import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { mediaAPI } from '../lib/api'
import Navbar from '../components/layout/Navbar'
import MediaCarousel from '../components/media/MediaCarousel'

const JELLYFIN_BASE = import.meta.env.VITE_JELLYFIN_URL || ''

function getImageUrl(itemId, tag, width = 400) {
  if (!JELLYFIN_BASE || !tag) return null
  const token = localStorage.getItem('jellyfin_token')
  const params = new URLSearchParams({ width, quality: 90 })
  if (token) params.set('api_key', token)
  return `${JELLYFIN_BASE}/Items/${itemId}/Images/Primary?${params}`
}

function getBackdropUrl(itemId, tag, width = 1280) {
  if (!JELLYFIN_BASE || !tag) return null
  const token = localStorage.getItem('jellyfin_token')
  const params = new URLSearchParams({ width, quality: 85 })
  if (token) params.set('api_key', token)
  return `${JELLYFIN_BASE}/Items/${itemId}/Images/Backdrop?${params}`
}

function getPersonImageUrl(personId) {
  if (!JELLYFIN_BASE) return null
  const token = localStorage.getItem('jellyfin_token')
  const params = new URLSearchParams({ width: 120, quality: 85 })
  if (token) params.set('api_key', token)
  return `${JELLYFIN_BASE}/Items/${personId}/Images/Primary?${params}`
}

function formatRuntime(ticks) {
  if (!ticks) return null
  const minutes = Math.floor(ticks / 600000000)
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function MovieDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [movie, setMovie] = useState(null)
  const [similar, setSimilar] = useState([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')
  const [favorite, setFavorite] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [itemRes, similarRes] = await Promise.allSettled([
          mediaAPI.getItem(id),
          mediaAPI.getSimilar(id, 12),
        ])

        if (itemRes.status === 'fulfilled') {
          setMovie(itemRes.value.data)
          setFavorite(itemRes.value.data?.UserData?.IsFavorite ?? false)
        } else {
          setError(itemRes.reason?.response?.data?.detail || 'Could not load this title.')
        }

        if (similarRes.status === 'fulfilled') {
          setSimilar(similarRes.value.data?.Items || [])
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const toggleWatchlist = useCallback(async () => {
    const prev = favorite
    setFavorite(!favorite)
    try {
      if (favorite) {
        await mediaAPI.removeFromWatchlist(id)
      } else {
        await mediaAPI.addToWatchlist(id)
      }
    } catch {
      setFavorite(prev)
    }
  }, [favorite, id])

  async function handleDownload() {
    if (downloading || !movie) return
    setDownloading(true)
    try {
      const res = await mediaAPI.getDownloadUrl(id)
      const { download_url } = res.data
      window.open(download_url, '_blank')
    } catch (err) {
      console.error('Download failed', err)
    } finally {
      setTimeout(() => setDownloading(false), 2000)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <svg className="animate-spin w-12 h-12 text-violet-500" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4">
        <p className="text-red-400">{error}</p>
        <button onClick={() => { if (window.history.length > 1) navigate(-1); else navigate('/') }} className="text-sm text-violet-400 hover:text-violet-300 transition-colors">
          ← Go back
        </button>
      </div>
    )
  }

  const backdropUrl = movie?.BackdropImageTags?.length
    ? getBackdropUrl(movie.Id, movie.BackdropImageTags[0])
    : null
  const posterUrl = movie?.ImageTags?.Primary
    ? getImageUrl(movie.Id, movie.ImageTags.Primary, 500)
    : null

  // Cast/People
  const cast = (movie?.People || []).filter((p) =>
    ['Actor', 'Director', 'Writer', 'Producer'].includes(p.Type)
  )

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Navbar />

      {/* Hero backdrop */}
      <div className="relative w-full h-72 sm:h-96 overflow-hidden">
        {backdropUrl ? (
          <img src={backdropUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-violet-900/40 to-zinc-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent" />

        {/* Back button — z-20 so it stays above the content below */}
        <button
          onClick={() => { if (window.history.length > 1) navigate(-1); else navigate('/') }}
          className="absolute top-4 left-4 z-20 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
          aria-label="Go back"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-8 lg:px-12 -mt-20 relative z-10 flex gap-6">
        {posterUrl && (
          <img
            src={posterUrl}
            alt={movie?.Name}
            className="hidden sm:block w-40 rounded-xl shadow-xl flex-shrink-0 self-end"
          />
        )}
        <div className="flex-1 pb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold">{movie?.Name}</h1>
            {/* Watchlist heart */}
            <button
              onClick={toggleWatchlist}
              className="p-2 rounded-full hover:bg-zinc-800 transition-colors"
              aria-label={favorite ? 'Remove from watchlist' : 'Add to watchlist'}
            >
              <svg
                className={`w-6 h-6 transition-colors ${favorite ? 'text-red-500' : 'text-zinc-500 hover:text-red-400'}`}
                fill={favorite ? 'currentColor' : 'none'}
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-zinc-400">
            {movie?.ProductionYear && <span>{movie.ProductionYear}</span>}
            {movie?.CommunityRating && (
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                {movie.CommunityRating?.toFixed(1)}
              </span>
            )}
            {movie?.RunTimeTicks && (
              <span>{formatRuntime(movie.RunTimeTicks)}</span>
            )}
            {movie?.Genres?.length > 0 && (
              <span>{movie.Genres.slice(0, 4).join(' · ')}</span>
            )}
          </div>
          {movie?.Taglines?.length > 0 && (
            <p className="mt-3 text-base italic text-zinc-400">"{movie.Taglines[0]}"</p>
          )}
          {movie?.Overview && (
            <p className="mt-3 text-sm text-zinc-300 leading-relaxed max-w-2xl">
              {movie.Overview}
            </p>
          )}

          {/* Action buttons */}
          <div className="mt-6 flex gap-3 flex-wrap">
            {movie?.UserData?.PlaybackPositionTicks > 0 ? (
              <>
                <button
                  onClick={() => navigate(`/watch/${movie.Id}`)}
                  className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-bold px-8 py-3.5 rounded-xl transition-colors shadow-lg shadow-violet-900/30"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Resume
                </button>
                <button
                  onClick={() => navigate(`/watch/${movie.Id}?fresh=1`)}
                  className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold px-6 py-3.5 rounded-xl transition-colors border border-zinc-700"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Start Over
                </button>
              </>
            ) : (
              <button
                onClick={() => navigate(`/watch/${movie.Id}`)}
                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-bold px-8 py-3.5 rounded-xl transition-colors shadow-lg shadow-violet-900/30"
              >
                <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Play
              </button>
            )}
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold px-6 py-3.5 rounded-xl transition-colors border border-zinc-700 disabled:opacity-50"
            >
              {downloading ? (
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              )}
              {downloading ? 'Starting…' : 'Download'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Cast Section ── */}
      {cast.length > 0 && (
        <section className="px-4 sm:px-8 lg:px-12 mt-8">
          <h2 className="text-lg font-bold mb-4">Cast & Crew</h2>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4">
            {cast.map((person) => {
              const personImg = person.Id ? getPersonImageUrl(person.Id) : null
              return (
                <div
                  key={person.Id || person.Name}
                  className="flex-shrink-0 w-20 text-center"
                >
                  <div className="w-20 h-20 rounded-full overflow-hidden bg-zinc-800 mx-auto mb-1.5">
                    {personImg ? (
                      <img
                        src={personImg}
                        alt={person.Name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none'
                          e.target.parentElement.classList.add('flex', 'items-center', 'justify-center')
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-600">
                        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-white font-medium truncate leading-tight">
                    {person.Name}
                  </p>
                  <p className="text-[10px] text-zinc-500 truncate">{person.Role || person.Type}</p>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── More Like This ── */}
      {similar.length > 0 && (
        <div className="mt-4">
          <MediaCarousel title="More Like This" items={similar} loading={false} />
        </div>
      )}

      {/* Bottom padding */}
      <div className="h-12" />
    </div>
  )
}
