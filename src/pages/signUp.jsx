import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import './loginPageSetup.css'

// This object defines the default values for every sign-up field.
const initialForm = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  confirmPassword: '',
  showPassword: false,
}

// This component renders the registration page and handles account creation.
export default function SignUp() {
  // Stores the values currently entered into the sign-up form.
  const [formData, setFormData] = useState(initialForm)
  // Stores error/success text shown under the form.
  const [status, setStatus] = useState({ type: '', message: '' })
  // Tracks whether the sign-up request is currently being processed.
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Updates any field in the sign-up form, including checkboxes.
  const handleChange = (event) => {
    const { name, value, type, checked } = event.target

    setFormData((currentData) => ({
      ...currentData,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  // Validates the form, sends the sign-up request to Supabase, and waits for email confirmation.
  const handleSubmit = async (event) => {
    event.preventDefault()
    setStatus({ type: '', message: '' })

    // Stops the sign-up request early if the two password fields do not match.
    if (formData.password !== formData.confirmPassword) {
      setStatus({ type: 'error', message: 'Passwords do not match.' })
      return
    }

    setIsSubmitting(true)

    const { error } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          first_name: formData.firstName,
          last_name: formData.lastName,
          name: `${formData.firstName} ${formData.lastName}`.trim(),
          role: 'user',
        },
        emailRedirectTo: `${window.location.origin}/auth/confirmed`,
      },
    })

    if (error) {
      setStatus({ type: 'error', message: error.message })
      setIsSubmitting(false)
      return
    }

    // Resets the form after sign-up while keeping the show-password preference unchanged.
    setFormData((currentData) => ({
      ...initialForm,
      showPassword: currentData.showPassword,
    }))
    setStatus({
      type: 'success',
      message: 'Confirmation email sent. Please verify your email before logging in.',
    })
    setIsSubmitting(false)
  }

  // Switches both password inputs between hidden and visible text.
  const passwordInputType = formData.showPassword ? 'text' : 'password'

  return (
    <div className="overallContainer">
      <form className="loginContainer" onSubmit={handleSubmit}>
        <div className="headerContainer">
          <div className="logoBox">LOGO</div>
          <div className="headerText">
            <p className="eyebrow">Ticketing System</p>
            <h1>Create Account</h1>
            <p className="subText">Enter your name, email, and password to create a Supabase user.</p>
          </div>
        </div>

        <div className="inputGroup">
          <label htmlFor="firstName">First Name</label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            placeholder="Enter first name"
            onChange={handleChange}
            value={formData.firstName}
            autoComplete="off"
            required
          />
        </div>

        <div className="inputGroup">
          <label htmlFor="lastName">Last Name</label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            placeholder="Enter last name"
            onChange={handleChange}
            value={formData.lastName}
            autoComplete="off"
            required
          />
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
            type={passwordInputType}
            placeholder="Enter password"
            value={formData.password}
            onChange={handleChange}
            autoComplete="new-password"
            required
          />
        </div>

        <div className="inputGroup">
          <label htmlFor="confirmPassword">Re-type Password</label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type={passwordInputType}
            placeholder="Re-enter password"
            value={formData.confirmPassword}
            onChange={handleChange}
            autoComplete="new-password"
            required
          />
        </div>

        <label className="checkboxRow" htmlFor="showPassword">
          <input
            id="showPassword"
            name="showPassword"
            type="checkbox"
            checked={formData.showPassword}
            onChange={handleChange}
          />
          <span>Show password</span>
        </label>

        <div className="supportLinks">
          <p>Already have an account?</p>
          <Link to="/login">Log in</Link>
        </div>

        {status.message ? (
          <p className={`statusMessage ${status.type}`}>{status.message}</p>
        ) : null}

        <button type="submit" className="loginButton" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account...' : 'Sign Up'}
        </button>
      </form>
    </div>
  )
}
