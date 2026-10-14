export type Role = 'CUSTOMER' | 'ADMIN'

export interface User {
  id: string
  name: string
  email: string
  role: Role
}

export interface Session {
  token: string
  user: User
}

export interface Product {
  id: string
  name: string
  description: string
  priceCents: number
  imageUrl: string
  category: string
  stock: number
  active: boolean
}

export interface CartLine {
  product: Pick<Product, 'id' | 'name' | 'priceCents' | 'imageUrl' | 'stock'>
  quantity: number
  lineTotalCents: number
}

export interface Cart {
  items: CartLine[]
  itemCount: number
  subtotalCents: number
}

export type OrderStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'REFUNDED'

export interface Order {
  id: string
  status: OrderStatus
  totalCents: number
  currency: string
  items: { productId: string; name: string; priceCents: number; quantity: number }[]
  paidAt: string | null
  failureReason: string | null
  createdAt: string
  expiresAt: string
}

export interface AdminOrder extends Order {
  customer: { name: string; email: string }
}

export type ProductInput = Omit<Product, 'id'>
