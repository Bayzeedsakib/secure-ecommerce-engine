import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useAuth } from '../auth/auth-context'
import { useCart } from '../cart/cart-context'
import { OrderSummary } from '../components/OrderSummary'
import type { Order } from '../types'

// Some payment methods take a moment to settle, so a still-pending order is
// checked again a few times before giving up.
const RETRY_DELAY_MS = 2000
const MAX_ATTEMPTS = 5

export function CheckoutSuccessPage() {
  const [params] = useSearchParams()
  const sessionId = params.get('session_id')
  const { request } = useAuth()
  const { reload } = useCart()
  const [order, setOrder] = useState<Order | null>(null)
  const [error, setError] = useState(sessionId ? '' : 'Missing payment session.')

  useEffect(() => {
    if (!sessionId) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    // Confirming is idempotent on the server: calling it again (or alongside
    // the Stripe webhook) never deducts stock twice.
    async function confirm(attempt: number) {
      try {
        const result = await request<Order>('/api/checkout/confirm', {
          method: 'POST',
          body: { sessionId },
        })
        if (cancelled) return
        setOrder(result)
        if (result.status === 'PAID') {
          await reload()
        } else if (result.status === 'PENDING' && attempt < MAX_ATTEMPTS) {
          timer = setTimeout(() => confirm(attempt + 1), RETRY_DELAY_MS)
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message)
      }
    }

    void confirm(1)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [sessionId, request, reload])

  if (error) {
    return (
      <div className="empty-state">
        <h1>We could not confirm your payment</h1>
        <p>{error}</p>
        <Link to="/orders" className="btn btn-primary">
          View my orders
        </Link>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="empty-state">
        <h1>Confirming your payment…</h1>
        <p className="muted">This only takes a moment.</p>
      </div>
    )
  }

  const headline = {
    PAID: 'Thank you! Your order is confirmed.',
    PENDING: 'Your payment is being processed.',
    REFUNDED: 'Sorry, an item sold out while you were paying.',
    CANCELLED: 'This order was cancelled.',
  }[order.status]

  return (
    <div className="narrow">
      <h1>{headline}</h1>
      {order.status === 'PAID' && (
        <p className="muted">Your payment was received and the purchased items were removed from your cart.</p>
      )}
      {order.status === 'PENDING' && (
        <p className="muted">Check your orders page again in a minute.</p>
      )}
      <OrderSummary order={order} />
      <div className="actions">
        <Link to="/orders" className="btn btn-primary">
          View my orders
        </Link>
        <Link to="/" className="btn btn-ghost">
          Continue shopping
        </Link>
      </div>
    </div>
  )
}
