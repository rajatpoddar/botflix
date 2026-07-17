import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProxiedImageUrl } from '../lib/api'

const STORAGE_KEY = 'streamx_downloads'

const DownloadContext = createContext(null)

function loadDownloads() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveDownloads(downloads) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(downloads))
  } catch {
    // localStorage full — silently ignore
  }
}

function getStreamUrl(itemId, staticMode = false) {
  const baseUrl = import.meta.env.VITE_API_URL || ''
  const token = localStorage.getItem('access_token') || ''
  // Use proxy-stream for downloads. Without static=true the stream is remuxed
  // and may not include Content-Length (so we fall back to chunk-based progress).
  // With static=true (file download) Jellyfin returns Content-Length for real progress.
  return `${baseUrl}/api/media/proxy-stream/${itemId}?token=${token}${staticMode ? '&static=true' : ''}`
}

export function DownloadProvider({ children }) {
  const [downloads, setDownloads] = useState(loadDownloads)
  const activeDownloads = useRef({}) // ref to track active fetch controllers

  // Persist to localStorage whenever downloads change
  useEffect(() => {
    saveDownloads(downloads)
  }, [downloads])

  const startDownload = useCallback(async (item) => {
    const itemId = item.Id || item.id
    const name = item.Name || item.name || 'Unknown'

    // Check if already downloading or completed
    const existing = downloads.find(
      (d) => d.id === itemId && d.status !== 'error'
    )
    if (existing) return

    // Add initial entry
    const posterUrl = item.ImageTags?.Primary
      ? getProxiedImageUrl(itemId, 'Primary', 300, 85)
      : item.posterUrl || ''

    const entry = {
      id: itemId,
      name,
      type: item.Type || item.type || 'Movie',
      posterUrl,
      year: item.ProductionYear || '',
      runtime: item.RunTimeTicks || 0,
      status: 'downloading',
      progress: 0,
      timestamp: Date.now(),
      blobUrl: null,
    }

    setDownloads((prev) => [entry, ...prev])

    // Start the actual download — use static=true for real Content-Length progress
    const streamUrl = getStreamUrl(itemId, true)
    const controller = new AbortController()
    activeDownloads.current[itemId] = controller

    try {
      const response = await fetch(streamUrl, {
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
      })

      if (!response.ok) throw new Error('Download failed')

      const contentLength = response.headers.get('content-length')
      const total = contentLength ? parseInt(contentLength, 10) : 0
      const reader = response.body.getReader()
      const chunks = []
      let received = 0
      let chunkCount = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        chunks.push(value)
        received += value.length
        chunkCount++

        if (total > 0) {
          // Real progress based on bytes received vs total Content-Length
          const progress = Math.min(99, Math.round((received / total) * 100))
          setDownloads((prev) =>
            prev.map((d) => (d.id === itemId ? { ...d, progress } : d))
          )
        } else {
          // No Content-Length (transcoded stream) — estimate by chunk count
          // First 10 chunks advance quickly, then slow down (capped at 90%)
          const simulated = Math.min(90, chunkCount * 3 + 5)
          setDownloads((prev) =>
            prev.map((d) => (d.id === itemId ? { ...d, progress: simulated } : d))
          )
        }
      }

      // All chunks received — create blob URL
      const blob = new Blob(chunks, { type: response.headers.get('content-type') || 'video/mp4' })
      const blobUrl = URL.createObjectURL(blob)

      setDownloads((prev) =>
        prev.map((d) =>
          d.id === itemId
            ? { ...d, status: 'completed', progress: 100, blobUrl }
            : d
        )
      )
    } catch (err) {
      if (err.name === 'AbortError') {
        setDownloads((prev) =>
          prev.map((d) => (d.id === itemId ? { ...d, status: 'cancelled', progress: 0 } : d))
        )
      } else {
        setDownloads((prev) =>
          prev.map((d) => (d.id === itemId ? { ...d, status: 'error', progress: 0 } : d))
        )
      }
    } finally {
      delete activeDownloads.current[itemId]
    }
  }, [downloads])

  const cancelDownload = useCallback((itemId) => {
    const controller = activeDownloads.current[itemId]
    if (controller) {
      controller.abort()
    }
    // Clean up blob URL if exists
    const dl = downloads.find((d) => d.id === itemId)
    if (dl?.blobUrl) URL.revokeObjectURL(dl.blobUrl)
    setDownloads((prev) => prev.filter((d) => d.id !== itemId))
  }, [downloads])

  const retryDownload = useCallback((itemId) => {
    const failed = downloads.find((d) => d.id === itemId)
    if (!failed) return
    // Remove failed entry and restart
    setDownloads((prev) => prev.filter((d) => d.id !== itemId))
    startDownload(failed)
  }, [downloads, startDownload])

  const clearCompleted = useCallback(() => {
    // Revoke all blob URLs before clearing
    downloads.forEach((d) => {
      if (d.blobUrl) URL.revokeObjectURL(d.blobUrl)
    })
    setDownloads((prev) => prev.filter((d) => d.status === 'downloading'))
  }, [downloads])

  // Count downloading items for badge
  const activeCount = downloads.filter((d) => d.status === 'downloading').length

  return (
    <DownloadContext.Provider
      value={{
        downloads,
        activeCount,
        startDownload,
        cancelDownload,
        retryDownload,
        clearCompleted,
      }}
    >
      {children}
    </DownloadContext.Provider>
  )
}

export function useDownloads() {
  const ctx = useContext(DownloadContext)
  if (!ctx) throw new Error('useDownloads must be used inside DownloadProvider')
  return ctx
}
