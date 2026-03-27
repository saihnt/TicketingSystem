import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { supabase } from './supabaseClient'
import AdminDashboard from './pages/adminDashboard'
import AuthConfirmed from './pages/authConfirmed'
import LoginPage from './pages/loginPage'
import SignUp from './pages/signUp'
import UserDashboard from './pages/userDashboard'

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
    // Fetches the current session that Supabase may already have stored locally.
    const loadSession = async () => {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession()

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
