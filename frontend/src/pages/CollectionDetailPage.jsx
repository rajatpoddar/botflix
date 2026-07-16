import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { mediaAPI } from '../lib/api'
import Navbar from '../components/layout/Navbar'
import MediaGrid from '../components/media/MediaGrid'

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

export default function CollectionDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [collection, setCollection] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [favorite, setFavorite] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [itemRes, childrenRes] = await Promise.allSettled([
          mediaAPI.getItem(id),
          mediaAPI.getItems({
            parent_id: id,
            include_item_types: 'Movie,Series',
            sort_by: 'SortName',
            sort_order: 'Ascending',
            limit: 100,
          }),
        ])

        if (itemRes.status === 'fulfilled') {
          setCollection(itemRes.value.data)
          setFavorite(itemRes.value.data?.UserData?.IsFavorite ?? false)
        } else {
          setError(itemRes.reason?.response?.data?.detail || 'Could not load this collection.')
        }

        if (childrenRes.status === 'fulfilled') {
          setItems(childrenRes.value.data?.Items || [])
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
        <button
          onClick={() => { if (window.history.length > 1) navigate(-1); else navigate('/browse') }}
          className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
        >
          ← Go back
        </button>
      </div>
    )
  }

  const backdropUrl = collection?.BackdropImageTags?.length
    ? getBackdropUrl(collection.Id, collection.BackdropImageTags[0])
    : null
  const posterUrl = collection?.ImageTags?.Primary
    ? getImageUrl(collection.Id, collection.ImageTags.Primary, 400)
    : null

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Navbar />

      {/* Hero backdrop */}
      <div className="relative w-full h-64 sm:h-80 overflow-hidden">
        {backdropUrl ? (
          <img src={backdropUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-violet-900/30 to-zinc-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent" />

        <button
          onClick={() => { if (window.history.length > 1) navigate(-1); else navigate('/browse') }}
          className="absolute top-4 left-4 z-20 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
          aria-label="Go back"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Collection info overlay on backdrop */}
        <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10 z-10">
          <div className="flex items-end gap-5">
            {posterUrl && (
              <img
                src={posterUrl}
                alt={collection?.Name}
                className="hidden sm:block w-32 rounded-lg shadow-xl flex-shrink-0"
              />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-bold">{collection?.Name}</h1>
                <button
                  onClick={toggleWatchlist}
                  className="p-2 rounded-full hover:bg-white/10 transition-colors"
                  aria-label={favorite ? 'Remove from watchlist' : 'Add to watchlist'}
                >
                  <svg
                    className={`w-6 h-6 transition-colors ${favorite ? 'text-red-500' : 'text-white/60 hover:text-red-400'}`}
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
              {collection?.ProductionYear && (
                <p className="text-sm text-zinc-400 mt-1">{collection.ProductionYear}</p>
              )}
              {collection?.Overview && (
                <p className="mt-2 text-sm text-zinc-300 leading-relaxed max-w-2xl line-clamp-2">
                  {collection.Overview}
                </p>
              )}
              <p className="mt-2 text-xs text-zinc-500">
                {items.length} {items.length === 1 ? 'title' : 'titles'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Items grid */}
      <div className="px-4 sm:px-8 lg:px-12 mt-6 pb-20">
        {items.length > 0 ? (
          <MediaGrid items={items} />
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
            <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className="text-lg font-medium">This collection is empty</p>
            <p className="text-sm mt-1">Add movies to this collection in Jellyfin.</p>
          </div>
        )}
      </div>
    </div>
  )
}
