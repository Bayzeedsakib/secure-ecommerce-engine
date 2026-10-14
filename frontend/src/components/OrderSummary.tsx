import { formatDate, formatMoney } from '../format'
import type { Order } from '../types'
import { StatusBadge } from './StatusBadge'

export function OrderSummary({ order }: { order: Order }) {
  return (
    <article className="order-card">
      <header className="order-header">
        <div>
          <div className="order-id">Order #{order.id.slice(0, 8).toUpperCase()}</div>
          <div className="muted small">{formatDate(order.createdAt)}</div>
        </div>
        <StatusBadge status={order.status} />
      </header>
      <ul className="order-items">
        {order.items.map((item) => (
          <li key={item.productId}>
            <span>
              {item.name} × {item.quantity}
            </span>
            <span>{formatMoney(item.priceCents * item.quantity, order.currency)}</span>
          </li>
        ))}
      </ul>
      <footer className="order-footer">
        <span>Total</span>
        <strong>{formatMoney(order.totalCents, order.currency)}</strong>
      </footer>
      {order.failureReason && order.status !== 'PAID' && (
        <p className="muted small order-note">{order.failureReason}</p>
      )}
    </article>
  )
}
