import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/auth-context'
import { StatusBadge } from '../components/StatusBadge'
import { formatDate, formatMoney } from '../format'
import type { AdminOrder, Product, ProductInput } from '../types'

type Tab = 'products' | 'orders'

const EMPTY_FORM = { name: '', description: '', price: '', stock: '', category: '', imageUrl: '' }

function errorText(err: unknown) {
  return err instanceof ApiError ? err.messages.join(' ') : (err as Error).message
}

export function AdminPage() {
  const [tab, setTab] = useState<Tab>('products')

  return (
    <div>
      <h1>Store admin</h1>
      <div className="tabs" role="tablist">
        {(['products', 'orders'] as const).map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            className={`tab${tab === name ? ' is-active' : ''}`}
            onClick={() => setTab(name)}
          >
            {name === 'products' ? 'Products & stock' : 'Orders'}
          </button>
        ))}
      </div>
      {tab === 'products' ? <ProductsAdmin /> : <OrdersAdmin />}
    </div>
  )
}

function ProductsAdmin() {
  const { request } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [error, setError] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const load = useCallback(
    () => request<Product[]>('/api/admin/products').then(setProducts, (err) => setError(errorText(err))),
    [request],
  )

  useEffect(() => {
    void load()
  }, [load])

  async function update(product: Product, changes: Partial<ProductInput>) {
    setError('')
    try {
      const updated = await request<Product>(`/api/admin/products/${product.id}`, {
        method: 'PATCH',
        body: changes,
      })
      setProducts((list) => list.map((item) => (item.id === updated.id ? updated : item)))
    } catch (err) {
      setError(errorText(err))
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      await request<Product>('/api/admin/products', {
        method: 'POST',
        body: {
          name: form.name,
          description: form.description,
          priceCents: Math.round(Number(form.price) * 100),
          stock: Number(form.stock),
          category: form.category || undefined,
          imageUrl: form.imageUrl,
        },
      })
      setForm(EMPTY_FORM)
      await load()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setSaving(false)
    }
  }

  const field = (name: keyof typeof EMPTY_FORM) => ({
    value: form[name],
    onChange: (event: { target: { value: string } }) =>
      setForm((current) => ({ ...current, [name]: event.target.value })),
  })

  return (
    <>
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Status</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className={product.active ? '' : 'is-archived'}>
                <td>
                  <div className="cell-title">{product.name}</div>
                  <div className="muted small">{product.category}</div>
                </td>
                <td>{formatMoney(product.priceCents)}</td>
                <td>
                  {/* Keyed by stock so the input resets after a save. */}
                  <StockEditor
                    key={product.stock}
                    product={product}
                    onSave={(stock) => update(product, { stock })}
                  />
                </td>
                <td>{product.active ? 'For sale' : 'Archived'}</td>
                <td>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => update(product, { active: !product.active })}
                  >
                    {product.active ? 'Archive' : 'Restore'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form className="form admin-form" onSubmit={handleCreate}>
        <h2>Add a product</h2>
        <div className="form-grid">
          <label>
            Name
            <input {...field('name')} required maxLength={120} />
          </label>
          <label>
            Category
            <input {...field('category')} maxLength={60} placeholder="General" />
          </label>
          <label>
            Price (USD)
            <input {...field('price')} type="number" min="0.5" step="0.01" required />
          </label>
          <label>
            Stock
            <input {...field('stock')} type="number" min="0" step="1" required />
          </label>
          <label className="span-2">
            Image URL (https)
            <input {...field('imageUrl')} type="url" placeholder="https://…" />
          </label>
          <label className="span-2">
            Description
            <textarea {...field('description')} rows={3} maxLength={2000} />
          </label>
        </div>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Add product'}
        </button>
      </form>
    </>
  )
}

function StockEditor({ product, onSave }: { product: Product; onSave: (stock: number) => void }) {
  const [value, setValue] = useState(String(product.stock))
  const changed = value !== String(product.stock) && value !== ''

  return (
    <form
      className="stock-editor"
      onSubmit={(event) => {
        event.preventDefault()
        onSave(Number(value))
      }}
    >
      <input
        type="number"
        min="0"
        step="1"
        value={value}
        aria-label={`Stock for ${product.name}`}
        onChange={(event) => setValue(event.target.value)}
      />
      {changed && (
        <button type="submit" className="btn btn-primary btn-sm">
          Save
        </button>
      )}
    </form>
  )
}

function OrdersAdmin() {
  const { request } = useAuth()
  const [orders, setOrders] = useState<AdminOrder[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    request<AdminOrder[]>('/api/admin/orders').then(setOrders, (err) => setError(errorText(err)))
  }, [request])

  if (error) {
    return (
      <div className="alert alert-error" role="alert">
        {error}
      </div>
    )
  }
  if (!orders) return <p className="muted">Loading orders…</p>
  if (orders.length === 0) return <p className="muted">No orders yet.</p>

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Customer</th>
            <th>Items</th>
            <th>Total</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td>
                <div className="cell-title">#{order.id.slice(0, 8).toUpperCase()}</div>
                <div className="muted small">{formatDate(order.createdAt)}</div>
              </td>
              <td>
                <div>{order.customer.name}</div>
                <div className="muted small">{order.customer.email}</div>
              </td>
              <td className="small">
                {order.items.map((item) => `${item.name} × ${item.quantity}`).join(', ')}
              </td>
              <td>{formatMoney(order.totalCents, order.currency)}</td>
              <td>
                <StatusBadge status={order.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
