import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/auth-context'
import {
  clearGuestCart,
  loadGuestCart,
  saveGuestCart,
  type GuestCartItem,
} from '../storage'
import type { Cart, CartLine } from '../types'
import {
  CartContext,
  EMPTY_CART,
  MAX_QUANTITY_PER_ITEM,
  type CartContextValue,
} from './cart-context'

function guestCartView(items: GuestCartItem[]): Cart {
  const lines = items.map(({ product, quantity }) => ({
    product,
    quantity,
    lineTotalCents: product.priceCents * quantity,
  }))
  return {
    items: lines,
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotalCents: lines.reduce((sum, line) => sum + line.lineTotalCents, 0),
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong'
}

// Logged-in users: the cart lives on the server (persisted in PostgreSQL).
// Visitors: the cart lives in localStorage and is merged into the server
// cart as soon as they log in.
export function CartProvider({ children }: { children: ReactNode }) {
  const { user, request } = useAuth()
  // Tagged with its owner so a previous user's cart is never shown after
  // switching accounts.
  const [server, setServer] = useState<{ userId: string; cart: Cart } | null>(null)
  const [guestItems, setGuestItems] = useState<GuestCartItem[]>(loadGuestCart)
  const [error, setError] = useState('')
  const userId = user?.id
  const serverCart = server && server.userId === userId ? server.cart : null
  const loading = Boolean(userId) && !serverCart

  // The load (and guest-cart merge) for a user is started once and shared, so
  // re-running the effect (e.g. React StrictMode) never merges twice.
  const syncRef = useRef<{ userId: string; promise: Promise<Cart> } | null>(null)

  useEffect(() => {
    if (!userId) {
      syncRef.current = null
      return
    }

    if (syncRef.current?.userId !== userId) {
      const guest = loadGuestCart()
      const promise =
        guest.length > 0
          ? request<Cart>('/api/cart/merge', {
              method: 'POST',
              body: {
                items: guest.map(({ product, quantity }) => ({ productId: product.id, quantity })),
              },
            }).then((cart) => {
              clearGuestCart()
              setGuestItems([])
              return cart
            })
          : request<Cart>('/api/cart')
      syncRef.current = { userId, promise }
    }

    let cancelled = false
    const sync = syncRef.current

    sync.promise
      .then((cart) => {
        if (!cancelled) setServer({ userId, cart })
      })
      .catch((err: unknown) => {
        // Allow a retry on the next login instead of reusing the failure.
        if (syncRef.current === sync) syncRef.current = null
        if (!cancelled) {
          setServer({ userId, cart: EMPTY_CART })
          setError(messageOf(err))
        }
      })

    return () => {
      cancelled = true
    }
  }, [userId, request])

  const updateGuest = useCallback((update: (items: GuestCartItem[]) => GuestCartItem[]) => {
    setGuestItems((items) => {
      const next = update(items)
      saveGuestCart(next)
      return next
    })
  }, [])

  const runServer = useCallback(
    async (call: () => Promise<Cart>) => {
      if (!userId) return
      const save = (cart: Cart) => setServer({ userId, cart })
      setError('')
      try {
        save(await call())
      } catch (err) {
        setError(messageOf(err))
        // Keep the cart on screen in sync with the server after a refusal.
        if (err instanceof ApiError && err.status !== 401) {
          request<Cart>('/api/cart').then(save, () => {})
        }
      }
    },
    [userId, request],
  )

  const setQuantity = useCallback(
    async (product: CartLine['product'], quantity: number) => {
      if (quantity > Math.min(product.stock, MAX_QUANTITY_PER_ITEM)) {
        setError(
          product.stock === 0
            ? `"${product.name}" is out of stock`
            : `Only ${Math.min(product.stock, MAX_QUANTITY_PER_ITEM)} of "${product.name}" can be added`,
        )
        return
      }

      if (!userId) {
        setError('')
        updateGuest((items) =>
          quantity <= 0
            ? items.filter((item) => item.product.id !== product.id)
            : items.some((item) => item.product.id === product.id)
              ? items.map((item) => (item.product.id === product.id ? { product, quantity } : item))
              : [...items, { product, quantity }],
        )
        return
      }

      await runServer(() =>
        quantity <= 0
          ? request<Cart>(`/api/cart/items/${product.id}`, { method: 'DELETE' })
          : request<Cart>(`/api/cart/items/${product.id}`, {
              method: 'PUT',
              body: { quantity },
            }),
      )
    },
    [userId, request, runServer, updateGuest],
  )

  const guestCart = useMemo(() => guestCartView(guestItems), [guestItems])
  const cart = userId ? (serverCart ?? EMPTY_CART) : guestCart

  const addToCart = useCallback(
    async (product: CartLine['product'], quantity = 1) => {
      const current = cart.items.find((line) => line.product.id === product.id)?.quantity ?? 0
      await setQuantity(product, current + quantity)
    },
    [cart, setQuantity],
  )

  const removeItem = useCallback(
    async (productId: string) => {
      const line = cart.items.find((item) => item.product.id === productId)
      if (line) await setQuantity(line.product, 0)
    },
    [cart, setQuantity],
  )

  const reload = useCallback(async () => {
    if (userId) await runServer(() => request<Cart>('/api/cart'))
  }, [userId, request, runServer])

  const clearError = useCallback(() => setError(''), [])

  const value = useMemo<CartContextValue>(
    () => ({ cart, loading, error, clearError, addToCart, setQuantity, removeItem, reload }),
    [cart, loading, error, clearError, addToCart, setQuantity, removeItem, reload],
  )

  return <CartContext value={value}>{children}</CartContext>
}
