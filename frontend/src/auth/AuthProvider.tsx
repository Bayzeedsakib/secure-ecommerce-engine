import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { ApiError, apiRequest, type RequestOptions } from '../api/client'
import { clearSession, loadSession, saveSession } from '../storage'
import type { Session } from '../types'
import { AuthContext, type AuthContextValue } from './auth-context'

export const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Please log in again.'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(loadSession)
  const [notice, setNotice] = useState('')

  const startSession = useCallback((next: Session) => {
    saveSession(next)
    setNotice('')
    setSession(next)
  }, [])

  const logout = useCallback(() => {
    clearSession()
    setSession(null)
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      startSession(
        await apiRequest<Session>('/api/auth/login', {
          method: 'POST',
          body: { email, password },
        }),
      )
    },
    [startSession],
  )

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      startSession(
        await apiRequest<Session>('/api/auth/register', {
          method: 'POST',
          body: { name, email, password },
        }),
      )
    },
    [startSession],
  )

  const token = session?.token ?? null

  const request = useCallback(
    async <T,>(path: string, options: Omit<RequestOptions, 'token'> = {}) => {
      try {
        return await apiRequest<T>(path, { ...options, token: token ?? undefined })
      } catch (error) {
        if (token && error instanceof ApiError && error.status === 401) {
          logout()
          setNotice(SESSION_EXPIRED_MESSAGE)
        }
        throw error
      }
    },
    [token, logout],
  )

  const value = useMemo<AuthContextValue>(
    () => ({ user: session?.user ?? null, token, notice, login, register, logout, request }),
    [session, token, notice, login, register, logout, request],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
