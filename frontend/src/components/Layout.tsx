import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '../auth/auth-context'
import { useCart } from '../cart/cart-context'

export function Layout() {
  const { user, logout } = useAuth()
  const { cart, error: cartError, clearError } = useCart()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  function handleLogout() {
    logout()
    setMenuOpen(false)
    navigate('/')
  }

  const closeMenu = () => setMenuOpen(false)

  return (
    <div className="app">
      <header className="site-header">
        <div className="container header-inner">
          <Link to="/" className="brand" onClick={closeMenu}>
            <span className="brand-mark" aria-hidden="true">
              ◆
            </span>
            ShopEase
          </Link>

          <button
            type="button"
            className="menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="main-nav"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? 'Close' : 'Menu'}
          </button>

          <nav id="main-nav" className={`main-nav${menuOpen ? ' is-open' : ''}`}>
            <NavLink to="/" end onClick={closeMenu}>
              Shop
            </NavLink>
            {user && (
              <NavLink to="/orders" onClick={closeMenu}>
                My orders
              </NavLink>
            )}
            {user?.role === 'ADMIN' && (
              <NavLink to="/admin" onClick={closeMenu}>
                Admin
              </NavLink>
            )}
            <NavLink to="/cart" className="cart-link" onClick={closeMenu}>
              Cart
              <span className="cart-count" aria-label={`${cart.itemCount} items in cart`}>
                {cart.itemCount}
              </span>
            </NavLink>
            {user ? (
              <div className="user-menu">
                <span className="user-name">Hi, {user.name.split(' ')[0]}</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={handleLogout}>
                  Log out
                </button>
              </div>
            ) : (
              <NavLink to="/login" onClick={closeMenu}>
                Log in
              </NavLink>
            )}
          </nav>
        </div>
      </header>

      <main className="container main">
        {cartError && (
          <div className="alert alert-error" role="alert">
            <span>{cartError}</span>
            <button type="button" className="alert-close" aria-label="Dismiss" onClick={clearError}>
              ×
            </button>
          </div>
        )}
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container">
          Payments run in Stripe test mode. Use card <code>4242 4242 4242 4242</code>, any
          future date and any CVC.
        </div>
      </footer>
    </div>
  )
}
