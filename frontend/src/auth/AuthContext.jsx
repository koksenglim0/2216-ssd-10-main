import { useCallback, useEffect, useMemo, useState } from 'react'
import { authApi } from '../api/sitwallet'
import { setAccessToken } from '../api/http'
import { AuthContext } from './authContextValue'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('loading')

  const refresh = useCallback(async () => {
    try {
      const session = await authApi.refresh()
      setUser(session.user)
      setStatus('authenticated')
      return session.user
    } catch {
      setUser(null)
      setAccessToken('')
      setStatus('anonymous')
      return null
    }
  }, [])

  useEffect(() => {
    void Promise.resolve().then(refresh)
  }, [refresh])

  const completeLogin = useCallback((session) => {
    setAccessToken(session.accessToken)
    setUser(session.user)
    setStatus('authenticated')
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      setAccessToken('')
      setUser(null)
      setStatus('anonymous')
    }
  }, [])

  const value = useMemo(() => ({
    user,
    status,
    isAuthenticated: status === 'authenticated',
    isLoading: status === 'loading',
    completeLogin,
    refresh,
    logout,
  }), [completeLogin, logout, refresh, status, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
