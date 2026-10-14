import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/auth-context'

type Mode = 'login' | 'register'

export function AuthPage({ mode }: { mode: Mode }) {
  const { user, notice, login, register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const isRegister = mode === 'register'

  if (user) {
    return <Navigate to={from} replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrors([])
    setSubmitting(true)
    try {
      if (isRegister) {
        await register(name, email, password)
      } else {
        await login(email, password)
      }
      navigate(from, { replace: true })
    } catch (err) {
      setErrors(err instanceof ApiError ? err.messages : [(err as Error).message])
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-card">
      <h1>{isRegister ? 'Create your account' : 'Welcome back'}</h1>
      <p className="muted">
        {isRegister
          ? 'Sign up to save your cart and check out.'
          : 'Log in to see your cart and orders.'}
      </p>

      {notice && !isRegister && (
        <div className="alert alert-info" role="status">
          {notice}
        </div>
      )}
      {errors.length > 0 && (
        <div className="alert alert-error" role="alert">
          {errors.length === 1 ? (
            errors[0]
          ) : (
            <ul>
              {errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="form">
        {isRegister && (
          <label>
            Name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              maxLength={100}
              required
            />
          </label>
        )}
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            minLength={isRegister ? 8 : undefined}
            maxLength={72}
            required
          />
          {isRegister && <span className="hint">At least 8 characters.</span>}
        </label>
        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Please wait…' : isRegister ? 'Create account' : 'Log in'}
        </button>
      </form>

      <p className="auth-switch">
        {isRegister ? 'Already have an account? ' : 'New here? '}
        <Link to={isRegister ? '/login' : '/register'} state={location.state}>
          {isRegister ? 'Log in' : 'Create an account'}
        </Link>
      </p>
    </div>
  )
}
