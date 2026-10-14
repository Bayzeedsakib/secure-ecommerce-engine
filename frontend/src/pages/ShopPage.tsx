import { useEffect, useMemo, useState } from 'react'
import { apiRequest, isAbortError } from '../api/client'
import { ProductCard } from '../components/ProductCard'
import type { Product } from '../types'

const ALL = 'All'

export function ShopPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [category, setCategory] = useState(ALL)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    apiRequest<Product[]>('/api/products', { signal: controller.signal })
      .then(setProducts)
      .catch((err: unknown) => {
        if (!isAbortError(err)) setError((err as Error).message)
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [])

  const categories = useMemo(
    () => [ALL, ...new Set(products.map((product) => product.category))],
    [products],
  )

  const visible = products.filter(
    (product) =>
      (category === ALL || product.category === category) &&
      product.name.toLowerCase().includes(search.trim().toLowerCase()),
  )

  return (
    <>
      <section className="hero">
        <h1>Gear for work and play</h1>
        <p>Your cart is saved to your account, and checkout is handled securely by Stripe.</p>
      </section>

      <div className="toolbar">
        <div className="chips" role="tablist" aria-label="Categories">
          {categories.map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={category === name}
              className={`chip${category === name ? ' is-active' : ''}`}
              onClick={() => setCategory(name)}
            >
              {name}
            </button>
          ))}
        </div>
        <input
          type="search"
          className="search"
          placeholder="Search products"
          aria-label="Search products"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {loading && <p className="muted">Loading products…</p>}
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}
      {!loading && !error && visible.length === 0 && (
        <p className="muted">No products match your search.</p>
      )}

      <div className="product-grid">
        {visible.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </>
  )
}
