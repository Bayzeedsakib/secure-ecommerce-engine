import type { CartLine, Session } from './types'

const SESSION_KEY = 'shop-session'
const GUEST_CART_KEY = 'shop-guest-cart'

// A snapshot of the product is kept for display only. Prices and stock are
// re-read from the server when the cart is merged at login, before checkout.
export interface GuestCartItem {
  product: CartLine['product']
  quantity: number
}

// Storage can be unavailable (private mode, blocked site data), so every
// access is guarded and the app still works for the current page load.
function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Not persisted; only lasts until the page is reloaded.
  }
}

function remove(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    // Nothing to remove.
  }
}

export function loadSession(): Session | null {
  const session = read<Session>(SESSION_KEY)
  return session?.token && session.user ? session : null
}

export const saveSession = (session: Session) => write(SESSION_KEY, session)
export const clearSession = () => remove(SESSION_KEY)

// Visitors who are not logged in keep their cart in the browser; it is
// merged into their saved cart when they log in.
export function loadGuestCart(): GuestCartItem[] {
  const items = read<GuestCartItem[]>(GUEST_CART_KEY)
  return Array.isArray(items)
    ? items.filter((item) => typeof item?.product?.id === 'string' && item.quantity > 0)
    : []
}

export const saveGuestCart = (items: GuestCartItem[]) => write(GUEST_CART_KEY, items)
export const clearGuestCart = () => remove(GUEST_CART_KEY)
