import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  cartOf,
  makeProduct,
  mockFetch,
  renderApp,
  storeSession,
  TOKEN,
  USER,
  type FakeRequest,
} from './test/utils'
import type { Order } from './types'

const headphones = makeProduct()
const lamp = makeProduct({ id: 'prod-2', name: 'Desk Lamp', priceCents: 2499, stock: 1, category: 'Home' })

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: 'a1b2c3d4-0000-4000-8000-000000000000',
    status: 'PAID',
    totalCents: 8999,
    currency: 'usd',
    items: [{ productId: headphones.id, name: headphones.name, priceCents: 8999, quantity: 1 }],
    paidAt: '2026-10-16T10:00:00.000Z',
    failureReason: null,
    createdAt: '2026-10-16T09:59:00.000Z',
    expiresAt: '2026-10-16T10:30:00.000Z',
    ...overrides,
  }
}

describe('shop and guest cart', () => {
  it('lists products and keeps a guest cart in the browser across reloads', async () => {
    mockFetch(({ path }) => (path === '/api/products' ? [200, [headphones, lamp]] : [404, {}]))
    const user = userEvent.setup()
    const { unmount } = renderApp('/')

    const card = (await screen.findByRole('heading', { name: 'Wireless Headphones' })).closest('article')!
    await user.click(within(card).getByRole('button', { name: 'Add to cart' }))

    expect(screen.getByLabelText('1 items in cart')).toBeInTheDocument()
    expect(within(card).getByText('1 in your cart')).toBeInTheDocument()

    // A "reload": the cart comes back from localStorage.
    unmount()
    renderApp('/cart')
    expect(await screen.findByRole('heading', { name: 'Your cart' })).toBeInTheDocument()
    expect(screen.getByText('Wireless Headphones')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Log in to checkout' })).toBeInTheDocument()
  })

  it('does not let a guest add more than is in stock', async () => {
    mockFetch(({ path }) => (path === '/api/products' ? [200, [lamp]] : [404, {}]))
    const user = userEvent.setup()
    renderApp('/')

    const card = (await screen.findByRole('heading', { name: 'Desk Lamp' })).closest('article')!
    await user.click(within(card).getByRole('button', { name: 'Add to cart' }))

    expect(within(card).getByRole('button', { name: 'All in cart' })).toBeDisabled()
    expect(within(card).getByText('Only 1 left')).toBeInTheDocument()
  })
})

describe('login', () => {
  it('shows the server validation messages', async () => {
    mockFetch(() => [401, { statusCode: 401, message: 'Invalid email or password' }])
    const user = userEvent.setup()
    renderApp('/login')

    await user.type(screen.getByLabelText('Email'), 'ada@example.com')
    await user.type(screen.getByLabelText('Password'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password')
  })

  it('merges the guest cart into the saved cart after logging in', async () => {
    localStorage.setItem(
      'shop-guest-cart',
      JSON.stringify([{ product: headphones, quantity: 2 }]),
    )
    const requests: FakeRequest[] = []
    mockFetch((request) => {
      requests.push(request)
      if (request.path === '/api/auth/login') return [200, { token: TOKEN, user: USER }]
      if (request.path === '/api/cart/merge') {
        return [201, cartOf([{ product: headphones, quantity: 2 }, { product: lamp, quantity: 1 }])]
      }
      return [404, {}]
    })
    const user = userEvent.setup()
    renderApp('/login')

    await user.type(screen.getByLabelText('Email'), 'ada@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct-horse')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    await waitFor(() => expect(screen.getByLabelText('3 items in cart')).toBeInTheDocument())
    const merge = requests.filter((request) => request.path === '/api/cart/merge')
    expect(merge).toHaveLength(1)
    expect(merge[0].body).toEqual({ items: [{ productId: headphones.id, quantity: 2 }] })
    expect(merge[0].headers.Authorization).toBe(`Bearer ${TOKEN}`)
    expect(localStorage.getItem('shop-guest-cart')).toBeNull()
  })
})

describe('checkout', () => {
  it('sends a logged-in customer to the Stripe checkout page', async () => {
    storeSession()
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })
    mockFetch(({ method, path }) => {
      if (path === '/api/cart') return [200, cartOf([{ product: headphones, quantity: 1 }])]
      if (method === 'POST' && path === '/api/checkout') {
        return [201, { orderId: 'order-1', checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_1' }]
      }
      return [404, {}]
    })
    const user = userEvent.setup()
    renderApp('/cart')

    await user.click(await screen.findByRole('button', { name: 'Checkout securely' }))

    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_test_1'),
    )
  })

  it('shows a stock error from the server instead of redirecting', async () => {
    storeSession()
    mockFetch(({ method, path }) => {
      if (path === '/api/cart') return [200, cartOf([{ product: headphones, quantity: 1 }])]
      if (method === 'POST' && path === '/api/checkout') {
        return [409, { statusCode: 409, message: '"Wireless Headphones" is out of stock' }]
      }
      return [404, {}]
    })
    const user = userEvent.setup()
    renderApp('/cart')

    await user.click(await screen.findByRole('button', { name: 'Checkout securely' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('is out of stock')
  })

  it('confirms the payment on the success page', async () => {
    storeSession()
    const requests: FakeRequest[] = []
    mockFetch((request) => {
      requests.push(request)
      if (request.path === '/api/checkout/confirm') return [200, order()]
      if (request.path === '/api/cart') return [200, cartOf([])]
      return [404, {}]
    })
    renderApp('/checkout/success?session_id=cs_test_abc')

    expect(
      await screen.findByRole('heading', { name: 'Thank you! Your order is confirmed.' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Paid')).toBeInTheDocument()
    expect(requests.find((request) => request.path === '/api/checkout/confirm')?.body).toEqual({
      sessionId: 'cs_test_abc',
    })
  })

  it('explains a refund when an item sold out during payment', async () => {
    storeSession()
    mockFetch(({ path }) => {
      if (path === '/api/checkout/confirm') {
        return [
          200,
          order({
            status: 'REFUNDED',
            failureReason: '"Wireless Headphones" sold out before the payment completed. Your payment has been refunded.',
          }),
        ]
      }
      if (path === '/api/cart') return [200, cartOf([])]
      return [404, {}]
    })
    renderApp('/checkout/success?session_id=cs_test_abc')

    expect(
      await screen.findByRole('heading', { name: 'Sorry, an item sold out while you were paying.' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Your payment has been refunded/)).toBeInTheDocument()
  })

  it('logs the user out when the token has expired', async () => {
    storeSession()
    mockFetch(() => [401, { statusCode: 401, message: 'Invalid or expired token' }])
    renderApp('/orders')

    expect(
      await screen.findByText('Your session has expired. Please log in again.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  })
})

describe('admin', () => {
  it('is only reachable by admins', async () => {
    storeSession()
    mockFetch(({ path }) => (path === '/api/cart' ? [200, cartOf([])] : [404, {}]))
    renderApp('/admin')

    expect(await screen.findByRole('heading', { name: 'Not allowed' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument()
  })
})
