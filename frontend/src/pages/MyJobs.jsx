
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { api } from "../services/api"
import { TicketTable } from "./UserDashboard";
import TicketNavigation from "../components/TicketNavigation"

export default function MyJobs() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const loadJobs = useCallback(async () => {
    setError("");

    try {
      const data = await api.myJobs();
      setTickets(data.tickets || []);
    } catch (err) {
      setError(err.message || "Unable to load assigned tickets.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  // Only show navigation for jobs accepted by this worker.
  const activeJobs = tickets.filter((ticket) =>
    ["Accepted", "In Progress"].includes(ticket.status)
  );

  return (
    <div className="list-card">
      <div className="my-jobs-header">
        <div>
          <h2>My Assigned Tickets</h2>
          <p>View your assigned jobs and navigate to customers.</p>
        </div>

        <button
          type="button"
          onClick={loadJobs}
          disabled={loading}
          className="my-jobs-refresh"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {error && (
        <p role="alert" className="ticket-navigation-error">
          {error}
        </p>
      )}

      {loading ? (
        <p>Loading your jobs...</p>
      ) : (
        <>
          <TicketTable
            tickets={tickets}
            onView={(id) => navigate(`/tickets/${id}`)}
          />

         
        </>
      )}
    </div>
  );
}
