import {useState, useEffect } from 'react'
import {useNavigate} from 'react'
import './adminDashboard.css'

function AdminDashboard(){
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [tickets, setTickets] =useState([]);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [responseText, setResponseText] = useState('');

    useEffect(() => {
        const token = localStorage.getItem('token');
        const userData = localStorage.getItem('user');

        if (!token || !userData) {
            navigate ('/login');
            return;
        }

        const parsedUser = JSON.parse(userData);
        if (parsedUser.role !== 'admin'){
            navigate('/user-dashboard');
            return;
        }

        setUser(parsedUser);
        loadAllTickets();
    }, []);

   const loadAllTickets = () => {
    const allTickets = JSON.parse(localStorage.getItem('tickets') || '[]');
    setTickets(allTickets);
};

    const updateTicketStatus = (ticketId, newStatus) => {
    const allTickets = JSON.parse(localStorage.getItem('tickets') || '[]');
    const updatedTickets = allTickets.map(ticket => 
        ticket.id === ticketId ? { ...ticket, status: newStatus } : ticket
    );
    localStorage.setItem('tickets', JSON.stringify(updatedTickets));
    loadAllTickets();
};
        const addResponse = (ticketId) => {
            if (!responseText.trim()){
                alert('Please enter a response.');
                return;
            }

            const allTickets= JSON.parse(localStorage.getItem('tickets') || '[]');
            const updatedTickets= allTickets.map(ticket => {
                if (ticket.id === ticketId){
                    return{
                        ...ticket,
                        responses: [
                            ...(ticket.responses || []),
                            {
                                adminName: `${user.firstName} ${user.lastName}`,
                                message: responseText,
                                timestamp: new Date().toLocaleString()
                            }
                        ]
                    };
                }
                return ticket;
            });

            localStorage.setItem('tickets', JSON.stringify(updatedTickets));
            loadAllTickets();
            setResponseText('');
            setSelectedTicket(null);
        };

        const adminLogout = () => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            navigate('/login');
        };

        if (!user) return <div className = "loading"> Loading...</div>

        return(
             <div className = "dashboard">
            {/*for sided bar nav */}
            <div className = "sidebar">
                <div className= "side-header">
                    <h2> EN-Tech Admmin </h2>
                    <p> Adminstrator Panel </p>
                </div>

                <nav className = "sided-nav">
                    <button className = "active"> All Tickets ({tickets.length})</button>
                    <button className = "logout-btn" onClick = {adminLogout}> Logout</button>
                    </nav>
                </div>

                <div className = "main-content">
                    <div clasName = "top-bar">
                        <div className="user-info">
                            <div className = "user-name"> Admin: {user.firstName} {user.lastName}
                            </div>
                            <div className = "user-email">{user.email}</div>
                        </div>
                        <div className = "user-role">
                            <span className = "role-badge"> Administrator</span>
                    </div>
                </div>

                <div className = "card">
                    <h2> All Support Tickets </h2>
                    {tickets.length === 0 ?(
                        <div className = "empty-state">
                            <p> No tickets submitted yet.</p>
                            <p className = "empty-hnt"> Tickets will appear here when users create them</p>
                        </div>
                    ) : (
                        <div className = "tickets-grid">
                            {tickets.map(ticket => (
                                <div key = {tickets-grid} className = "ticket-card">
                                    <div className = "ticket-header">
                                        <div>
                                            <h3> {ticket.title}</h3>
                                            <p className = "ticket-user"> From: {ticket.userName}</p>
                                            <span className = {`category-badge category-${ticket.category.toLowerCase()}`}>
                                                {ticket.category}
                                            </span>
                                        </div>
                                        <select value = {ticket.status}
                                        onChange = {(e) => updateTicketStatus(ticket.id, e.target.value)}
                                        className = "status-select">
                                            <option value = "Open"> Open</option>
                                            <option value = "In Progress"> In Progress </option>
                                            <option value = "Resolved"> Resolved </option>
                                        </select>
                                        </div>
                                        <div className= "ticket-body">
                                            <p><strong>Description: </strong></p>
                                            <p> {ticket.description}</p>
                                            </div>
                                            <div className = "ticket-footer">
                                                <div clssName = "ticket-meta">
                                                    <span className = "date"> Created: {ticket.createdAt}t</span>
                                                </div>

                                                {ticket.responses && ticket.responses.lenth> 0 &&(
                                                    <div className = "responses">
                                                    <strong> Responses: </strong>
                                                    {ticket.responses.map((resp, idx)=>(
                                                        <div key = {idx} className = "response">
                                                            <strong>{resp.adminName}:</strong> {resp.message}
                                                            <span className = "response-date"> ({resp.timestamp})</span>
                                                            </div>
                                                    ))}
                                                    </div>
                                                )}

                                                {selectedTicket=== ticket.id ? (
                                                    <div className = "response-form">
                                                        <textarea placeholder = "Add response here..."
                                                        value = {responseText}
                                                        onChange = {(e)=> setResponseText(e.target.value)}
                                                        rows = "3"/>
                                                        <div className = "response-buttons">
                                                            <button onClick = {() => addResponse(ticket.id)} className = "submit-btn">
                                                                Send Response
                                                            </button>
                                                            <button onClick = {() => setSelectedTicket(null)} className = "cancel-btn">
                                                                Cancel
                                                            </button>
                                                            </div>
                                                            </div>
                                                ):(
                                                    <button onClick = {() => setSelectedTicket(ticket.id)}
                                                    className = "respond-btn">
                                                        Respond to Ticket
                                                    </button>
                                                
                                                )}
                                                </div>
                                                </div>
                            ))}
                        </div>
                    )}
                </div>
                </div>
                </div>
        );
}

export default AdminDashboard;
