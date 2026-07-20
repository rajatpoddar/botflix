import axios from 'axios'
import { clearSession } from './auth'

const BASE_URL = import.meta.env.VITE_API_URL || ''

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Attach auth headers on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  const jfToken = localStorage.getItem('jellyfin_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  if (jfToken) config.headers['X-Jellyfin-Token'] = jfToken
  return config
})

// On 401 (Unauthorized), clear the session so the app doesn't show empty
// content with a stale/expired token. The user will be redirected to the
// login page by whichever component checks isAuthenticated().
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      clearSession()
      // Reload so AuthContext re-initializes to null and ProtectedRoute
      // redirects to the landing page.
      window.location.href = '/'
    }
    return Promise.reject(err)
  }
)

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  googleLogin: (credential) => api.post('/auth/google', { credential }),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, new_password) =>
    api.post('/auth/reset-password', { token, new_password }),
}

// ── Media ─────────────────────────────────────────────────────────────────────
export const mediaAPI = {
  getLatest: (limit = 20) => api.get(`/api/media/latest?limit=${limit}`),
  getCategories: () => api.get('/api/media/categories'),
  getLibraries: () => api.get('/api/media/libraries'),
  getItems: (params = {}) => api.get('/api/media/items', { params }),
  getItem: (itemId) => api.get(`/api/media/item/${itemId}`),
  getStreamUrl: (itemId, params = {}) => api.get(`/api/media/stream-url/${itemId}`, { params }),
  getProxyStreamUrl: (itemId, params = {}) => {
    // Build a URL that proxies through the backend — critical for mobile devices
    // that may not be able to reach Jellyfin directly.
    // Pass our own JWT token so the <video> element can authenticate (no custom headers).
    const baseUrl = import.meta.env.VITE_API_URL || ''
    const token = localStorage.getItem('access_token') || ''
    const allParams = { ...params, token }
    const query = new URLSearchParams(allParams).toString()
    return `${baseUrl}/api/media/proxy-stream/${itemId}?${query}`
  },
  getHlsUrl: (itemId, params = {}) => {
    // Build an HLS manifest URL proxied through the backend. HLS segments the
    // media so seeking/resume jump to a segment instead of restarting a
    // progressive transcode. Pass our JWT token so requests authenticate
    // without custom headers (the <video>/hls.js can't set headers on segments).
    const baseUrl = import.meta.env.VITE_API_URL || ''
    const token = localStorage.getItem('access_token') || ''
    const allParams = { ...params, token }
    const query = new URLSearchParams(allParams).toString()
    return `${baseUrl}/api/media/hls/${itemId}/main.m3u8?${query}`
  },
  getDownloadUrl: (itemId) => api.get(`/api/media/download-url/${itemId}`),
  getContinueWatching: (limit = 20) => api.get(`/api/media/continue-watching?limit=${limit}`),
  getSimilar: (itemId, limit = 12) => api.get(`/api/media/similar/${itemId}?limit=${limit}`),
  search: (query, limit = 20) =>
    api.get(`/api/media/search?query=${encodeURIComponent(query)}&limit=${limit}`),
  // ── Playback reporting ──────────────────────────────────────────────────
  reportPlaybackProgress: (data) => api.post('/api/media/playback/progress', data),
  reportPlaybackStopped: (data) => api.post('/api/media/playback/stop', data),

  // ── Watchlist ────────────────────────────────────────────────────────────
  getWatchlist: (limit = 50) => api.get(`/api/media/watchlist?limit=${limit}`),
  addToWatchlist: (itemId) => api.post(`/api/media/watchlist/${itemId}`),
  removeFromWatchlist: (itemId) => api.delete(`/api/media/watchlist/${itemId}`),

  // ── Landing page (public) ───────────────────────────────────────────────
  getLandingData: () => api.get('/api/media/landing'),

  getSeasons: (seriesId) => api.get(`/api/media/seasons/${seriesId}`),
  getEpisodes: (seriesId, seasonId = null) =>
    api.get(`/api/media/episodes/${seriesId}${seasonId ? `?season_id=${seasonId}` : ''}`),
}

// ── Jellyfin helpers ──────────────────────────────────────────────────────────
export function getJellyfinImageUrl(jellyfinBase, itemId, type = 'Primary', width = 400) {
  return `${jellyfinBase}/Items/${itemId}/Images/${type}?width=${width}&quality=90`
}

/**
 * Generate a proxied image URL that routes through our backend.
 * This is essential when the app is accessed via a domain (e.g. Cloudflare Tunnel)
 * because the browser may not be able to reach the Jellyfin server directly.
 * The JWT token is passed as a query param so <img> elements can authenticate
 * (they can't set custom headers).
 *
 * NOTE: Requires a valid JWT token (user must be logged in).
 * For public pages (like the landing page), use getPublicImageUrl() instead.
 */
export function getProxiedImageUrl(itemId, type = 'Primary', width = 400, quality = 90, index = null) {
  const baseUrl = import.meta.env.VITE_API_URL || ''
  const token = localStorage.getItem('access_token') || ''
  const params = new URLSearchParams({
    type,
    width: String(width),
    quality: String(quality),
    token,
  })
  if (index !== null) {
    params.set('index', String(index))
  }
  return `${baseUrl}/api/media/image/${itemId}?${params}`
}

/**
 * Generate a public proxied image URL — NO authentication needed.
 * Used on the landing page (before login) for the poster collage and
 * Top 10 Trending section. Uses the server API key internally.
 */
export function getPublicImageUrl(itemId, type = 'Primary', width = 400, quality = 90, index = null) {
  const baseUrl = import.meta.env.VITE_API_URL || ''
  const params = new URLSearchParams({
    type,
    width: String(width),
    quality: String(quality),
  })
  if (index !== null) {
    params.set('index', String(index))
  }
  return `${baseUrl}/api/media/public-image/${itemId}?${params}`
}
