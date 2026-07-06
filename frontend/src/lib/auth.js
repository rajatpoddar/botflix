export function saveSession({ access_token, jellyfin_token, jellyfin_user_id, username }) {
  localStorage.setItem('access_token', access_token)
  localStorage.setItem('jellyfin_token', jellyfin_token)
  localStorage.setItem('jellyfin_user_id', jellyfin_user_id)
  localStorage.setItem('username', username)
}

export function clearSession() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('jellyfin_token')
  localStorage.removeItem('jellyfin_user_id')
  localStorage.removeItem('username')
}

export function isAuthenticated() {
  return !!localStorage.getItem('access_token')
}

export function getUsername() {
  return localStorage.getItem('username') || ''
}

export function getJellyfinToken() {
  return localStorage.getItem('jellyfin_token') || ''
}

export function getJellyfinUserId() {
  return localStorage.getItem('jellyfin_user_id') || ''
}
