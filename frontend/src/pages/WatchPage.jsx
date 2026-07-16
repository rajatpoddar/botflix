import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { mediaAPI } from '../lib/api'
import VideoPlayer from '../components/player/VideoPlayer'

export default function WatchPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [streamUrl, setStreamUrl] = useState(null)
  const [item, setItem] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [streamRes, itemRes] = await Promise.all([
          mediaAPI.getStreamUrl(id),
          mediaAPI.getItem(id),
        ])
        setStreamUrl(streamRes.data.stream_url)
        setItem(itemRes.data)
      } catch (err) {
        setError(err.response?.data?.detail || 'Could not load this title.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  async function handleDownload() {
    if (downloading) return
    setDownloading(true)
    try {
      const res = await mediaAPI.getDownloadUrl(id)
      const { download_url } = res.data
      // Open direct Jellyfin stream URL — browser handles the download
      window.open(download_url, '_blank')
    } catch (err) {
      console.error('Download failed', err)
    } finally {
      setTimeout(() => setDownloading(false), 2000)
    }
  }

  if (loading) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <svg className="animate-spin w-12 h-12 text-violet-500" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center gap-4">
        <p className="text-red-400">{error}</p>
        <button
          onClick={() => {
            if (window.history.length > 1) navigate(-1)
            else navigate('/')
          }}
          className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
        >
          ← Go back
        </button>
      </div>
    )
  }

  // Calculate resume position from UserData (if the item was partially watched).
  // If ?fresh=1 is present, override to 0 (start from beginning).
  const initialPosition = searchParams.get('fresh') === '1'
    ? 0
    : item?.UserData?.PlaybackPositionTicks
      ? Math.floor(item.UserData.PlaybackPositionTicks / 10_000_000)
      : 0

  return (
    <div className="flex flex-col h-screen bg-black">
      {/* Player takes remaining height */}
      <div className="flex-1 min-h-0">
        <VideoPlayer
          src={streamUrl}
          title={item?.Name}
          itemId={id}
          initialPosition={initialPosition}
          onBack={() => {
            if (window.history.length > 1) {
              navigate(-1)
            } else {
              navigate('/')
            }
          }}
          onDownload={handleDownload}
          downloading={downloading}
        />
      </div>
    </div>
  )
}
