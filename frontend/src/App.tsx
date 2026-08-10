import { useCallback, useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import LoginModal from './components/LoginModal'
import Home from './pages/Home/Home'
import Workspace from './pages/Workspace/Workspace'
import ClientPortal from './pages/ClientPortal/ClientPortal'
import Register from './pages/Register/Register'
import ResetPassword from './pages/ResetPassword/ResetPassword'
import AcceptInvite from './pages/AcceptInvite/AcceptInvite'
import AcceptStaffInvite from './pages/AcceptStaffInvite/AcceptStaffInvite'
import OwnerLogin from './pages/OwnerLogin/OwnerLogin'
import OwnerPortal from './pages/OwnerPortal/OwnerPortal'
import { login, getCurrentUser, refreshStaffToken, logoutStaff } from './api/auth'
import { clientLogin, getCurrentContact, refreshClientToken, logoutClient } from './api/clientAuth'
import { ownerLogin, listFirms } from './api/owner'
import { setUnauthorizedHandler, setRefreshHandler } from './api/client'
import type { User } from './api/auth'
import type { ClientContact } from './api/clientAuth'

type Actor =
  | { kind: 'staff'; user: User }
  | { kind: 'client'; contact: ClientContact }
  | { kind: 'owner' }

function App() {
  const [actor, setActor] = useState<Actor | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const navigate = useNavigate()
  const location = useLocation()
  const staffOnly = Boolean((location.state as { staffOnly?: boolean } | null)?.staffOnly)

  const handleLogout = useCallback(() => {
    // Revoke the refresh token server-side so the session can't be silently resumed after
    // logout. Best-effort: fire-and-forget, since the local session is cleared regardless.
    const refreshToken = localStorage.getItem('refresh_token')
    const actorKind = localStorage.getItem('actor_kind')
    if (refreshToken && actorKind === 'staff') logoutStaff(refreshToken).catch(() => {})
    if (refreshToken && actorKind === 'client') logoutClient(refreshToken).catch(() => {})

    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('actor_kind')
    setActor(null)
  }, [])

  // Silently exchanges the stored refresh token for a fresh access token when a request 401s —
  // without this, every session would die the moment the (short-lived) access token expires.
  const refreshSession = useCallback(async (): Promise<string | null> => {
    const refreshToken = localStorage.getItem('refresh_token')
    const actorKind = localStorage.getItem('actor_kind')
    if (!refreshToken) return null

    try {
      if (actorKind === 'staff') {
        const tokens = await refreshStaffToken(refreshToken)
        localStorage.setItem('access_token', tokens.accessToken)
        localStorage.setItem('refresh_token', tokens.refreshToken)
        return tokens.accessToken
      }
      if (actorKind === 'client') {
        const tokens = await refreshClientToken(refreshToken)
        localStorage.setItem('access_token', tokens.accessToken)
        localStorage.setItem('refresh_token', tokens.refreshToken)
        return tokens.accessToken
      }
    } catch {
      return null
    }
    // Owner sessions have no refresh token — a 401 there just means log back in.
    return null
  }, [])

  useEffect(() => {
    setRefreshHandler(refreshSession)
    setUnauthorizedHandler(() => {
      handleLogout()
      navigate('/login')
    })
  }, [refreshSession, handleLogout, navigate])

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      setCheckingSession(false)
      return
    }
    // Pre-existing sessions from before actor_kind existed were always staff.
    const actorKind = localStorage.getItem('actor_kind') ?? 'staff'

    const restore =
      actorKind === 'client'
        ? getCurrentContact(token).then((contact) => setActor({ kind: 'client', contact }))
        : actorKind === 'owner'
          ? listFirms(token).then(() => setActor({ kind: 'owner' }))
          : getCurrentUser(token).then((user) => setActor({ kind: 'staff', user }))

    restore
      .catch(() => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        localStorage.removeItem('actor_kind')
      })
      .finally(() => setCheckingSession(false))
  }, [])

  async function handleLogin(email: string, password: string) {
    // Bottom "Staff Login" footer link — real staff backend login only.
    if (staffOnly) {
      const tokens = await login(email, password)
      localStorage.setItem('access_token', tokens.accessToken)
      localStorage.setItem('refresh_token', tokens.refreshToken)
      localStorage.setItem('actor_kind', 'staff')
      const user = await getCurrentUser(tokens.accessToken)
      setActor({ kind: 'staff', user })
      navigate('/staff/dashboard')
      return
    }

    // Top-of-homepage Login — real client-auth backend login only.
    const tokens = await clientLogin(email, password)
    localStorage.setItem('access_token', tokens.accessToken)
    localStorage.setItem('refresh_token', tokens.refreshToken)
    localStorage.setItem('actor_kind', 'client')
    const contact = await getCurrentContact(tokens.accessToken)
    setActor({ kind: 'client', contact })
    navigate('/client/dashboard')
  }

  async function handleOwnerLogin(secret: string) {
    const ownerToken = await ownerLogin(secret)
    localStorage.setItem('access_token', ownerToken)
    // Owner sessions don't have a refresh token — drop any leftover from a prior staff/client login.
    localStorage.removeItem('refresh_token')
    localStorage.setItem('actor_kind', 'owner')
    setActor({ kind: 'owner' })
    navigate('/owner')
  }

  if (checkingSession) {
    return null
  }

  const homePath = actor?.kind === 'staff' ? '/staff/dashboard' : '/client/dashboard'
  // Only auto-skip the form if the entry point clicked (top = client, bottom = staff)
  // matches the portal you're already logged into — otherwise show the form so you
  // can log into the other portal instead of being bounced back to your current one.
  const expectedKind = staffOnly ? 'staff' : 'client'
  const alreadyInExpectedPortal = actor?.kind === expectedKind

  return (
    <Routes>
      <Route path="/" element={<><Navbar onLoginClick={() => navigate('/login')} /><Home /></>} />
      <Route
        path="/login"
        element={
          alreadyInExpectedPortal ? (
            <Navigate to={homePath} replace />
          ) : (
            <>
              <Navbar onLoginClick={() => {}} />
              <Home />
              <LoginModal onClose={() => navigate('/')} onSubmit={handleLogin} staffOnly={staffOnly} />
            </>
          )
        }
      />
      <Route path="/register" element={<Register />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route path="/accept-staff-invite" element={<AcceptStaffInvite />} />
      <Route
        path="/owner/login"
        element={
          actor?.kind === 'owner' ? <Navigate to="/owner" replace /> : <OwnerLogin onSubmit={handleOwnerLogin} />
        }
      />
      <Route
        path="/owner/*"
        element={
          actor?.kind === 'owner' ? (
            <OwnerPortal onLogout={handleLogout} />
          ) : (
            <Navigate to="/owner/login" replace />
          )
        }
      />
      <Route
        path="/staff/*"
        element={
          actor?.kind === 'staff' ? (
            <Workspace user={actor.user} onLogout={handleLogout} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/client/*"
        element={
          actor?.kind === 'client' ? (
            <ClientPortal
              contact={actor.contact}
              onLogout={handleLogout}
              onContactUpdate={(contact) => setActor({ kind: 'client', contact })}
            />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
