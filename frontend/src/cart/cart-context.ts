import { createContext, useContext } from 'react'
import type { Cart, CartLine } from '../types'

export const MAX_QUANTITY_PER_ITEM = 20

export const EMPTY_CART: Cart = { items: [], itemCount: 0, subtotalCents: 0 }

export interface CartContextValue {
  cart: Cart
  loading: boolean
  // The last cart error (e.g. not enough stock), shown near the cart.
  error: string
  clearError: () => void
  addToCart: (product: CartLine['product'], quantity?: number) => Promise<void>
  setQuantity: (product: CartLine['product'], quantity: number) => Promise<void>
  removeItem: (productId: string) => Promise<void>
  reload: () => Promise<void>
}

export const CartContext = createContext<CartContextValue | null>(null)

export function useCart(): CartContextValue {
  const value = useContext(CartContext)
  if (!value) {
    throw new Error('useCart must be used inside <CartProvider>')
  }
  return value
}
