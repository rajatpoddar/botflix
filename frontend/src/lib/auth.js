/**
 * Decode a JWT token's payload (base64url → JSON) without verifying the signature.
 * Returns null if the token is malformed.
 */
function decodeJwtPayload(token) {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    // Base64url → base64 → atob → JSON
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    // Pad with = so the length is a multiple of 4
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    return JSON.parse(atob(padded))
  } catch {
    return null
  }
}

/**
 * Check if the stored access_token has expired by decoding its JWT payload.
 * Returns true if the token is missing, expired, or malformed.
 */
export function isTokenExpired() {
  const token = localStorage.getItem('access_token')
  if (!token) return true

  const payload = decodeJwtPayload(token)
  if (!payload || !payload.exp) return true

  // exp is in seconds; compare against current time (in seconds)
  const now = Math.floor(Date.now() / 1000)
  return payload.exp < now
}

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
  const token = localStorage.getItem('access_token')
  if (!token) return false
  // Also check if the token has expired — prevents the app from showing
  // empty content when the user returns after the token has expired.
  if (isTokenExpired()) return false
  return true
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
