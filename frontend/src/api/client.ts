// Empty by default: requests go to the same origin and the Vite dev server
// proxies /api to the backend. Set VITE_API_URL when the API lives elsewhere.
const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')

export const NETWORK_ERROR_MESSAGE =
  'Unable to reach the server. Check that the backend is running and try again.'

export class ApiError extends Error {
  readonly status: number
  readonly messages: string[]

  constructor(messages: string[], status: number) {
    super(messages.join('. '))
    this.name = 'ApiError'
    this.status = status
    this.messages = messages
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  token?: string
  signal?: AbortSignal
}

async function readJson(response: Response): Promise<unknown> {
  if (!(response.headers.get('Content-Type') ?? '').includes('application/json')) {
    return null
  }
  try {
    return await response.json()
  } catch {
    return null
  }
}

// NestJS returns validation errors as an array of messages and every other
// error as a single string.
function errorMessages(data: unknown, status: number): string[] {
  const message = (data as { message?: unknown } | null)?.message
  if (Array.isArray(message) && message.length > 0) {
    return message.map(String)
  }
  if (typeof message === 'string' && message) {
    return [message]
  }
  return [`Request failed with status ${status}`]
}

export async function apiRequest<T>(
  path: string,
  { method = 'GET', body, token, signal }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw error
    }
    throw new ApiError([NETWORK_ERROR_MESSAGE], 0)
  }

  const data = await readJson(response)

  if (!response.ok) {
    throw new ApiError(errorMessages(data, response.status), response.status)
  }

  return data as T
}

export function isAbortError(error: unknown): boolean {
  return (error as Error | null)?.name === 'AbortError'
}
