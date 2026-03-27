import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import './userDashboard.css'

const ticketCategories = [
  'General Inquiry',
  'Technical Issue',
  'Account Issues',
  'Billing / Payment',
  'Feature Request',
  'Feedback / Suggestions',
  'Report a Bug',
]

const ticketStatuses = ['Open', 'In Progress', 'Solved']

const initialTicketForm = {
  title: '',
  description: '',
  category: ticketCategories[0],
}

// This dashboard loads the user's profile and tickets, and lets them create new tickets.
export default function UserDashboard() {
  // Keeps track of the signed-in user from Supabase Auth.
  const [user, setUser] = useState(null)
  // Stores the profile row from the public.profiles table.
  const [profile, setProfile] = useState(null)
  // Stores the current list of tickets owned by the user.
  const [tickets, setTickets] = useState([])
  // Controls which dashboard panel is visible on the page.
  const [activeView, setActiveView] = useState('submit')
  // Stores the form values used to create a new ticket.
  const [ticketForm, setTicketForm] = useState(initialTicketForm)
  // Controls the status filter used in the "View Tickets" panel.
  const [ticketFilter, setTicketFilter] = useState('All')
  // Controls the general loading state for initial profile/ticket fetches.
  const [isLoading, setIsLoading] = useState(true)
  // Tracks whether the ticket creation request is currently running.
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false)
  // Stores success or error messages related to ticket actions.
  const [ticketStatus, setTicketStatus] = useState({ type: '', message: '' })
  // Lets the dashboard send the user back to the login page after logout.
  const navigate = useNavigate()

  // On first load, fetch the current auth user, ensure a profile row exists, and load tickets.
  useEffect(() => {
    const loadDashboardData = async () => {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser()

      if (!currentUser) {
        setIsLoading(false)
        return
      }

      setUser(currentUser)

      let currentProfile = null

      const { data: existingProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle()

      if (profileError) {
        setTicketStatus({ type: 'error', message: profileError.message })
        setIsLoading(false)
        return
      }

      if (existingProfile) {
        currentProfile = existingProfile
      } else {
        const profilePayload = {
          id: currentUser.id,
          email: currentUser.email,
          role: currentUser.user_metadata?.role ?? 'user',
          first_name: currentUser.user_metadata?.first_name ?? '',
          last_name: currentUser.user_metadata?.last_name ?? '',
        }

        const { data: insertedProfile, error: insertProfileError } = await supabase
          .from('profiles')
          .insert(profilePayload)
          .select()
          .single()

        if (insertProfileError) {
          setTicketStatus({ type: 'error', message: insertProfileError.message })
          setIsLoading(false)
          return
        }

        currentProfile = insertedProfile
      }

      setProfile(currentProfile)

      const { data: ticketRows, error: ticketError } = await supabase
        .from('tickets')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })

      if (ticketError) {
        setTicketStatus({ type: 'error', message: ticketError.message })
        setIsLoading(false)
        return
      }

      setTickets(ticketRows ?? [])
      setIsLoading(false)
    }

    loadDashboardData()
  }, [])

  // Handles changes for the ticket creation form.
  const handleTicketChange = (event) => {
    const { name, value } = event.target

    setTicketForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }))
  }

  // Creates a new ticket with the default status of Open and refreshes the local ticket list.
  const handleTicketSubmit = async (event) => {
    event.preventDefault()
    setTicketStatus({ type: '', message: '' })
    setIsSubmittingTicket(true)

    const newTicket = {
      user_id: user.id,
      title: ticketForm.title.trim(),
      description: ticketForm.description.trim(),
      category: ticketForm.category,
      status: 'Open',
    }

    const { data, error } = await supabase.from('tickets').insert(newTicket).select().single()

    if (error) {
      setTicketStatus({ type: 'error', message: error.message })
      setIsSubmittingTicket(false)
      return
    }

    setTickets((currentTickets) => [data, ...currentTickets])
    setTicketForm(initialTicketForm)
    setTicketStatus({ type: 'success', message: 'Ticket submitted successfully.' })
    setActiveView('view')
    setIsSubmittingTicket(false)
  }

  // Creates the shorter preview text used in the ticket list rows.
  const truncateDescription = (description) => {
    if (description.length <= 50) {
      return description
    }

    return `${description.slice(0, 47)}...`
  }

  // Formats the created_at value into something easier to read in the UI.
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString()
  }

  // Applies the selected ticket filter before rendering the ticket rows.
  const filteredTickets = tickets.filter((ticket) => {
    if (ticketFilter === 'All') {
      return true
    }

    return ticket.status === ticketFilter
  })

  // Ends the current Supabase session and returns the user to the login page.
  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  if (isLoading) {
    return <div className="dashboardLoading">Loading dashboard...</div>
  }

  return (
    <div className="dashboardPage">
      <header className="dashboardTopBar">
        <div className="dashboardTopItem">
          <span className="dashboardTopLabel">User ID</span>
          <span>{profile?.id ?? 'Unavailable'}</span>
        </div>
        <div className="dashboardTopItem">
          <span className="dashboardTopLabel">First Name</span>
          <span>{profile?.first_name || 'Not set'}</span>
        </div>
        <div className="dashboardTopItem">
          <span className="dashboardTopLabel">Last Name</span>
          <span>{profile?.last_name || 'Not set'}</span>
        </div>
        <div className="dashboardTopItem">
          <span className="dashboardTopLabel">Email</span>
          <span>{profile?.email || user?.email || 'Unavailable'}</span>
        </div>
        <div className="dashboardTopItem dashboardTopAction">
          <span className="dashboardTopLabel">Session</span>
          <button type="button" className="dashboardButton logoutButton" onClick={handleLogout}>
            Log Out
          </button>
        </div>
      </header>

      <div className="dashboardLayout">
        <aside className="dashboardSidebar">
          <button
            type="button"
            className={`sidebarButton ${activeView === 'submit' ? 'active' : ''}`}
            onClick={() => setActiveView('submit')}
          >
            Ticket Submission
          </button>
          <button
            type="button"
            className={`sidebarButton ${activeView === 'view' ? 'active' : ''}`}
            onClick={() => setActiveView('view')}
          >
            View Tickets
          </button>
        </aside>

        <main className="dashboardContent">
          {activeView === 'submit' ? (
            <section className="dashboardPanel">
              <h2>Ticket Submission</h2>

              <form className="dashboardForm" onSubmit={handleTicketSubmit}>
                <div className="dashboardField">
                  <label htmlFor="title">Ticket Title</label>
                  <input
                    id="title"
                    name="title"
                    type="text"
                    value={ticketForm.title}
                    onChange={handleTicketChange}
                    required
                  />
                </div>

                <div className="dashboardField">
                  <label htmlFor="description">Ticket Description</label>
                  <textarea
                    id="description"
                    name="description"
                    value={ticketForm.description}
                    onChange={handleTicketChange}
                    rows="6"
                    required
                  />
                </div>

                <div className="dashboardField">
                  <label htmlFor="category">Ticket Category</label>
                  <select
                    id="category"
                    name="category"
                    value={ticketForm.category}
                    onChange={handleTicketChange}
                  >
                    {ticketCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                {ticketStatus.message ? (
                  <p className={`dashboardMessage ${ticketStatus.type}`}>{ticketStatus.message}</p>
                ) : null}

                <button type="submit" className="dashboardButton" disabled={isSubmittingTicket}>
                  {isSubmittingTicket ? 'Submitting...' : 'Create Ticket'}
                </button>
              </form>
            </section>
          ) : (
            <section className="dashboardPanel">
              <div className="panelHeaderRow">
                <h2>View Tickets</h2>

                <div className="filterGroup">
                  <label htmlFor="ticketFilter">Filter</label>
                  <select
                    id="ticketFilter"
                    value={ticketFilter}
                    onChange={(event) => setTicketFilter(event.target.value)}
                  >
                    <option value="All">All</option>
                    {ticketStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="ticketList">
                <div className="ticketRow ticketRowHeader">
                  <span>Title</span>
                  <span>Description</span>
                  <span>Date Created</span>
                  <span>Status</span>
                </div>

                {filteredTickets.length > 0 ? (
                  filteredTickets.map((ticket) => (
                    <div key={ticket.id} className="ticketRow">
                      <span>{ticket.title}</span>
                      <span>{truncateDescription(ticket.description)}</span>
                      <span>{formatDate(ticket.created_at)}</span>
                      <span>{ticket.status}</span>
                    </div>
                  ))
                ) : (
                  <div className="emptyState">No tickets found for this filter.</div>
                )}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  )
}
