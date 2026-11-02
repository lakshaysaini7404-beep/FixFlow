import "./AdminDashboard.css";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Users,
  RefreshCw,
} from "lucide-react";

import { api } from "../services/api";
import { StatCard } from "../components/Layout";
import { TicketTable } from "./UserDashboard";

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    const fetchDashboard = async () => {
      try {
        const result = await api.adminDashboard();

        if (active) {
          setData(result);
          setError("");
        }
      } catch (err) {
        if (active) {
          setError(err.message || "Unable to load dashboard.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchDashboard();

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="panel admin-loading">
        <RefreshCw size={22} className="admin-loading-icon" />
        <p>Loading operations dashboard...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="panel admin-error">
        <h3>Unable to load dashboard</h3>
        <p>{error || "Dashboard data is unavailable."}</p>

        <button
          className="primary-btn"
          onClick={() => window.location.reload()}
        >
          <RefreshCw size={16} />
          Retry
        </button>
      </div>
    );
  }

  const counts = data.counts || {};

  return (
    <div className="admin-dashboard">

      {/* Welcome Section */}
      <section className="welcome-banner">
        <div className="welcome-text">
          <span className="admin-eyebrow">
            <BarChart3 size={14} />
            ADMIN CONTROL CENTER
          </span>

          <h2>Administrator Overview</h2>

          <p>
            Monitor tickets, assignments, SLA risk, and workforce performance
            from one place.
          </p>
        </div>
      </section>

      {/* Main Statistics */}
      <section className="stats-grid admin-stats-grid">

        <StatCard
          icon={<ClipboardList />}
          title="Open Tickets"
          value={counts.open ?? 0}
          type="blue"
          action="View Tickets"
          onClick={() => navigate("/admin/tickets")}
        />

        <StatCard
          icon={<Clock3 />}
          title="In Progress"
          value={counts.inProgress ?? 0}
          type="orange"
          action="Monitor"
          onClick={() => navigate("/admin/tickets")}
        />

        <StatCard
          icon={<CheckCircle2 />}
          title="Resolved"
          value={counts.resolved ?? 0}
          type="green"
          action="View"
          onClick={() => navigate("/admin/tickets")}
        />

        <StatCard
          icon={<Users />}
          title="Overdue Tickets"
          value={counts.overdue ?? 0}
          type="cyan"
          action="Review"
          onClick={() => navigate("/admin/tickets")}
        />

      </section>

      {/* Performance Statistics */}
      <div className="admin-section-heading">
        <div>
          <h3>Performance Overview</h3>
          <p>Operational efficiency and service performance</p>
        </div>
      </div>

      <section className="stats-grid admin-stats-grid">

        <StatCard
          icon={<BarChart3 />}
          title="Avg. Assignment"
          value={`${data.avgAssignHours ?? 0} hrs`}
          type="blue"
        />

        <StatCard
          icon={<Clock3 />}
          title="Avg. Resolution"
          value={`${data.avgResolutionHours ?? 0} hrs`}
          type="green"
        />

        <StatCard
          icon={<CheckCircle2 />}
          title="SLA Compliance"
          value={`${data.slaCompliance ?? 0}%`}
          type="cyan"
        />

        <StatCard
          icon={<BarChart3 />}
          title="Average Rating"
          value={`${data.avgRating ?? 0}/5`}
          type="orange"
        />

      </section>

      {/* Recent Tickets */}
      <section className="panel admin-recent-panel">

        <div className="panel-header admin-recent-header">
          <div className="panel-title">
            <div className="admin-panel-icon">
              <ClipboardList size={19} />
            </div>

            <div>
              <h3>Recent Tickets</h3>
              <p>Latest maintenance requests across FixFlow</p>
            </div>
          </div>

          <button
            className="view-all"
            onClick={() => navigate("/admin/tickets")}
          >
            View All Tickets
          </button>
        </div>

        <TicketTable
          tickets={data.recent || []}
          onView={(id) => navigate(`/tickets/${id}`)}
        />

      </section>

    </div>
  );
}
