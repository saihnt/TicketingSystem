import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import './loginPageSetup.css'

// This key is the name used when saving the remembered email in the browser.
const rememberedUserKey = 'rememberedUser'

// This object is the starting shape of the login form state.
const initialForm = {
  email: '',
  password: '',
  rememberMe: false,
}

// This component renders the login page and controls the login workflow.
export default function LoginPage() {
  // Stores the current values typed into the login form.
  const [formData, setFormData] = useState(initialForm)
  // Stores feedback shown to the user, such as errors or success messages.
  const [status, setStatus] = useState({ type: '', message: '' })
  // Tracks whether the login request is currently running.
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Lets us send the user to a different route after login.
  const navigate = useNavigate()
  // Lets us read query parameters such as ?confirmed=true from the URL.
  const [searchParams] = useSearchParams()

  // On first load, restore the remembered email if one was saved earlier.
  useEffect(() => {
    const savedUser = window.localStorage.getItem(rememberedUserKey)

    if (!savedUser) {
      return
    }

    try {
      const parsedUser = JSON.parse(savedUser)

      setFormData((currentData) => ({
        ...currentData,
        email: parsedUser.email ?? '',
        rememberMe: Boolean(parsedUser.rememberMe),
      }))
    } catch {
      window.localStorage.removeItem(rememberedUserKey)
    }
  }, [])

  // If the user just came back from confirming their email, show a login message.
  useEffect(() => {
    if (searchParams.get('confirmed') === 'true') {
      setStatus({ type: 'success', message: 'Email confirmed. You can log in now.' })
    }
  }, [searchParams])

  // Updates whichever form field changed, including the remember-me checkbox.
  const handleChange = (event) => {
    const { name, type, checked, value } = event.target

    setFormData((currentData) => ({
      ...currentData,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  // Sends the email/password to Supabase and redirects based on the user's role.
  const handleSubmit = async (event) => {
    event.preventDefault()
    setStatus({ type: '', message: '' })
    setIsSubmitting(true)

    const { data, error } = await supabase.auth.signInWithPassword({
      email: formData.email,
      password: formData.password,
    })

    if (error) {
      setStatus({ type: 'error', message: error.message })
      setIsSubmitting(false)
      return
    }

    // Only save remembered data after a successful login, never after a failed attempt.
    if (formData.rememberMe) {
      window.localStorage.setItem(
        rememberedUserKey,
        JSON.stringify({
          email: formData.email,
          rememberMe: true,
        }),
      )
    } else {
      window.localStorage.removeItem(rememberedUserKey)
    }

    setFormData((currentData) => ({
      ...initialForm,
      rememberMe: currentData.rememberMe,
    }))

    setIsSubmitting(false)

    // Reads the role from Supabase user metadata so users and admins go to different pages.
    const userRole = data.user?.user_metadata?.role ?? 'user'
    navigate(userRole === 'admin' ? '/admin' : '/dashboard')
  }



  return (
    <div className="overallContainer">
      <form className="loginContainer" onSubmit={handleSubmit}>
        <div className="headerContainer">
          <div className="logoBox">LOGO</div>
          <div className="headerText">
            <p className="eyebrow">Ticketing System</p>
            <h1>Staff Login</h1>
            <p className="subText">Sai ikaw bahala ano gusto mo lagay dito lol</p>
          </div>
        </div>

        <div className="inputGroup">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="Enter email"
            value={formData.email}
            onChange={handleChange}
            autoComplete="off"
            required
          />
        </div>

        <div className="inputGroup">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            placeholder="Enter password"
            value={formData.password}
            onChange={handleChange}
            autoComplete="current-password"
            required
          />
        </div>

        <div className="utilityRow">
          <label className="checkboxRow" htmlFor="rememberMe">
            <input
              id="rememberMe"
              name="rememberMe"
              type="checkbox"
              checked={formData.rememberMe}
              onChange={handleChange}
            />
            <span>Remember me</span>
          </label>

          <div className="supportLinks">
            <p>Not registered?</p>
            <Link to="/signup">Sign up</Link>
          </div>
        </div>

        {status.message ? (
          <p className={`statusMessage ${status.type}`}>{status.message}</p>
        ) : null}

        <button type="submit" className="loginButton" disabled={isSubmitting}>
          {isSubmitting ? 'Logging in...' : 'Log In'}
        </button>
      </form>
    </div>
  )
}
