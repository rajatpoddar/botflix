import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { mediaAPI } from '../lib/api'
import VideoPlayer from '../components/player/VideoPlayer'

/**
 * Extract audio tracks from an item's MediaStreams array.
 * Returns [{ index, language, displayTitle }] sorted by Index.
 */
function extractAudioTracks(item) {
  if (!item?.MediaStreams) return []
  return item.MediaStreams
    .filter((s) => s.Type === 'Audio')
    .sort((a, b) => (a.Index ?? 0) - (b.Index ?? 0))
    .map((s) => ({
      index: s.Index ?? 0,
      language: s.Language || '',
      displayTitle: s.DisplayTitle || `Audio ${(s.Index ?? 0) + 1}`,
    }))
}

export default function WatchPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [streamUrl, setStreamUrl] = useState(null)
  const [item, setItem] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  // Track the current audio stream index (default = 0)
  const [audioIndex, setAudioIndex] = useState(0)

  useEffect(() => {
    async function load() {
      try {
        // Use the HLS manifest URL — segmented streaming gives fast seeking
        // and resume, proxied through our backend so mobile devices don't need
        // direct access to the Jellyfin server.
        const hlsUrl = mediaAPI.getHlsUrl(id, { audio_stream_index: 0 })
        const itemRes = await mediaAPI.getItem(id)
        setStreamUrl(hlsUrl)
        setItem(itemRes.data)
      } catch (err) {
        setError(err.response?.data?.detail || 'Could not load this title.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  // Switch audio track — rebuild the HLS manifest URL with the selected
  // AudioStreamIndex. The player re-seeks to currentPosition after reload.
  const switchAudio = useCallback(async (index, currentPosition) => {
    const hlsUrl = mediaAPI.getHlsUrl(id, { audio_stream_index: index })
    setStreamUrl(hlsUrl)
    setAudioIndex(index)
    return hlsUrl
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

  // Extract audio tracks from item metadata
  const audioTracks = extractAudioTracks(item)

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
          durationFromMeta={item?.RunTimeTicks ? Math.floor(item.RunTimeTicks / 10_000_000) : undefined}
          audioTracks={audioTracks}
          activeAudioIndex={audioIndex}
          onSwitchAudio={switchAudio}
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
