
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock3,
  MapPin,
  PlusCircle,
  Zap,
} from "lucide-react";

import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { StatCard } from "../components/Layout";
import "./UserDashboard.css";

export default function UserDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    api.myTickets()
      .then((data) => {
        if (!active) return;
        setTickets(data.tickets || []);
        setStats(data.stats || {});
      })
      .catch((err) => {
        if (active) setError(err.message || "Unable to load tickets.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good Morning" :
    hour < 18 ? "Good Afternoon" : "Good Evening";

  return (
    <>
      <section className="welcome-banner">
        <div className="welcome-text">
          <h2>
            👋 {greeting}, {user?.name?.split(" ")[0] || "User"}!
          </h2>
          <p>Report issues, track repairs, and confirm when the work is done.</p>

          <button
            className="primary-btn"
            style={{ marginTop: 16 }}
            onClick={() => navigate("/report-issue")}
          >
            <PlusCircle size={16} /> Report an Issue
          </button>
        </div>
      </section>

      <section className="stats-grid">
        <StatCard icon={<ClipboardList />} title="Open" value={stats.open || 0} action="View" type="blue" onClick={() => navigate("/my-tickets")} />
        <StatCard icon={<Clock3 />} title="In Progress" value={stats.inProgress || 0} action="Track" type="orange" onClick={() => navigate("/my-tickets")} />
        <StatCard icon={<CheckCircle2 />} title="Resolved" value={stats.resolved || 0} action="Confirm" type="green" onClick={() => navigate("/my-tickets")} />
        <StatCard icon={<Zap />} title="Urgent / High" value={stats.urgent || 0} action="View" type="cyan" onClick={() => navigate("/my-tickets")} />
      </section>

      <section className="dashboard-grid">
        <div className="panel tickets-panel">
          <div className="panel-header">
            <div className="panel-title">
              <ClipboardList size={21} />
              <h3>My Tickets</h3>
              <span className="count-badge">{tickets.length}</span>
            </div>

            <button className="view-all" onClick={() => navigate("/my-tickets")}>
              View All <ArrowRight size={16} />
            </button>
          </div>

          {error && <p className="alert error">{error}</p>}

          {loading ? (
            <p className="empty-state">Loading tickets...</p>
          ) : (
            <TicketTable
              tickets={tickets.slice(0, 6)}
              onView={(id) => navigate(`/tickets/${id}`)}
            />
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <MapPin size={21} />
              <h3>Recent Activity</h3>
            </div>
          </div>

          <div className="timeline">
            {tickets.slice(0, 5).map((ticket) => (
              <div className="timeline-item" key={ticket._id}>
                <div className="timeline-dot blue"></div>

                <div className="timeline-time">
                  {ticket.updatedAt
                    ? new Date(ticket.updatedAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Recently"}
                </div>

                <div className="timeline-details">
                  <strong>{ticket.title}</strong>
                  <small>{ticket.location?.address || "Location unavailable"}</small>
                </div>

                <span className={`schedule-status ${(ticket.status || "open").toLowerCase().replace(/\s+/g, "-")}`}>
                  {ticket.status || "Open"}
                </span>
              </div>
            ))}

            {!loading && tickets.length === 0 && (
              <p className="empty-state">No tickets yet. Report your first issue.</p>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

/* Ticket Table Component */

export function TicketTable({ tickets, onView }) {
  if (!tickets.length) {
    return <p className="empty-state">No tickets to show.</p>;
  }

  const priorityClass = (priority) => {
    const value = (priority || "Low").toLowerCase();

    if (["high", "urgent", "critical"].includes(value)) return "high";
    if (value === "medium") return "medium";
    return "low";
  };

  const statusClass = (status) =>
    (status || "Open").toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="redesigned-ticket-table">
      <table>
        <thead>
          <tr>
            <th>Ticket ID</th>
            <th>Issue Details</th>
            <th>Location</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Last Updated</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {tickets.map((ticket) => (
            <tr key={ticket._id}>
              <td>
                <div className="new-ticket-id">
                  <span className={`priority-indicator ${priorityClass(ticket.priority)}`} />
                  <strong>{ticket.ticketNumber || "N/A"}</strong>
                </div>
              </td>

              <td>
                <div className="new-ticket-issue">
                  <strong>{ticket.title || "Untitled Issue"}</strong>
                  <small>{ticket.category || "General"}</small>
                </div>
              </td>

              <td>
                <div className="new-ticket-location">
                  <MapPin size={14} />
                  <span>{ticket.location?.address || "Not specified"}</span>
                </div>
              </td>

              <td>
                <span className={`new-priority ${priorityClass(ticket.priority)}`}>
                  {ticket.priority || "Low"}
                </span>
              </td>

              <td>
                <span className={`new-status ${statusClass(ticket.status)}`}>
                  <span className="status-indicator" />
                  {ticket.status || "Open"}
                </span>
              </td>

              <td>
                <span className="new-ticket-date">
                  {ticket.updatedAt
                    ? new Date(ticket.updatedAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : "N/A"}
                </span>
              </td>

              <td>
                <button
                  className="new-view-button"
                  onClick={() => onView(ticket._id)}
                >
                  View <ArrowRight size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
