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

const ticketStatuses = ['Open', 'In Progress', 'Resolved']

const initialTicketForm = {
  title: '',
  description: '',
  category: ticketCategories[0],
}

export default function UserDashboard() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [tickets, setTickets] = useState([])
  const [activeView, setActiveView] = useState('submit')
  const [ticketForm, setTicketForm] = useState(initialTicketForm)
  const [ticketFilter, setTicketFilter] = useState('All')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false)
  const [ticketStatus, setTicketStatus] = useState({ type: '', message: '' })
  const navigate = useNavigate()

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

  const handleTicketChange = (event) => {
    const { name, value } = event.target
    setTicketForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }))
  }

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
      user_name: `${profile?.first_name} ${profile?.last_name}`,
    }

    const { data, error } = await supabase.from('tickets').insert(newTicket).select().single()

    if (error) {
      setTicketStatus({ type: 'error', message: error.message })
      setIsSubmittingTicket(false)
      return
    }

    setTickets((currentTickets) => [data, ...currentTickets])
    setTicketForm(initialTicketForm)
    setTicketStatus({ type: 'success', message: 'Ticket submitted successfully!' })
    setActiveView('view')
    setIsSubmittingTicket(false)
    
    setTimeout(() => {
      setTicketStatus({ type: '', message: '' })
    }, 3000)
  }

  const truncateDescription = (description) => {
    if (description.length <= 60) return description
    return `${description.slice(0, 57)}...`
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString()
  }

  const filteredTickets = tickets.filter((ticket) => {
    if (ticketFilter === 'All') return true
    return ticket.status === ticketFilter
  })

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
          <span>{profile?.id?.slice(0, 8) ?? 'Unavailable'}</span>
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
             View Tickets ({filteredTickets.length})
          </button>
        </aside>

        <main className="dashboardContent">
          {activeView === 'submit' ? (
            <section className="dashboardPanel">
              <h2>Ticket Submission</h2>
              <p style={{ color: '#6c757d', fontSize: '0.85rem', marginBottom: '1rem' }}>
                Submit your issue and we'll get back to you shortly
              </p>

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

              <form className="dashboardForm" onSubmit={handleTicketSubmit}>
                <div className="dashboardField">
                  <label htmlFor="title">Ticket Title</label>
                  <input
                    id="title"
                    name="title"
                    type="text"
                    placeholder="What's your issue?"
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
                    placeholder="Please provide detailed information about your issue..."
                    value={ticketForm.description}
                    onChange={handleTicketChange}
                    rows="6"
                    required
                  />
                </div>

                {ticketStatus.message ? (
                  <div className={`dashboardMessage ${ticketStatus.type}`}>
                    {ticketStatus.message}
                  </div>
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
                  <label htmlFor="ticketFilter">Filter by status:</label>
                  <select
                    id="ticketFilter"
                    value={ticketFilter}
                    onChange={(event) => setTicketFilter(event.target.value)}
                  >
                    <option value="All">All Tickets</option>
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
                      <span data-label="Title:">{ticket.title}</span>
                      <span data-label="Description:">{truncateDescription(ticket.description)}</span>
                      <span data-label="Date:">{formatDate(ticket.created_at)}</span>
                      <span data-label="Status:">
                        <span style={{
                          display: 'inline-block',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '20px',
                          fontSize: '0.7rem',
                          fontWeight: '600',
                          background: ticket.status === 'Open' ? '#f8d7da' : 
                                       ticket.status === 'In Progress' ? '#fff3cd' : '#d4edda',
                          color: ticket.status === 'Open' ? '#721c24' : 
                                 ticket.status === 'In Progress' ? '#856404' : '#155724'
                        }}>
                          {ticket.status}
                        </span>
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="emptyState">
                    <p>No tickets found for this filter.</p>
                  </div>
                )}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  )
}