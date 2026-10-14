import { createContext, useContext } from 'react'
import type { RequestOptions } from '../api/client'
import type { User } from '../types'

export interface AuthContextValue {
  user: User | null
  token: string | null
  // Shown on the login page, e.g. after the session expired.
  notice: string
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
  // Calls the API with the user's token; logs out if the token was rejected.
  request: <T>(path: string, options?: Omit<RequestOptions, 'token'>) => Promise<T>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('useAuth must be used inside <AuthProvider>')
  }
  return value
}
