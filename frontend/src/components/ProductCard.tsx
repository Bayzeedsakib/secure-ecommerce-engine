import { useState } from 'react'
import { useCart } from '../cart/cart-context'
import { formatMoney } from '../format'
import type { Product } from '../types'

const LOW_STOCK = 5

export function ProductCard({ product }: { product: Product }) {
  const { cart, addToCart } = useCart()
  const [adding, setAdding] = useState(false)
  const inCart = cart.items.find((line) => line.product.id === product.id)?.quantity ?? 0
  const soldOut = product.stock === 0
  const maxedOut = !soldOut && inCart >= product.stock

  async function handleAdd() {
    setAdding(true)
    try {
      await addToCart(product)
    } finally {
      setAdding(false)
    }
  }

  return (
    <article className="product-card">
      <div className="product-image">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt="" loading="lazy" />
        ) : (
          <div className="image-placeholder" aria-hidden="true">
            ◆
          </div>
        )}
        <span className="product-category">{product.category}</span>
      </div>
      <div className="product-body">
        <h2 className="product-name">{product.name}</h2>
        <p className="product-description">{product.description}</p>
        <div className="product-footer">
          <div>
            <div className="price">{formatMoney(product.priceCents)}</div>
            <div className={`stock${soldOut ? ' stock-out' : product.stock <= LOW_STOCK ? ' stock-low' : ''}`}>
              {soldOut
                ? 'Sold out'
                : product.stock <= LOW_STOCK
                  ? `Only ${product.stock} left`
                  : `${product.stock} in stock`}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={soldOut || maxedOut || adding}
            onClick={handleAdd}
          >
            {soldOut ? 'Sold out' : maxedOut ? 'All in cart' : adding ? 'Adding…' : 'Add to cart'}
          </button>
        </div>
        {inCart > 0 && <p className="in-cart">{inCart} in your cart</p>}
      </div>
    </article>
  )
}
