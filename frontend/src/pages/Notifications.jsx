
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState({});
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      setError("");

      const data = await api.notifications();
      setItems(data.notifications || []);
    } catch (err) {
      setError(err.message || "Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Mark one notification as read
  const handleMarkRead = async (id) => {
    if (busy[id]) return true;

    const previousItems = items;

    // Immediately update UI
    setItems((current) =>
      current.map((item) =>
        item._id === id ? { ...item, read: true } : item
      )
    );

    setBusy((current) => ({ ...current, [id]: true }));

    try {
      await api.markRead(id);

      window.dispatchEvent(new Event("notifications-updated"));

      return true;
    } catch (err) {
      setError(err.message || "Could not mark notification as read.");
      setItems(previousItems);

      return false;
    } finally {
      setBusy((current) => ({ ...current, [id]: false }));
    }
  };

  // Open ticket and mark notification as read first
  const handleOpen = async (item) => {
    if (!item.read) {
      const success = await handleMarkRead(item._id);

      if (!success) return;
    }

    const ticketId = item.ticket?._id || item.ticket;

    if (ticketId) {
      navigate(`/tickets/${ticketId}`);
    }
  };

  // Mark all notifications as read
  const handleMarkAllRead = async () => {
    const previousItems = items;

    setItems((current) =>
      current.map((item) => ({ ...item, read: true }))
    );

    try {
      setError("");

      await api.markAllRead();

      window.dispatchEvent(new Event("notifications-updated"));

      await load();
    } catch (err) {
      setError(err.message || "Could not mark all notifications as read.");
      setItems(previousItems);
    }
  };

  return (
    <div className="list-card">
      <div className="panel-header" style={{ padding: 0, marginBottom: 12 }}>
        <h2>Notifications</h2>

        <button
          className="ghost-btn"
          onClick={handleMarkAllRead}
          disabled={loading || items.every((item) => item.read)}
        >
          Mark all read
        </button>
      </div>

      {error && <p role="alert">{error}</p>}

      {loading ? (
        <p className="empty-state">Loading notifications...</p>
      ) : items.length === 0 ? (
        <p className="empty-state">You are all caught up.</p>
      ) : (
        items.map((item) => (
          <div
            className={`notif-item ${item.read ? "" : "unread"}`}
            key={item._id}
          >
            <div>
              <strong>{item.message}</strong>

              <p style={{ color: "#8ea7c8", marginTop: 6 }}>
                {new Date(item.createdAt).toLocaleString()}
              </p>
            </div>

            <div className="ticket-actions">
              {!item.read && (
                <button
                  className="ghost-btn"
                  disabled={!!busy[item._id]}
                  onClick={() => handleMarkRead(item._id)}
                >
                  {busy[item._id] ? "Saving..." : "Read"}
                </button>
              )}

              {item.ticket && (
                <button
                  className="ticket-view"
                  disabled={!!busy[item._id]}
                  onClick={() => handleOpen(item)}
                >
                  Open
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
