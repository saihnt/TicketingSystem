import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { supabase } from './supabaseClient'
import AdminDashboard from './pages/adminDashboard'
import AuthConfirmed from './pages/authConfirmed'
import LoginPage from './pages/loginPage'
import SignUp from './pages/signUp'
import UserDashboard from './pages/userDashboard'

const persistentSessionKey = 'rememberSession'
const sessionScopeKey = 'sessionScopedLogin'

// This wrapper blocks users from visiting routes they are not allowed to access.
function ProtectedRoute({ session, allowedRoles, children }) {
  if (!session) {
    return <Navigate to="/login" replace />
  }

  // Reads the signed-in user's role from Supabase metadata.
  const userRole = session.user?.user_metadata?.role ?? 'user'

  if (!allowedRoles.includes(userRole)) {
    return <Navigate to={userRole === 'admin' ? '/admin' : '/dashboard'} replace />
  }

  return children
}

// This is the root component that loads the auth session and defines all routes.
export default function App() {
  // Stores the current Supabase session so the app knows who is logged in.
  const [session, setSession] = useState(null)
  // Prevents the app from rendering auth-protected routes before the session is checked.
  const [isLoadingSession, setIsLoadingSession] = useState(true)

  // Loads the existing session once and listens for future login/logout changes.
  useEffect(() => {
    const getNavigationType = () => {
      const navigationEntry = window.performance
        .getEntriesByType('navigation')
        .find((entry) => entry.entryType === 'navigation')

      if (navigationEntry && 'type' in navigationEntry) {
        return navigationEntry.type
      }

      return 'navigate'
    }

    // Fetches the current session that Supabase may already have stored locally.
    const loadSession = async () => {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession()

      const shouldRememberSession = window.localStorage.getItem(persistentSessionKey) === 'true'
      const hasActiveSessionScope = window.sessionStorage.getItem(sessionScopeKey) === 'true'
      const navigationType = getNavigationType()

      // Non-persistent logins are allowed only during the in-memory app lifetime.
      // A browser reload should clear them even if sessionStorage still exists.
      if (currentSession && !shouldRememberSession && navigationType === 'reload') {
        window.sessionStorage.removeItem(sessionScopeKey)
        await supabase.auth.signOut()
        setSession(null)
        setIsLoadingSession(false)
        return
      }

      // If a browser session was not marked as persistent and the tab session marker is gone,
      // clear the recovered Supabase session so fresh loads after tab close do not restore it.
      if (currentSession && !shouldRememberSession && !hasActiveSessionScope) {
        await supabase.auth.signOut()
        setSession(null)
        setIsLoadingSession(false)
        return
      }

      setSession(currentSession)
      setIsLoadingSession(false)
    }

    loadSession()

    // Keeps the app in sync whenever the auth state changes.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, updatedSession) => {
      setSession(updatedSession)
      setIsLoadingSession(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Shows a temporary loading state while the app checks auth status.
  if (isLoadingSession) {
    return <p>Loading...</p>
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route
          path="/login"
          element={session ? <Navigate to={(session.user?.user_metadata?.role ?? 'user') === 'admin' ? '/admin' : '/dashboard'} replace /> : <LoginPage />}
        />
        <Route
          path="/signup"
          element={session ? <Navigate to={(session.user?.user_metadata?.role ?? 'user') === 'admin' ? '/admin' : '/dashboard'} replace /> : <SignUp />}
        />
        <Route path="/auth/confirmed" element={<AuthConfirmed />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute session={session} allowedRoles={['user']}>
              <UserDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute session={session} allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
