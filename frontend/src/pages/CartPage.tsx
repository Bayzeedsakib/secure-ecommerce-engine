import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../auth/auth-context'
import { MAX_QUANTITY_PER_ITEM, useCart } from '../cart/cart-context'
import { QuantityControl } from '../components/QuantityControl'
import { formatMoney } from '../format'

export function CartPage() {
  const { user, request } = useAuth()
  const { cart, loading, setQuantity, removeItem } = useCart()
  const navigate = useNavigate()
  const [checkingOut, setCheckingOut] = useState(false)
  const [error, setError] = useState('')

  async function handleCheckout() {
    if (!user) {
      navigate('/login', { state: { from: '/cart' } })
      return
    }

    setError('')
    setCheckingOut(true)
    try {
      const { checkoutUrl } = await request<{ orderId: string; checkoutUrl: string }>(
        '/api/checkout',
        { method: 'POST' },
      )
      // Hand over to the Stripe-hosted payment page.
      window.location.assign(checkoutUrl)
    } catch (err) {
      setError((err as Error).message)
      setCheckingOut(false)
    }
  }

  if (cart.items.length === 0) {
    return (
      <div className="empty-state">
        <h1>Your cart is empty</h1>
        <p>{loading ? 'Loading your cart…' : 'Browse the shop and add something you like.'}</p>
        <Link to="/" className="btn btn-primary">
          Go shopping
        </Link>
      </div>
    )
  }

  return (
    <div className="cart-layout">
      <section>
        <h1>Your cart</h1>
        <ul className="cart-list">
          {cart.items.map(({ product, quantity, lineTotalCents }) => (
            <li key={product.id} className="cart-item">
              {product.imageUrl ? (
                <img src={product.imageUrl} alt="" className="cart-thumb" />
              ) : (
                <div className="cart-thumb image-placeholder" aria-hidden="true">
                  ◆
                </div>
              )}
              <div className="cart-item-info">
                <h2>{product.name}</h2>
                <p className="muted">{formatMoney(product.priceCents)} each</p>
                {quantity > product.stock && (
                  <p className="stock stock-out">Only {product.stock} left in stock</p>
                )}
              </div>
              <QuantityControl
                value={quantity}
                max={Math.min(product.stock, MAX_QUANTITY_PER_ITEM)}
                label={product.name}
                onChange={(next) => setQuantity(product, next)}
              />
              <div className="cart-line-total">{formatMoney(lineTotalCents)}</div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => removeItem(product.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>

      <aside className="summary">
        <h2>Order summary</h2>
        <dl>
          <div>
            <dt>Items</dt>
            <dd>{cart.itemCount}</dd>
          </div>
          <div className="summary-total">
            <dt>Total</dt>
            <dd>{formatMoney(cart.subtotalCents)}</dd>
          </div>
        </dl>
        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={checkingOut || loading}
          onClick={handleCheckout}
        >
          {checkingOut ? 'Redirecting to Stripe…' : user ? 'Checkout securely' : 'Log in to checkout'}
        </button>
        <p className="muted small">
          You will be redirected to Stripe&apos;s secure payment page (test mode).
        </p>
      </aside>
    </div>
  )
}
