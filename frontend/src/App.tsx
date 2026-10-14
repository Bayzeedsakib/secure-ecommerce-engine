import { BrowserRouter, Link, Route, Routes } from 'react-router'
import { AuthProvider } from './auth/AuthProvider'
import { CartProvider } from './cart/CartProvider'
import { Layout } from './components/Layout'
import { RequireAuth } from './components/RequireAuth'
import { AdminPage } from './pages/AdminPage'
import { AuthPage } from './pages/AuthPage'
import { CartPage } from './pages/CartPage'
import { CheckoutCancelPage } from './pages/CheckoutCancelPage'
import { CheckoutSuccessPage } from './pages/CheckoutSuccessPage'
import { OrdersPage } from './pages/OrdersPage'
import { ShopPage } from './pages/ShopPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<ShopPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="login" element={<AuthPage mode="login" />} />
        <Route path="register" element={<AuthPage mode="register" />} />
        <Route
          path="checkout/success"
          element={
            <RequireAuth>
              <CheckoutSuccessPage />
            </RequireAuth>
          }
        />
        <Route
          path="checkout/cancel"
          element={
            <RequireAuth>
              <CheckoutCancelPage />
            </RequireAuth>
          }
        />
        <Route
          path="orders"
          element={
            <RequireAuth>
              <OrdersPage />
            </RequireAuth>
          }
        />
        <Route
          path="admin"
          element={
            <RequireAuth role="ADMIN">
              <AdminPage />
            </RequireAuth>
          }
        />
        <Route
          path="*"
          element={
            <div className="empty-state">
              <h1>Page not found</h1>
              <Link to="/" className="btn btn-primary">
                Back to the shop
              </Link>
            </div>
          }
        />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  )
}
