import { BrowserRouter, Route, Routes } from 'react-router'
import { AuthProvider } from './auth/AuthProvider'
import { AuthPage } from './pages/AuthPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <main className="container main">
          <Routes>
            <Route path="register" element={<AuthPage mode="register" />} />
            <Route path="*" element={<AuthPage mode="login" />} />
          </Routes>
        </main>
      </BrowserRouter>
    </AuthProvider>
  )
}
