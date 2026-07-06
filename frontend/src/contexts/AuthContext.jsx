import { createContext, useContext, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { authAPI } from '../lib/api'
import { saveSession, clearSession, isAuthenticated, getUsername } from '../lib/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() =>
    isAuthenticated() ? { username: getUsername() } : null
  )
  const navigate = useNavigate()

  const login = useCallback(async (credentials) => {
    const { data } = await authAPI.login(credentials)
    saveSession(data)
    setUser({ username: data.username })
    navigate('/')
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
    setUser({ username: data.username })
    navigate('/')
  }, [navigate])

  const logout = useCallback(() => {
    clearSession()
    setUser(null)
    navigate('/login')
  }, [navigate])

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
