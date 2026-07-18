import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { mediaAPI, getProxiedImageUrl } from '../lib/api'
import Navbar from '../components/layout/Navbar'
import { useDownloads } from '../contexts/DownloadContext'

function getImageUrl(itemId, tag, width = 300) {
  if (!tag) return null
  return getProxiedImageUrl(itemId, 'Primary', width, 90)
}

function getBackdropUrl(itemId, tag, width = 1280) {
  if (!tag) return null
  return getProxiedImageUrl(itemId, 'Backdrop', width, 85)
}

function formatRuntime(ticks) {
  if (!ticks) return null
  const minutes = Math.floor(ticks / 600000000)
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function EpisodeDownloadButton({ ep, showName }) {
  const { startDownload, downloads } = useDownloads()
  const navigate = useNavigate()

  const dlItem = downloads.find((d) => d.id === ep.Id)
  const isDling = dlItem?.status === 'downloading'
  const isDled = dlItem?.status === 'completed'

  function handleEpDownload(e) {
    e.stopPropagation()
    if (isDling) return
    if (isDled) {
      navigate('/browse/downloads')
      return
    }
    startDownload({ ...ep, Type: 'Episode', SeriesName: showName })
  }

  return (
    <button
      onClick={handleEpDownload}
      disabled={isDling}
      className="mt-2 flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-violet-400 transition-colors disabled:opacity-50"
      aria-label={`Download ${ep.Name}`}
    >
      {isDling ? (
        <>
          <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          {dlItem?.progress || 0}%
        </>
      ) : isDled ? (
        <>
          <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-emerald-500">Downloaded</span>
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download
        </>
      )}
    </button>
  )
}

export default function TVShowDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [show, setShow] = useState(null)
  const [seasons, setSeasons] = useState([])
  const [activeSeason, setActiveSeason] = useState(null)
  const [episodes, setEpisodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [epLoading, setEpLoading] = useState(false)
  const [error, setError] = useState('')
  const [favorite, setFavorite] = useState(false)
  const { startDownload, downloads } = useDownloads()

  const downloadItem = downloads.find((d) => d.id === episodes[0]?.Id)
  const isDownloading = downloadItem?.status === 'downloading'
  const isDownloaded = downloadItem?.status === 'completed'

  // Load show metadata + seasons
  useEffect(() => {
    async function init() {
      try {
        const [showRes, seasonsRes] = await Promise.all([
          mediaAPI.getItem(id),
          mediaAPI.getSeasons(id),
        ])
        setShow(showRes.data)
        setFavorite(showRes.data?.UserData?.IsFavorite ?? false)
        const s = seasonsRes.data?.Items || []
        setSeasons(s)
        if (s.length > 0) setActiveSeason(s[0].Id)
      } catch (e) {
        setError(e.response?.data?.detail || 'Could not load show.')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [id])

  // Load episodes when season changes
  useEffect(() => {
    if (!activeSeason) return
    async function fetchEpisodes() {
      setEpLoading(true)
      try {
        const res = await mediaAPI.getEpisodes(id, activeSeason)
        setEpisodes(res.data?.Items || [])
      } catch {
        setEpisodes([])
      } finally {
        setEpLoading(false)
      }
    }
    fetchEpisodes()
  }, [id, activeSeason])

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
    if (episodes.length === 0 || isDownloading) return
    if (isDownloaded) {
      navigate('/browse/downloads')
      return
    }
    startDownload({ ...episodes[0], Type: 'Episode', SeriesName: show?.Name })
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
        <button onClick={() => { if (window.history.length > 1) navigate(-1); else navigate('/') }} className="text-sm text-violet-400 hover:text-violet-300">
          ← Go back
        </button>
      </div>
    )
  }

  const backdropUrl = show?.BackdropImageTags?.length
    ? getBackdropUrl(show.Id, show.BackdropImageTags[0])
    : null
  const posterUrl = show?.ImageTags?.Primary
    ? getImageUrl(show.Id, show.ImageTags.Primary, 400)
    : null

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Navbar />

      {/* Hero backdrop */}
      <div className="relative w-full h-72 sm:h-96 overflow-hidden">
        {backdropUrl ? (
          <img src={backdropUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-zinc-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent" />

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

      {/* Show info */}
      <div className="px-4 sm:px-8 lg:px-12 -mt-20 relative z-10 flex gap-6">
        {posterUrl && (
          <img
            src={posterUrl}
            alt={show?.Name}
            className="hidden sm:block w-36 rounded-lg shadow-xl flex-shrink-0 self-end"
          />
        )}
        <div className="flex-1 pb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold">{show?.Name}</h1>
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
            {show?.ProductionYear && <span>{show.ProductionYear}</span>}
            {show?.CommunityRating && (
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                {show.CommunityRating.toFixed(1)}
              </span>
            )}
            {show?.Genres?.length > 0 && (
              <span>{show.Genres.slice(0, 3).join(' · ')}</span>
            )}
          </div>
          {show?.Overview && (
            <p className="mt-3 text-sm text-zinc-300 leading-relaxed line-clamp-3 max-w-2xl">
              {show.Overview}
            </p>
          )}

          {/* Action buttons */}
          <div className="mt-4 flex gap-3 flex-wrap">
            <button
              onClick={() => {
                if (episodes.length > 0) {
                  navigate(`/watch/${episodes[0].Id}`)
                }
              }}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-bold px-6 py-2.5 rounded-xl transition-colors shadow-lg shadow-violet-900/30 text-sm"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              {episodes.length > 0 ? `Play ${episodes[0].IndexNumber != null ? `E${episodes[0].IndexNumber} ` : ''}· ${episodes[0].Name}` : 'Play'}
            </button>
            {episodes.length > 0 && (
              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className={`flex items-center gap-2 text-white font-semibold px-5 py-2.5 rounded-xl transition-all border text-sm ${
                  isDownloaded
                    ? 'bg-emerald-600/20 border-emerald-700 hover:bg-emerald-600/30 text-emerald-400'
                    : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 disabled:opacity-50'
                }`}
              >
                {isDownloading ? (
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                ) : isDownloaded ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                )}
                {isDownloading
                  ? `Downloading ${downloadItem?.progress || 0}%`
                  : isDownloaded
                    ? 'Downloaded'
                    : 'Download Episode'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Season tabs */}
      <div className="px-4 sm:px-8 lg:px-12 mt-8">
        {seasons.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-6">
            {seasons.map((season) => (
              <button
                key={season.Id}
                onClick={() => setActiveSeason(season.Id)}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                  activeSeason === season.Id
                    ? 'bg-violet-600 border-violet-600 text-white'
                    : 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white'
                }`}
              >
                {season.Name}
              </button>
            ))}
          </div>
        )}

        {/* Episodes list */}
        {epLoading ? (
          <div className="flex justify-center py-12">
            <svg className="animate-spin w-8 h-8 text-violet-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
        ) : (
          <div className="flex flex-col gap-3 pb-20">
            {episodes.map((ep) => {
              const epImg = ep.ImageTags?.Primary
                ? getImageUrl(ep.Id, ep.ImageTags.Primary, 400)
                : null
              const runtime = formatRuntime(ep.RunTimeTicks)

              return (
                <div
                  key={ep.Id}
                  className="flex items-start gap-4 p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 transition-colors text-left group"
                >
                  {/* Thumbnail */}
                  <button
                    onClick={() => navigate(`/watch/${ep.Id}`)}
                    className="relative flex-shrink-0 w-36 sm:w-44 aspect-video rounded-lg overflow-hidden bg-zinc-800"
                  >
                    {epImg ? (
                      <img src={epImg} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                        </svg>
                      </div>
                    )}
                    {/* Play overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg className="w-4 h-4 text-zinc-900 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                  </button>

                  {/* Episode info */}
                  <div className="flex-1 min-w-0 pt-1">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        onClick={() => navigate(`/watch/${ep.Id}`)}
                        className="text-left"
                      >
                        <p className="text-sm font-semibold text-white hover:text-violet-400 transition-colors">
                          {ep.IndexNumber != null ? `${ep.IndexNumber}. ` : ''}{ep.Name}
                        </p>
                      </button>
                      {runtime && (
                        <span className="text-xs text-zinc-500 flex-shrink-0">{runtime}</span>
                      )}
                    </div>
                    {ep.Overview && (
                      <p className="mt-1 text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                        {ep.Overview}
                      </p>
                    )}
                    {/* Episode download button */}
                    <EpisodeDownloadButton ep={ep} showName={show?.Name} />
                  </div>
                </div>
              )
            })}

            {episodes.length === 0 && !epLoading && (
              <p className="text-zinc-500 text-sm text-center py-8">No episodes found.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
