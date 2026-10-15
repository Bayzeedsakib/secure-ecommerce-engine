import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'
import { AppRoutes } from '../App'
import { AuthProvider } from '../auth/AuthProvider'
import { CartProvider } from '../cart/CartProvider'
import type { Cart, Product, User } from '../types'

export interface FakeRequest {
  method: string
  path: string
  body: unknown
  headers: Record<string, string>
}

type Handler = (request: FakeRequest) => [number, unknown] | Promise<[number, unknown]>

// Replaces fetch with a handler that receives the request and returns
// [status, body], so components talk to a fake API.
export function mockFetch(handler: Handler) {
  const fetchMock = vi.fn(async (url: string, options: RequestInit = {}) => {
    const request: FakeRequest = {
      method: options.method ?? 'GET',
      path: new URL(url, 'http://localhost').pathname,
      body: options.body ? JSON.parse(String(options.body)) : undefined,
      headers: (options.headers as Record<string, string>) ?? {},
    }
    const [status, body] = await handler(request)
    return new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

export function renderApp(path = '/') {
  return render(
    <AuthProvider>
      <CartProvider>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </CartProvider>
    </AuthProvider>,
  )
}

export const USER: User = {
  id: 'user-1',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  role: 'CUSTOMER',
}

export const TOKEN = 'test-token'

export function storeSession(user: User = USER) {
  localStorage.setItem('shop-session', JSON.stringify({ token: TOKEN, user }))
}

export function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1',
    name: 'Wireless Headphones',
    description: 'Noise cancelling',
    priceCents: 8999,
    imageUrl: '',
    category: 'Audio',
    stock: 5,
    active: true,
    ...overrides,
  }
}

export function cartOf(lines: { product: Product; quantity: number }[]): Cart {
  const items = lines.map(({ product, quantity }) => ({
    product,
    quantity,
    lineTotalCents: product.priceCents * quantity,
  }))
  return {
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotalCents: items.reduce((sum, item) => sum + item.lineTotalCents, 0),
  }
}
