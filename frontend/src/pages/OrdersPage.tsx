import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/auth-context'
import { OrderSummary } from '../components/OrderSummary'
import type { Order } from '../types'

export function OrdersPage() {
  const { request } = useAuth()
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    request<Order[]>('/api/orders')
      .then((result) => {
        if (!cancelled) setOrders(result)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError((err as Error).message)
      })
    return () => {
      cancelled = true
    }
  }, [request])

  if (error) {
    return (
      <div className="alert alert-error" role="alert">
        {error}
      </div>
    )
  }

  if (!orders) {
    return <p className="muted">Loading your orders…</p>
  }

  if (orders.length === 0) {
    return (
      <div className="empty-state">
        <h1>No orders yet</h1>
        <p>When you buy something, it will show up here.</p>
        <Link to="/" className="btn btn-primary">
          Start shopping
        </Link>
      </div>
    )
  }

  return (
    <div className="narrow">
      <h1>My orders</h1>
      <div className="order-list">
        {orders.map((order) => (
          <OrderSummary key={order.id} order={order} />
        ))}
      </div>
    </div>
  )
}
