
import { useEffect, useState, useCallback } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";

import ThemeToggle from "./ThemeToggle";

import {
  Bell,
  ClipboardList,
  Home,
  LogOut,
  MapPin,
  Search,
  Settings,
  User,
  Wrench,
  BarChart3,
  PlusCircle,
  Users,
  Menu,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";

import "../pages/workerDashboard/WorkerDashboard.css";
import "../styles/app-extra.css";

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

const navByRole = {
  user: [
    { to: "/user-dashboard", label: "Home", icon: Home },
    { to: "/report-issue", label: "Report an Issue", icon: PlusCircle },
    { to: "/my-tickets", label: "My Tickets", icon: ClipboardList },
    { to: "/notifications", label: "Notifications", icon: Bell },
    { to: "/profile", label: "Profile", icon: User },
  ],

  worker: [
    { to: "/worker-dashboard", label: "Home", icon: Home },
    { to: "/explore-tickets", label: "Explore Tickets", icon: Search },
    { to: "/my-jobs", label: "My Assigned Tickets", icon: ClipboardList },
    { to: "/notifications", label: "Notifications", icon: Bell },
    { to: "/profile", label: "Profile", icon: User },
  ],

  admin: [
    { to: "/admin-dashboard", label: "Overview", icon: Home },
    { to: "/admin/tickets", label: "All Tickets", icon: ClipboardList },
    { to: "/admin/users", label: "Users", icon: Users },
    { to: "/admin/workers", label: "Workers", icon: Wrench },
    { to: "/admin/reports", label: "Reports", icon: BarChart3 },
    { to: "/notifications", label: "Notifications", icon: Bell },
    { to: "/profile", label: "Settings", icon: Settings },
  ],
};

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [unread, setUnread] = useState(0);
  const [query, setQuery] = useState("");

  // Fetch accurate unread count from backend.
  const refreshUnread = useCallback(async () => {
    try {
      const data = await api.notifications();
      setUnread(Number(data.unread) || 0);
    } catch (error) {
      console.error("Failed to refresh unread notifications:", error);
    }
  }, []);

  // Initial load and notification updates.
  useEffect(() => {
    if (!user?.role) return;

    refreshUnread();

    const handleNotificationUpdate = () => {
      refreshUnread();
    };

    window.addEventListener(
      "notifications-updated",
      handleNotificationUpdate
    );

    return () => {
      window.removeEventListener(
        "notifications-updated",
        handleNotificationUpdate
      );
    };
  }, [user?.role, refreshUnread]);

  // Socket.IO real-time notification listener.
  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token || !user?.role) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on("connect", () => {
      console.log("FixFlow notification socket connected:", socket.id);
      refreshUnread();
    });

    socket.on("notification:new", (notification) => {
      console.log("LIVE NOTIFICATION RECEIVED:", notification);

      // Fetch accurate count instead of blindly incrementing.
      refreshUnread();

      // Update Notifications page if it is currently open.
      window.dispatchEvent(
        new CustomEvent("notifications-updated", {
          detail: notification,
        })
      );
    });

    socket.on("connect_error", (error) => {
      console.error("Notification socket error:", error.message);
    });

    socket.on("disconnect", (reason) => {
      console.log("Notification socket disconnected:", reason);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [user?.role, refreshUnread]);

  const items = navByRole[user?.role] || [];

  const onSearch = (e) => {
    e.preventDefault();

    if (!query.trim()) return;

    if (user?.role === "admin") {
      navigate(`/admin/tickets?q=${encodeURIComponent(query)}`);
    } else if (user?.role === "user") {
      navigate(`/my-tickets?q=${encodeURIComponent(query)}`);
    } else {
      navigate(`/explore-tickets?q=${encodeURIComponent(query)}`);
    }
  };

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="logo-section">
          <div className="logo-icon">🔧</div>

          <div>
            <h1>
              Fix<span>Flow</span>
            </h1>
            <p>Work Smarter • Fix Faster</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          {items.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `nav-item ${isActive ? "active" : ""}`
                }
              >
                <Icon size={21} />
                <span>{item.label}</span>

                {item.to === "/notifications" && unread > 0 && (
                  <span className="notification-badge">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="worker-mini-profile">
            <div className="worker-avatar">
              {user?.role === "worker"
                ? "👷"
                : user?.role === "admin"
                  ? "🛡️"
                  : "👤"}
            </div>

            <div>
              <h4>Hi, {user?.name?.split(" ")[0]}</h4>
              <p>{user?.category || user?.role}</p>

              <div className="online-status">
                <span></span>
                Online
              </div>
            </div>
          </div>

          <button
            className="help-card logout-card"
            onClick={() => {
              logout();
              navigate("/");
            }}
          >
            <div className="help-icon">
              <LogOut size={18} />
            </div>

            <div>
              <h4>Sign out</h4>
              <p>End this session</p>
            </div>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button className="menu-button" type="button">
            <Menu size={22} />
          </button>

          <form className="search-box" onSubmit={onSearch}>
            <Search size={19} />

            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tickets, locations, or issues..."
            />
          </form>

          <div className="topbar-right">
            <button className="location-button" type="button">
              <MapPin size={18} />
              {user?.serviceArea || user?.address || "Service area"}
            </button>

            <button
              className="notification-button"
              type="button"
              onClick={() => navigate("/notifications")}
            >
              <Bell size={21} />

              {unread > 0 && (
                <span>{unread > 99 ? "99+" : unread}</span>
              )}
            </button>

            <button
              className="profile-menu"
              type="button"
              onClick={() => navigate("/profile")}
            >
              <div className="profile-avatar">
                {user?.role === "worker" ? "👷" : "👤"}
              </div>

              <div className="profile-info">
                <strong>{user?.name}</strong>
                <small>{user?.role}</small>
              </div>
            </button>

            <div className="navbar-actions">
              <ThemeToggle />
            </div>
          </div>
        </header>

        <div className="content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export { dashboardPath } from "../context/AuthContext";

export function StatCard({
  icon,
  title,
  value,
  action,
  type,
  onClick,
}) {
  return (
    <div className={`stat-card ${type}`}>
      <div className="stat-icon">{icon}</div>

      <div className="stat-info">
        <span>{title}</span>
        <strong>{value}</strong>

        {action && (
          <button type="button" onClick={onClick}>
            {action}
          </button>
        )}
      </div>
    </div>
  );
}
