import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import './userDashboard.css'

const persistentSessionKey = 'rememberSession'
const sessionScopeKey = 'sessionScopedLogin'

const ticketCategories = [
  'General Inquiry',
  'Technical Issue',
  'Account Issues',
  'Billing / Payment',
  'Feature Request',
  'Feedback / Suggestions',
  'Report a Bug',
]

const ticketStatuses = ['Open', 'In Progress', 'Solved', 'Archived']
const ticketScopes = ['All Tickets', 'My Tickets', 'Community Tickets']
const deleteReasonOptions = [
  'Issue has been resolved already',
  'Created duplicate ticket by mistake',
  'Submitted incorrect or incomplete information',
  'No longer relevant / problem no longer exists',
  'Decided to create a new, updated ticket instead',
  'Took too long to get a response',
  'Ticket was created accidentally',
  'Concerned about privacy or sensitive information',
  'Posted in the wrong category',
  'Issue resolved through another channel (e.g., chat, email)',
]

const initialTicketForm = {
  title: '',
  description: '',
  category: ticketCategories[0],
}

const initialReplyForm = {
  commentText: '',
  parentCommentId: null,
}

// This dashboard lets a user create tickets, browse tickets, and reply within their own ticket threads.
export default function UserDashboard() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [tickets, setTickets] = useState([])
  const [ticketComments, setTicketComments] = useState([])
  const [selectedTicketId, setSelectedTicketId] = useState(null)
  const [activeView, setActiveView] = useState('submit')
  const [ticketForm, setTicketForm] = useState(initialTicketForm)
  const [replyForm, setReplyForm] = useState(initialReplyForm)
  const [ticketFilter, setTicketFilter] = useState('All')
  const [ticketScope, setTicketScope] = useState('All Tickets')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false)
  const [deletingTicketId, setDeletingTicketId] = useState(null)
  const [isSubmittingReply, setIsSubmittingReply] = useState(false)
  const [ticketFormStatus, setTicketFormStatus] = useState({ type: '', message: '' })
  const [ticketStatus, setTicketStatus] = useState({ type: '', message: '' })
  const [replyStatus, setReplyStatus] = useState({ type: '', message: '' })
  const [pendingDeleteTicketId, setPendingDeleteTicketId] = useState(null)
  const [deleteReason, setDeleteReason] = useState('')
  const [deleteModalStep, setDeleteModalStep] = useState('confirm')
  const [deleteModalError, setDeleteModalError] = useState('')
  const navigate = useNavigate()

  // This refresh loop replaces realtime subscriptions with lightweight polling so status changes
  // made by admins show up without requiring the user to manually reload the page.
  useEffect(() => {
    let isMounted = true

    const loadDashboardData = async () => {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser()

      if (!currentUser) {
        if (isMounted) {
          setIsLoading(false)
        }
        return
      }

      if (isMounted) {
        setUser(currentUser)
      }

      const profilePayload = {
        id: currentUser.id,
        email: currentUser.email,
        role: currentUser.user_metadata?.role ?? 'user',
        first_name: currentUser.user_metadata?.first_name ?? '',
        last_name: currentUser.user_metadata?.last_name ?? '',
      }

      const { data: profileRow, error: profileError } = await supabase
        .from('profiles')
        .upsert(profilePayload, { onConflict: 'id' })
        .select()
        .single()

      if (profileError) {
        if (isMounted) {
          setTicketStatus({ type: 'error', message: profileError.message })
          setIsLoading(false)
        }
        return
      }

      const { data: ticketRows, error: ticketError } = await supabase
        .from('tickets')
        .select(`
          *,
          profiles:user_id (
            first_name,
            last_name,
            email
          )
        `)
        .order('created_at', { ascending: false })

      if (ticketError) {
        if (isMounted) {
          setTicketStatus({ type: 'error', message: ticketError.message })
          setIsLoading(false)
        }
        return
      }

      if (!isMounted) {
        return
      }

      setProfile(profileRow)
      setTickets(ticketRows ?? [])

      if (ticketRows?.length) {
        setSelectedTicketId((currentTicketId) => currentTicketId ?? ticketRows[0].id)
      }

      setIsLoading(false)
    }

    loadDashboardData()

    const refreshInterval = window.setInterval(() => {
      loadDashboardData()
    }, 5000)

    const handleFocus = () => {
      loadDashboardData()
    }

    window.addEventListener('focus', handleFocus)

    return () => {
      isMounted = false
      window.clearInterval(refreshInterval)
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  useEffect(() => {
    const loadSelectedTicketComments = async () => {
      if (!selectedTicketId || !user) {
        setTicketComments([])
        return
      }

      const selectedTicket = tickets.find((ticket) => ticket.id === selectedTicketId)

      if (!selectedTicket || selectedTicket.user_id !== user.id) {
        setTicketComments([])
        return
      }

      const { data, error } = await supabase
        .from('ticket_comments')
        .select(`
          *,
          profiles:author_id (
            first_name,
            last_name,
            email,
            role
          )
        `)
        .eq('ticket_id', selectedTicketId)
        .order('created_at', { ascending: true })

      if (error) {
        setReplyStatus({ type: 'error', message: error.message })
        return
      }

      setTicketComments(data ?? [])
    }

    loadSelectedTicketComments()
  }, [selectedTicketId, user, tickets])

  useEffect(() => {
    if (ticketStatus.type !== 'success' || ticketStatus.message !== 'Ticket deleted successfully.') {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setTicketStatus((currentStatus) =>
        currentStatus.message === 'Ticket deleted successfully.'
          ? { type: '', message: '' }
          : currentStatus,
      )
    }, 5000)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [ticketStatus])

  useEffect(() => {
    if (
      ticketFormStatus.type !== 'success' ||
      ticketFormStatus.message !== 'Ticket submitted successfully.'
    ) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setTicketFormStatus((currentStatus) =>
        currentStatus.message === 'Ticket submitted successfully.'
          ? { type: '', message: '' }
          : currentStatus,
      )
    }, 5000)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [ticketFormStatus])

  const handleTicketChange = (event) => {
    const { name, value } = event.target

    setTicketForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }))
  }

  const handleReplyChange = (event) => {
    const { name, value } = event.target

    setReplyForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }))
  }

  const handleTicketSubmit = async (event) => {
    event.preventDefault()
    setTicketFormStatus({ type: '', message: '' })
    setIsSubmittingTicket(true)

    const newTicket = {
      user_id: user.id,
      title: ticketForm.title.trim(),
      description: ticketForm.description.trim(),
      category: ticketForm.category,
      status: 'Open',
      source: 'website',
    }

    const { data, error } = await supabase
      .from('tickets')
      .insert(newTicket)
      .select(`
        *,
        profiles:user_id (
          first_name,
          last_name,
          email
        )
      `)
      .single()

    if (error) {
      setTicketFormStatus({ type: 'error', message: error.message })
      setIsSubmittingTicket(false)
      return
    }

    setTickets((currentTickets) => [data, ...currentTickets])
    setSelectedTicketId(data.id)
    setTicketForm(initialTicketForm)
    setTicketFormStatus({ type: 'success', message: 'Ticket submitted successfully.' })
    setActiveView('view')
    setIsSubmittingTicket(false)
  }

  const openDeleteModal = (ticketId) => {
    setPendingDeleteTicketId(ticketId)
    setDeleteReason(deleteReasonOptions[0])
    setDeleteModalStep('confirm')
    setDeleteModalError('')
  }

  const closeDeleteModal = () => {
    if (deletingTicketId) {
      return
    }

    setPendingDeleteTicketId(null)
    setDeleteReason('')
    setDeleteModalStep('confirm')
    setDeleteModalError('')
  }

  const handleDeleteTicket = async () => {
    if (!pendingDeleteTicketId) {
      return
    }

    setTicketStatus({ type: '', message: '' })
    setDeletingTicketId(pendingDeleteTicketId)

    const { error } = await supabase
      .from('tickets')
      .delete()
      .eq('id', pendingDeleteTicketId)
      .eq('user_id', user.id)
      .eq('status', 'Open')

    if (error) {
      setTicketStatus({ type: 'error', message: error.message })
      setDeletingTicketId(null)
      closeDeleteModal()
      return
    }

    setTickets((currentTickets) =>
      currentTickets.filter((ticket) => ticket.id !== pendingDeleteTicketId),
    )
    setTicketStatus({ type: 'success', message: 'Ticket deleted successfully.' })
    setDeletingTicketId(null)

    if (selectedTicketId === pendingDeleteTicketId) {
      setSelectedTicketId(null)
      setTicketComments([])
    }

    closeDeleteModal()
  }

  const handleDeleteReasonSubmit = async (event) => {
    event.preventDefault()

    if (!deleteReason) {
      setDeleteModalError('Please choose a reason before deleting this ticket.')
      return
    }

    setDeleteModalError('')
    await handleDeleteTicket()
  }

  const handleReplySubmit = async (event) => {
    event.preventDefault()

    if (!selectedTicket || selectedTicket.user_id !== user.id || !canReplyToSelectedTicket) {
      return
    }

    setReplyStatus({ type: '', message: '' })
    setIsSubmittingReply(true)

    const replyPayload = {
      ticket_id: selectedTicket.id,
      author_id: user.id,
      comment_title: null,
      comment_text: replyForm.commentText.trim(),
      comment_type: 'reply',
      is_internal: false,
      parent_comment_id: replyForm.parentCommentId,
    }

    const { data, error } = await supabase
      .from('ticket_comments')
      .insert(replyPayload)
      .select(`
        *,
        profiles:author_id (
          first_name,
          last_name,
          email,
          role
        )
      `)
      .single()

    if (error) {
      setReplyStatus({ type: 'error', message: error.message })
      setIsSubmittingReply(false)
      return
    }

    setTicketComments((currentComments) => [...currentComments, data])
    setReplyForm(initialReplyForm)
    setReplyStatus({ type: 'success', message: 'Reply added successfully.' })
    setIsSubmittingReply(false)
  }

  const truncateDescription = (description) => {
    if (!description) {
      return 'No description provided.'
    }

    if (description.length <= 60) {
      return description
    }

    return `${description.slice(0, 57)}...`
  }

  const formatDate = (dateString) => {
    if (!dateString) {
      return 'Not set'
    }

    return new Date(dateString).toLocaleString()
  }

  const filteredTickets = tickets.filter((ticket) => {
    if (ticketScope === 'My Tickets' && ticket.user_id !== user.id) {
      return false
    }

    if (ticketScope === 'Community Tickets' && ticket.user_id === user.id) {
      return false
    }

    if (ticketFilter === 'All') {
      return true
    }

    return ticket.status === ticketFilter
  })

  const selectedTicket =
    filteredTickets.find((ticket) => ticket.id === selectedTicketId) ??
    tickets.find((ticket) => ticket.id === selectedTicketId) ??
    filteredTickets[0] ??
    tickets[0] ??
    null

  const canReplyToSelectedTicket =
    selectedTicket &&
    selectedTicket.user_id === user?.id &&
    !['Solved', 'Archived'].includes(selectedTicket.status)

  const getTicketOwnerName = (ticket) => {
    return `${ticket.profiles?.first_name ?? ''} ${ticket.profiles?.last_name ?? ''}`.trim() || ticket.profiles?.email || 'Anonymous'
  }

  const buildCommentTree = (comments, parentId = null) => {
    return comments
      .filter((comment) => comment.parent_comment_id === parentId)
      .map((comment) => ({
        ...comment,
        replies: buildCommentTree(comments, comment.id),
      }))
  }

  const threadedComments = useMemo(() => buildCommentTree(ticketComments), [ticketComments])

  const renderCommentThread = (commentNodes, depth = 0) => {
    return commentNodes.map((comment) => {
      const authorFullName =
        `${comment.profiles?.first_name ?? ''} ${comment.profiles?.last_name ?? ''}`.trim() ||
        comment.profiles?.email ||
        'Unknown'
      const authorName =
        comment.profiles?.role === 'admin'
          ? `${authorFullName} [Administrator]`
          : authorFullName
      const isAdminComment = comment.profiles?.role === 'admin'

      return (
        <div
          key={comment.id}
          className="commentNode"
          style={{ marginLeft: `${depth * 18}px` }}
        >
          <div className="commentNodeHeader">
            <strong>{comment.comment_title || (comment.comment_type === 'reply' ? 'Reply' : 'Message')}</strong>
            <span>{formatDate(comment.created_at)}</span>
          </div>
          <p>{comment.comment_text}</p>
          <div className="commentNodeMeta">
            <span>By: {authorName}</span>
            {isAdminComment && canReplyToSelectedTicket ? (
              <button
                type="button"
                className="replyLinkButton"
                onClick={() =>
                  setReplyForm((currentForm) => ({
                    ...currentForm,
                    parentCommentId: comment.id,
                  }))
                }
              >
                Reply in thread
              </button>
            ) : null}
          </div>
          {comment.replies.length > 0 ? renderCommentThread(comment.replies, depth + 1) : null}
        </div>
      )
    })
  }

  const handleLogout = async () => {
    window.localStorage.removeItem(persistentSessionKey)
    window.sessionStorage.removeItem(sessionScopeKey)
    await supabase.auth.signOut()
    navigate('/login')
  }

  if (isLoading) {
    return <div className="dashboardLoading">Loading dashboard...</div>
  }

  const pendingDeleteTicket = tickets.find((ticket) => ticket.id === pendingDeleteTicketId) ?? null

  return (
    <div className="dashboardPage">
      <header className="dashboardTopBar compactTopBar">
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

                {ticketFormStatus.message ? (
                  <p className={`dashboardMessage ${ticketFormStatus.type}`}>{ticketFormStatus.message}</p>
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

                <div className="filterToolbar">
                  <div className="filterGroup">
                    <label htmlFor="ticketScope">Scope</label>
                    <select
                      id="ticketScope"
                      value={ticketScope}
                      onChange={(event) => setTicketScope(event.target.value)}
                    >
                      {ticketScopes.map((scope) => (
                        <option key={scope} value={scope}>
                          {scope}
                        </option>
                      ))}
                    </select>
                  </div>

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
              </div>

              {ticketStatus.message ? (
                <p className={`dashboardMessage ${ticketStatus.type}`}>{ticketStatus.message}</p>
              ) : null}

              <div className="ticketList">
                <div className="ticketRow ticketRowHeader">
                  <span>Owner</span>
                  <span>Title</span>
                  <span>Category</span>
                  <span>Status</span>
                  <span>Action</span>
                </div>

                {filteredTickets.length > 0 ? (
                  filteredTickets.map((ticket) => (
                    <button
                      key={ticket.id}
                      type="button"
                      className={`ticketRow ticketRowButton ${selectedTicket?.id === ticket.id ? 'activeRow' : ''}`}
                      onClick={() => setSelectedTicketId(ticket.id)}
                    >
                      <span>{getTicketOwnerName(ticket)}</span>
                      <span>{ticket.title}</span>
                      <span>{ticket.category}</span>
                      <span>{ticket.status}</span>
                      <span className="ticketActionCell">
                        {ticket.user_id === user.id && ticket.status === 'Open' ? (
                          <button
                            type="button"
                            className="deleteTicketButton"
                            disabled={deletingTicketId === ticket.id}
                            onClick={(event) => {
                              event.stopPropagation()
                              openDeleteModal(ticket.id)
                            }}
                          >
                            {deletingTicketId === ticket.id ? 'Deleting...' : 'Delete'}
                          </button>
                        ) : (
                          <span className="ticketActionHint">Open</span>
                        )}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="emptyState">No tickets found for this filter.</div>
                )}
              </div>

              {selectedTicket ? (
                <div className="ticketDetailCard">
                  <div className="ticketDetailHeader">
                    <h3>{selectedTicket.title}</h3>
                    <span>{selectedTicket.status}</span>
                  </div>
                  <div className="ticketDetailMeta">
                    <span>Owner: {getTicketOwnerName(selectedTicket)}</span>
                    <span>Category: {selectedTicket.category}</span>
                    <span>Created: {formatDate(selectedTicket.created_at)}</span>
                  </div>
                  <p>{selectedTicket.description}</p>

                  {selectedTicket.user_id === user.id ? (
                    <div className="commentThreadSection">
                      <h4>Ticket Comment Thread</h4>
                      {threadedComments.length > 0 ? (
                        renderCommentThread(threadedComments)
                      ) : (
                        <div className="emptyState">No responses or replies yet.</div>
                      )}

                      <form className="dashboardForm replyForm" onSubmit={handleReplySubmit}>
                        <div className="replyHeaderRow">
                          <h4>{replyForm.parentCommentId ? 'Reply in Thread' : 'Add Comment'}</h4>
                          {replyForm.parentCommentId ? (
                            <button
                              type="button"
                              className="replyLinkButton"
                              onClick={() => setReplyForm(initialReplyForm)}
                            >
                              Clear thread target
                            </button>
                          ) : null}
                        </div>

                        {replyForm.parentCommentId ? (
                          <p className="replyHelperText">
                            This comment will be posted as a threaded reply to the selected message.
                          </p>
                        ) : null}

                        <div className="dashboardField">
                          <label htmlFor="commentText">Message</label>
                          <textarea
                            id="commentText"
                            name="commentText"
                            rows="4"
                            value={replyForm.commentText}
                            onChange={handleReplyChange}
                            disabled={!canReplyToSelectedTicket}
                            required
                          />
                        </div>

                        {replyStatus.message ? (
                          <p className={`dashboardMessage ${replyStatus.type}`}>{replyStatus.message}</p>
                        ) : null}

                        <button
                          type="submit"
                          className="dashboardButton"
                          disabled={isSubmittingReply || !canReplyToSelectedTicket}
                        >
                          {isSubmittingReply ? 'Sending...' : 'Send Comment'}
                        </button>
                      </form>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
          )}
        </main>
      </div>

      {pendingDeleteTicket ? (
        <div className="dialogOverlay" role="presentation">
          <div
            className="dialogCard"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-ticket-title"
          >
            {deleteModalStep === 'confirm' ? (
              <>
                <h3 id="delete-ticket-title">Delete this ticket?</h3>
                <p>
                  You are about to delete
                  {' '}
                  <strong>{pendingDeleteTicket.title}</strong>
                  .
                  This action cannot be undone.
                </p>
                <div className="dialogActions">
                  <button
                    type="button"
                    className="dashboardButton secondaryButton"
                    onClick={closeDeleteModal}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="dashboardButton deleteConfirmButton"
                    onClick={() => setDeleteModalStep('reason')}
                  >
                    Yes, continue
                  </button>
                </div>
              </>
            ) : (
              <form className="dashboardForm" onSubmit={handleDeleteReasonSubmit}>
                <h3 id="delete-ticket-title">Reason for deletion</h3>
                <p>Please choose why you are deleting this ticket before continuing.</p>
                <div className="dashboardField">
                  <label htmlFor="deleteReason">Reason</label>
                  <select
                    id="deleteReason"
                    name="deleteReason"
                    value={deleteReason}
                    onChange={(event) => setDeleteReason(event.target.value)}
                    disabled={Boolean(deletingTicketId)}
                    required
                  >
                    {deleteReasonOptions.map((reason) => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                </div>

                {deleteModalError ? (
                  <p className="dashboardMessage error">{deleteModalError}</p>
                ) : null}

                <div className="dialogActions">
                  <button
                    type="button"
                    className="dashboardButton secondaryButton"
                    onClick={() => {
                      setDeleteModalStep('confirm')
                      setDeleteModalError('')
                    }}
                    disabled={Boolean(deletingTicketId)}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="dashboardButton deleteConfirmButton"
                    disabled={Boolean(deletingTicketId)}
                  >
                    {deletingTicketId ? 'Deleting...' : 'Delete Ticket'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
