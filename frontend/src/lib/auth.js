export function saveSession({ access_token, jellyfin_token, jellyfin_user_id, username, email, avatar_url }) {
  localStorage.setItem('access_token', access_token)
  localStorage.setItem('jellyfin_token', jellyfin_token)
  localStorage.setItem('jellyfin_user_id', jellyfin_user_id)
  localStorage.setItem('username', username)
  if (email) localStorage.setItem('email', email)
  if (avatar_url) localStorage.setItem('avatar_url', avatar_url)
  else localStorage.removeItem('avatar_url')
}

export function clearSession() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('jellyfin_token')
  localStorage.removeItem('jellyfin_user_id')
  localStorage.removeItem('username')
  localStorage.removeItem('email')
  localStorage.removeItem('avatar_url')
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

export function getAvatarUrl() {
  return localStorage.getItem('avatar_url') || ''
}
