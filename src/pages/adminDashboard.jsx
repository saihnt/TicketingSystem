import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import './adminDashboard.css'

const persistentSessionKey = 'rememberSession'
const sessionScopeKey = 'sessionScopedLogin'
const archiveCountdownDays = 30

const adminFilters = ['Open', 'In Progress', 'Solved', 'Archived']
const editableStatuses = ['Open', 'In Progress', 'Solved', 'Archived']
const priorityOptions = ['Low', 'Medium', 'High']

const initialTicketEditForm = {
  status: 'Open',
  priority: 'Medium',
}

const initialCommentForm = {
  commentTitle: '',
  commentType: 'response',
  commentText: '',
  parentCommentId: null,
}

const initialAdminActionLog = []

// This dashboard lets admins review all tickets, update active tickets, and manage threaded responses/notes.
export default function AdminDashboard() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [tickets, setTickets] = useState([])
  const [ticketComments, setTicketComments] = useState([])
  const [activeFilter, setActiveFilter] = useState('Open')
  const [selectedTicketId, setSelectedTicketId] = useState(null)
  const [ticketEditForm, setTicketEditForm] = useState(initialTicketEditForm)
  const [commentForm, setCommentForm] = useState(initialCommentForm)
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingTicket, setIsSavingTicket] = useState(false)
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [deletingCommentId, setDeletingCommentId] = useState(null)
  const [ticketStatus, setTicketStatus] = useState({ type: '', message: '' })
  const [commentStatus, setCommentStatus] = useState({ type: '', message: '' })
  const [currentTime, setCurrentTime] = useState(() => Date.now())
  const [adminActionLog, setAdminActionLog] = useState(initialAdminActionLog)
  const navigate = useNavigate()

  // This polling refresh keeps the admin list/detail state fresh without introducing subscriptions.
  useEffect(() => {
    let isMounted = true

    const loadAdminDashboard = async () => {
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

      const { data: currentProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
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

      setProfile(currentProfile)
      setTickets(ticketRows ?? [])

      if (ticketRows?.length) {
        setSelectedTicketId((currentTicketId) => currentTicketId ?? ticketRows[0].id)
      }

      setIsLoading(false)
    }

    loadAdminDashboard()

    const refreshInterval = window.setInterval(() => {
      loadAdminDashboard()
    }, 5000)

    const handleFocus = () => {
      loadAdminDashboard()
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
      if (!selectedTicketId) {
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
        setCommentStatus({ type: 'error', message: error.message })
        return
      }

      setTicketComments(data ?? [])
    }

    loadSelectedTicketComments()
  }, [selectedTicketId])

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setCurrentTime(Date.now())
    }, 60000)

    return () => {
      window.clearInterval(timerId)
    }
  }, [])

  const syncTicketEditForm = (ticket) => {
    setTicketEditForm({
      status: ticket.status ?? 'Open',
      priority: ticket.priority ?? 'Medium',
    })
  }

  const handleSelectTicket = (ticket) => {
    setSelectedTicketId(ticket.id)
    setTicketStatus({ type: '', message: '' })
    setCommentStatus({ type: '', message: '' })
    syncTicketEditForm(ticket)
  }

  const handleTicketEditChange = (event) => {
    const { name, value } = event.target

    setTicketEditForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }))
  }

  const handleCommentChange = (event) => {
    const { name, value } = event.target

    setCommentForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }))
  }

  const handleTicketUpdate = async (event) => {
    event.preventDefault()

    if (!selectedTicket || isTicketLocked) {
      return
    }

    setTicketStatus({ type: '', message: '' })
    setIsSavingTicket(true)

    const updatePayload = {
      status: ticketEditForm.status,
      priority: ticketEditForm.priority,
      assigned_admin_id: user.id,
    }

    const { data, error } = await supabase
      .from('tickets')
      .update(updatePayload)
      .eq('id', selectedTicket.id)
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
      setTicketStatus({ type: 'error', message: error.message })
      setIsSavingTicket(false)
      return
    }

    setTickets((currentTickets) =>
      currentTickets.map((ticket) => (ticket.id === data.id ? data : ticket)),
    )
    setTicketStatus({ type: 'success', message: 'Ticket updated successfully.' })
    setIsSavingTicket(false)
  }

  const handleCommentSubmit = async (event) => {
    event.preventDefault()

    if (!selectedTicket || isTicketLocked) {
      return
    }

    setCommentStatus({ type: '', message: '' })
    setIsSubmittingComment(true)
    const isThreadReply = Boolean(commentForm.parentCommentId)
    const commentType = isThreadReply ? 'reply' : commentForm.commentType

    const commentPayload = {
      ticket_id: selectedTicket.id,
      author_id: user.id,
      comment_title: commentForm.commentTitle.trim() || null,
      comment_text: commentForm.commentText.trim(),
      comment_type: commentType,
      is_internal: !isThreadReply && commentForm.commentType === 'note',
      parent_comment_id: commentForm.parentCommentId,
    }

    const { data, error } = await supabase
      .from('ticket_comments')
      .insert(commentPayload)
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
      setCommentStatus({ type: 'error', message: error.message })
      setIsSubmittingComment(false)
      return
    }

    setTicketComments((currentComments) => [...currentComments, data])
    setCommentForm(initialCommentForm)
    setCommentStatus({ type: 'success', message: 'Comment added successfully.' })
    setAdminActionLog((currentLog) => [
      {
        id: data.id,
        action: 'created',
        target: commentType === 'note' ? 'internal note' : isThreadReply ? 'threaded reply' : 'comment',
        summary: data.comment_text,
        createdAt: new Date().toISOString(),
      },
      ...currentLog,
    ])
    setIsSubmittingComment(false)
  }

  const handleDeleteComment = async (commentId) => {
    setCommentStatus({ type: '', message: '' })
    setDeletingCommentId(commentId)

    const deletedComment = ticketComments.find((comment) => comment.id === commentId)

    const { error } = await supabase
      .from('ticket_comments')
      .delete()
      .eq('id', commentId)

    if (error) {
      setCommentStatus({ type: 'error', message: error.message })
      setDeletingCommentId(null)
      return
    }

    setTicketComments((currentComments) =>
      currentComments.filter((comment) => comment.id !== commentId),
    )
    setCommentStatus({ type: 'success', message: 'Comment deleted successfully.' })
    setAdminActionLog((currentLog) => [
      {
        id: `${commentId}-deleted`,
        action: 'deleted',
        target:
          deletedComment?.comment_type === 'note'
            ? 'internal note'
            : deletedComment?.comment_type === 'reply'
              ? 'threaded reply'
              : 'comment',
        summary: deletedComment?.comment_text ?? '',
        createdAt: new Date().toISOString(),
      },
      ...currentLog,
    ])
    setDeletingCommentId(null)
  }

  const handleLogout = async () => {
    window.localStorage.removeItem(persistentSessionKey)
    window.sessionStorage.removeItem(sessionScopeKey)
    await supabase.auth.signOut()
    navigate('/login')
  }

  const truncateDescription = (description) => {
    if (!description) {
      return 'No description provided.'
    }

    if (description.length <= 55) {
      return description
    }

    return `${description.slice(0, 52)}...`
  }

  const formatDate = (dateString) => {
    if (!dateString) {
      return 'Not set'
    }

    return new Date(dateString).toLocaleString()
  }

  const getSolvedArchiveSummary = (ticket) => {
    if (!ticket || ticket.status !== 'Solved') {
      return null
    }

    const solvedDateValue = ticket.updated_at ?? ticket.created_at

    if (!solvedDateValue) {
      return null
    }

    const solvedDate = new Date(solvedDateValue)

    if (Number.isNaN(solvedDate.getTime())) {
      return null
    }

    const archiveDate = new Date(solvedDate.getTime() + archiveCountdownDays * 24 * 60 * 60 * 1000)
    const msRemaining = archiveDate.getTime() - currentTime
    const daysRemaining = Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)))

    return {
      archiveDateLabel: archiveDate.toLocaleString(),
      daysRemaining,
    }
  }

  const filteredTickets = tickets.filter((ticket) => ticket.status === activeFilter)

  const selectedTicket =
    filteredTickets.find((ticket) => ticket.id === selectedTicketId) ??
    tickets.find((ticket) => ticket.id === selectedTicketId) ??
    filteredTickets[0] ??
    tickets[0] ??
    null

  useEffect(() => {
    if (selectedTicket) {
      syncTicketEditForm(selectedTicket)
    }
  }, [selectedTicketId, tickets])

  const isTicketLocked = selectedTicket
    ? ['Solved', 'Archived'].includes(selectedTicket.status)
    : false
  const solvedArchiveSummary = getSolvedArchiveSummary(selectedTicket)

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

      return (
        <div
          key={comment.id}
          className="commentCard"
          style={{ marginLeft: `${depth * 18}px` }}
        >
          <div className="commentHeader">
            <strong>{comment.comment_title || (comment.comment_type === 'note' ? 'Internal Note' : 'Message')}</strong>
            <span>{formatDate(comment.created_at)}</span>
          </div>
          <p>{comment.comment_text}</p>
          <div className="commentFooter">
            <span>{authorName}</span>
            <div className="commentFooterActions">
              {!isTicketLocked ? (
                <button
                  type="button"
                  className="replyLinkButton"
                  onClick={() =>
                    setCommentForm((currentForm) => ({
                      ...currentForm,
                      parentCommentId: comment.id,
                    }))
                  }
                >
                  Reply in thread
                </button>
              ) : null}
              <button
                type="button"
                className="commentDeleteButton"
                disabled={Boolean(deletingCommentId)}
                onClick={() => handleDeleteComment(comment.id)}
              >
                {deletingCommentId === comment.id ? 'Deleting...' : 'Delete comment'}
              </button>
            </div>
          </div>
          {comment.replies.length > 0 ? renderCommentThread(comment.replies, depth + 1) : null}
        </div>
      )
    })
  }

  const selectedTicketOwnerName = selectedTicket
    ? `${selectedTicket.profiles?.first_name ?? ''} ${selectedTicket.profiles?.last_name ?? ''}`.trim() || 'Unknown user'
    : 'No ticket selected'

  if (isLoading) {
    return <div className="adminLoading">Loading admin dashboard...</div>
  }

  return (
    <div className="adminPage">
      <header className="adminTopBar compactAdminTopBar">
        <div className="adminTopItem">
          <span className="adminTopLabel">First Name</span>
          <span>{profile?.first_name || 'Not set'}</span>
        </div>
        <div className="adminTopItem">
          <span className="adminTopLabel">Last Name</span>
          <span>{profile?.last_name || 'Not set'}</span>
        </div>
        <div className="adminTopItem">
          <span className="adminTopLabel">Email</span>
          <span>{profile?.email || user?.email || 'Unavailable'}</span>
        </div>
        <div className="adminTopItem adminTopAction">
          <span className="adminTopLabel">Session</span>
          <button type="button" className="adminButton logoutButton" onClick={handleLogout}>
            Log Out
          </button>
        </div>
      </header>

      <div className="adminLayout">
        <aside className="adminSidebar">
          <h2>Manage Tickets</h2>
          <div className="adminFilterGroup">
            {adminFilters.map((filter) => (
              <button
                key={filter}
                type="button"
                className={`adminFilterButton ${activeFilter === filter ? 'active' : ''}`}
                onClick={() => setActiveFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>
        </aside>

        <section className="adminTicketListPanel">
          <div className="panelHeaderRow">
            <h2>Submitted Tickets</h2>
            <span>{filteredTickets.length} ticket(s)</span>
          </div>

          <div className="adminTicketList">
            {filteredTickets.length > 0 ? (
              filteredTickets.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  className={`adminTicketCard ${selectedTicket?.id === ticket.id ? 'active' : ''}`}
                  onClick={() => handleSelectTicket(ticket)}
                >
                  <div className="adminTicketCardRow">
                    <strong>{ticket.title}</strong>
                    <span className={`priorityBadge priority${ticket.priority ?? 'Medium'}`}>
                      {ticket.priority ?? 'Medium'}
                    </span>
                  </div>
                  <p>{truncateDescription(ticket.description)}</p>
                  <div className="adminTicketCardMeta">
                    <span>{ticket.category}</span>
                    <span>{formatDate(ticket.created_at)}</span>
                  </div>
                </button>
              ))
            ) : (
              <div className="emptyState">No tickets found for the selected filter.</div>
            )}
          </div>
        </section>

        <section className="adminDetailPanel">
          {selectedTicket ? (
            <>
              <div className="adminDetailHeader">
                <h2>{selectedTicket.title}</h2>
                <span className={`statusBadge status${selectedTicket.status.replace(/\s/g, '')}`}>
                  {selectedTicket.status}
                </span>
              </div>

              <div className="adminDetailGrid">
                <div className="detailBox">
                  <span className="detailLabel">From</span>
                  <span>{selectedTicketOwnerName}</span>
                </div>
                <div className="detailBox">
                  <span className="detailLabel">User Email</span>
                  <span>{selectedTicket.profiles?.email ?? 'Unavailable'}</span>
                </div>
                <div className="detailBox">
                  <span className="detailLabel">Category</span>
                  <span>{selectedTicket.category}</span>
                </div>
                <div className="detailBox">
                  <span className="detailLabel">Priority</span>
                  <span className={`priorityBadge priority${selectedTicket.priority ?? 'Medium'}`}>
                    {selectedTicket.priority ?? 'Medium'}
                  </span>
                </div>
                <div className="detailBox">
                  <span className="detailLabel">Via</span>
                  <span>{selectedTicket.source ?? 'website'}</span>
                </div>
                <div className="detailBox">
                  <span className="detailLabel">Created At</span>
                  <span>{formatDate(selectedTicket.created_at)}</span>
                </div>
              </div>

              <div className="detailDescriptionBox">
                <span className="detailLabel">Full Description</span>
                <p>{selectedTicket.description}</p>
              </div>

              {solvedArchiveSummary ? (
                <div className="archiveCountdownBox">
                  <span className="detailLabel">Archive Countdown</span>
                  <p>
                    This ticket will be archived on {solvedArchiveSummary.archiveDateLabel} (
                    {solvedArchiveSummary.daysRemaining}{' '}
                    day{solvedArchiveSummary.daysRemaining === 1 ? '' : 's'} remaining).
                  </p>
                </div>
              ) : null}

              <form className="adminForm" onSubmit={handleTicketUpdate}>
                <h3>Update Ticket</h3>

                <div className="adminField">
                  <label htmlFor="status">Status</label>
                  <select
                    id="status"
                    name="status"
                    value={ticketEditForm.status}
                    onChange={handleTicketEditChange}
                    disabled={isTicketLocked}
                  >
                    {editableStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="adminField">
                  <label htmlFor="priority">Priority</label>
                  <select
                    id="priority"
                    name="priority"
                    value={ticketEditForm.priority}
                    onChange={handleTicketEditChange}
                    disabled={isTicketLocked}
                  >
                    {priorityOptions.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </div>

                {ticketStatus.message ? (
                  <p className={`adminMessage ${ticketStatus.type}`}>{ticketStatus.message}</p>
                ) : null}

                <button type="submit" className="adminButton" disabled={isSavingTicket || isTicketLocked}>
                  {isSavingTicket ? 'Saving...' : 'Save Ticket Changes'}
                </button>
              </form>

              <form className="adminForm" onSubmit={handleCommentSubmit}>
                <div className="replyHeaderRow">
                  <h3>{commentForm.parentCommentId ? 'Reply in Thread' : 'Add Response or Note'}</h3>
                  {commentForm.parentCommentId ? (
                    <button
                      type="button"
                      className="replyLinkButton"
                      onClick={() => setCommentForm(initialCommentForm)}
                    >
                      Clear thread target
                    </button>
                  ) : null}
                </div>

                {commentForm.parentCommentId ? (
                  <p className="adminHelperText">
                    This entry will be posted as a threaded reply to the selected comment.
                  </p>
                ) : null}

                <div className="adminField">
                  <label htmlFor="commentType">Type</label>
                  <select
                    id="commentType"
                    name="commentType"
                    value={commentForm.commentType}
                    onChange={handleCommentChange}
                    disabled={isTicketLocked}
                  >
                    <option value="response">Response</option>
                    <option value="note">Internal Note</option>
                  </select>
                </div>

                <div className="adminField">
                  <label htmlFor="commentTitle">Header</label>
                  <input
                    id="commentTitle"
                    name="commentTitle"
                    type="text"
                    value={commentForm.commentTitle}
                    onChange={handleCommentChange}
                    disabled={isTicketLocked}
                  />
                </div>

                

                <div className="adminField">
                  <label htmlFor="commentText">Message</label>
                  <textarea
                    id="commentText"
                    name="commentText"
                    rows="4"
                    value={commentForm.commentText}
                    onChange={handleCommentChange}
                    disabled={isTicketLocked}
                    required
                  />
                </div>

                {commentStatus.message ? (
                  <p className={`adminMessage ${commentStatus.type}`}>{commentStatus.message}</p>
                ) : null}

                <button type="submit" className="adminButton" disabled={isSubmittingComment || isTicketLocked}>
                  {isSubmittingComment ? 'Adding...' : 'Add Entry'}
                </button>
              </form>

              <div className="commentHistory">
                <h3>Responses and Notes</h3>
                {threadedComments.length > 0 ? (
                  renderCommentThread(threadedComments)
                ) : (
                  <div className="emptyState">No responses or notes for this ticket yet.</div>
                )}
              </div>

              <div className="commentHistory">
                <h3>Admin Action Log</h3>
                {adminActionLog.length > 0 ? (
                  adminActionLog.map((entry) => (
                    <div key={entry.id} className="commentCard">
                      <div className="commentHeader">
                        <strong>
                          {entry.action === 'created' ? 'Created' : 'Deleted'} {entry.target}
                        </strong>
                        <span>{formatDate(entry.createdAt)}</span>
                      </div>
                      <p>{entry.summary || 'No preview available.'}</p>
                    </div>
                  ))
                ) : (
                  <div className="emptyState">No admin comment actions yet in this session.</div>
                )}
              </div>
            </>
          ) : (
            <div className="emptyState">Select a ticket to view and manage its details.</div>
          )}
        </section>
      </div>
    </div>
  )
}
