import { useEffect, useState } from 'react'
import Navbar from './components/Navbar'
import LoginModal from './components/LoginModal'
import Home from './pages/Home/Home'
import Workspace from './pages/Workspace/Workspace'
import { login, getCurrentUser } from './api/auth'
import type { User } from './api/auth'

// TEMP: bypass login to view Dashboard alone. Remove before shipping.
const DEV_BYPASS_LOGIN = true
const DEV_USER: User = {
  id: 'dev',
  firm_id: 'dev',
  first_name: 'Dev',
  last_name: 'User',
  email: 'dev@example.com',
  role: 'admin',
  is_active: true,
  last_login: null,
}

function App() {
  const [user, setUser] = useState<User | null>(DEV_BYPASS_LOGIN ? DEV_USER : null)
  const [checkingSession, setCheckingSession] = useState(!DEV_BYPASS_LOGIN)
  const [showLogin, setShowLogin] = useState(false)

  useEffect(() => {
    if (DEV_BYPASS_LOGIN) return
    const token = localStorage.getItem('access_token')
    if (!token) {
      setCheckingSession(false)
      return
    }

    getCurrentUser(token)
      .then(setUser)
      .catch(() => localStorage.removeItem('access_token'))
      .finally(() => setCheckingSession(false))
  }, [])

  async function handleLogin(email: string, password: string) {
    const token = await login(email, password)
    localStorage.setItem('access_token', token)
    const currentUser = await getCurrentUser(token)
    setUser(currentUser)
    setShowLogin(false)
  }

  function handleLogout() {
    localStorage.removeItem('access_token')
    setUser(null)
  }

  if (checkingSession) {
    return null
  }

  if (user) {
    return <Workspace user={user} onLogout={handleLogout} />
  }

  return (
    <>
      <Navbar onLoginClick={() => setShowLogin(true)} />
      <Home />
      {showLogin && (
        <LoginModal onClose={() => setShowLogin(false)} onSubmit={handleLogin} />
      )}
    </>
  )
}

export default App
