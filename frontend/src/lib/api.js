import axios from 'axios'

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

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.clear()
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, new_password) =>
    api.post('/auth/reset-password', { token, new_password }),
}

// ── Media ─────────────────────────────────────────────────────────────────────
export const mediaAPI = {
  getLatest: (limit = 20) => api.get(`/api/media/latest?limit=${limit}`),
  getCategories: () => api.get('/api/media/categories'),
  getItems: (params = {}) => api.get('/api/media/items', { params }),
  getItem: (itemId) => api.get(`/api/media/item/${itemId}`),
  getStreamUrl: (itemId) => api.get(`/api/media/stream-url/${itemId}`),
  search: (query, limit = 20) =>
    api.get(`/api/media/search?query=${encodeURIComponent(query)}&limit=${limit}`),
}

// ── Jellyfin helpers ──────────────────────────────────────────────────────────
export function getJellyfinImageUrl(jellyfinBase, itemId, type = 'Primary', width = 400) {
  return `${jellyfinBase}/Items/${itemId}/Images/${type}?width=${width}&quality=90`
}
