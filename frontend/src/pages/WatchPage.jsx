import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { mediaAPI } from '../lib/api'
import VideoPlayer from '../components/player/VideoPlayer'

export default function WatchPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [streamUrl, setStreamUrl] = useState(null)
  const [item, setItem] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

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
          onClick={() => navigate(-1)}
          className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
        >
          ← Go back
        </button>
      </div>
    )
  }

  return (
    <div className="h-screen bg-black">
      <VideoPlayer
        src={streamUrl}
        title={item?.Name}
        onBack={() => navigate(-1)}
      />
    </div>
  )
}
