import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

const persistentSessionKey = 'rememberSession'
const sessionScopeKey = 'sessionScopedLogin'

// This page is used as the return destination after the user clicks the email confirmation link.
export default function AuthConfirmed() {
  // Lets us send the user back to the login page after confirmation finishes.
  const navigate = useNavigate()

  // Runs once when the page loads so we can finish the confirmation flow automatically.
  useEffect(() => {
    // Clears the temporary local session and forwards the user to the login page with a success flag.
    const finishConfirmation = async () => {
      window.localStorage.removeItem(persistentSessionKey)
      window.sessionStorage.removeItem(sessionScopeKey)
      await supabase.auth.signOut({ scope: 'local' })
      navigate('/login?confirmed=true', { replace: true })
    }

    finishConfirmation()
  }, [navigate])

  return <p>Confirming your email...</p>
}
