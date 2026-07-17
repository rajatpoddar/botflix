import { createContext, useContext, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { authAPI } from '../lib/api'
import { saveSession, clearSession, isAuthenticated, getUsername, getAvatarUrl } from '../lib/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() =>
    isAuthenticated()
      ? { username: getUsername(), avatar_url: getAvatarUrl() }
      : null
  )
  const navigate = useNavigate()

  const login = useCallback(async (credentials) => {
    const { data } = await authAPI.login(credentials)
    saveSession(data)
    setUser({ username: data.username, avatar_url: data.avatar_url })
    navigate('/browse')
    return data
  }, [navigate])

  const register = useCallback(async (credentials) => {
    await authAPI.register(credentials)
    // Auto-login after registration
    const { data } = await authAPI.login({
      username: credentials.username,
      password: credentials.password,
    })
    saveSession(data)
    setUser({ username: data.username, avatar_url: data.avatar_url })
    navigate('/browse')
  }, [navigate])

  const googleLogin = useCallback(async (credential) => {
    const { data } = await authAPI.googleLogin(credential)
    saveSession(data)
    setUser({ username: data.username, avatar_url: data.avatar_url })
    navigate('/browse')
    return data
  }, [navigate])

  const logout = useCallback(() => {
    clearSession()
    setUser(null)
    navigate('/')
  }, [navigate])

  return (
    <AuthContext.Provider value={{ user, login, register, googleLogin, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
