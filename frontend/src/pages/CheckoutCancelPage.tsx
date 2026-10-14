import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useAuth } from '../auth/auth-context'
import type { Order } from '../types'

export function CheckoutCancelPage() {
  const [params] = useSearchParams()
  const orderId = params.get('order_id')
  const { request } = useAuth()
  const [order, setOrder] = useState<Order | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!orderId) return
    let cancelled = false

    // Expires the Stripe session so the abandoned order can no longer be paid.
    request<Order>(`/api/checkout/${orderId}/cancel`, { method: 'POST' })
      .then((result) => {
        if (!cancelled) setOrder(result)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError((err as Error).message)
      })

    return () => {
      cancelled = true
    }
  }, [orderId, request])

  if (order?.status === 'PAID') {
    return (
      <div className="empty-state">
        <h1>Your order is already paid</h1>
        <p>The payment went through before the checkout was cancelled.</p>
        <Link to="/orders" className="btn btn-primary">
          View my orders
        </Link>
      </div>
    )
  }

  return (
    <div className="empty-state">
      <h1>Checkout cancelled</h1>
      <p>{error || 'No payment was taken. Your cart is still saved.'}</p>
      <Link to="/cart" className="btn btn-primary">
        Back to cart
      </Link>
    </div>
  )
}
