
import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";

import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import NavigationMap from "../components/NavigationMap";
import LiveWorkerTracking from "../components/LiveWorkerTracking";
import "./TicketDetails.css";

const SOCKET_URL = "http://localhost:5000";

export default function TicketDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [data, setData] = useState(null);
  const [comment, setComment] = useState("");
  const [notes, setNotes] = useState("");
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState("");
  const [message, setMessage] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [showIgnorePopup, setShowIgnorePopup] = useState(false);
  const [autoStartNavigation, setAutoStartNavigation] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await api.getTicket(id);
      setData(result);
      return result;
    } catch (error) {
      setMessage(error.message || "Unable to load ticket");
      throw error;
    }
  }, [id]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  // Refresh the user's ticket automatically when the worker starts the job.
  useEffect(() => {
    if (!data?.ticket || user?.role !== "user") return;

    const ticket = data.ticket;
    const currentUserId = String(user?._id || user?.id || "");
    const ownerId = String(
      ticket.createdBy?._id || ticket.createdBy || ""
    );

    if (!currentUserId || ownerId !== currentUserId) return;

    const token = localStorage.getItem("token");
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    const handleStatusUpdate = (payload) => {
      const updatedTicket = payload?.ticket || payload;
      const updatedTicketId = String(
        updatedTicket?._id || updatedTicket?.id || ""
      );

      if (updatedTicketId === String(id)) {
        load().catch(() => {});
      }
    };

    socket.on("ticket:status-updated", handleStatusUpdate);

    return () => {
      socket.off("ticket:status-updated", handleStatusUpdate);
      socket.disconnect();
    };
  }, [data?.ticket, id, load, user]);

  const run = async (fn) => {
    try {
      setMessage("");
      setActionLoading(true);
      await fn();
      await load();
    } catch (error) {
      setMessage(error.message || "Something went wrong");
    } finally {
      setActionLoading(false);
    }
  };

  const ticket = data?.ticket;

  const currentUserId = String(user?._id || user?.id || "");

  const isOwner =
    user?.role === "user" &&
    String(ticket?.createdBy?._id || ticket?.createdBy || "") ===
      currentUserId;

  const isAssignee =
    user?.role === "worker" &&
    String(
      ticket?.assignedWorker?._id || ticket?.assignedWorker || ""
    ) === currentUserId;

  const normalizedStatus = String(ticket?.status || "")
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .trim();

  const jobStarted = normalizedStatus === "in progress";

  const canAccept =
    user?.role === "worker" &&
    ["Open", "Reopened"].includes(ticket?.status) &&
    !ticket?.assignedWorker;

  const handleAccept = () => {
    run(() => api.acceptTicket(ticket._id));
  };

  const handleStartJob = async () => {
    if (actionLoading || !isAssignee || ticket.status !== "Assigned") {
      return;
    }

    try {
      setMessage("");
      setActionLoading(true);
      setAutoStartNavigation(false);

      await api.startJob(ticket._id);

      const result = await api.getTicket(id);
      setData(result);

      const updatedStatus = String(result?.ticket?.status || "")
        .toLowerCase()
        .replace(/[_-]/g, " ")
        .trim();

      if (updatedStatus !== "in progress") {
        setMessage(
          "The job request was sent, but the ticket status has not changed to In Progress. Please refresh and try again."
        );
        return;
      }

      setAutoStartNavigation(true);
      setMessage("Job started successfully. Starting navigation...");
    } catch (error) {
      setMessage(error.message || "Unable to start the job");
    } finally {
      setActionLoading(false);
    }
  };

  const handleIgnore = async () => {
    try {
      setMessage("");
      setActionLoading(true);

      await api.ignoreTicket(ticket._id);

      setShowIgnorePopup(false);
      navigate(-1);
    } catch (error) {
      setMessage(error.message || "Unable to ignore ticket");
    } finally {
      setActionLoading(false);
    }
  };

  if (!ticket) {
    return (
      <p className="empty-state">
        {message || "Loading ticket..."}
      </p>
    );
  }

  return (
    <>
      <div className="detail-grid">
        {/* MAIN TICKET CARD */}
        <div className="form-card">
          <h2>{ticket.title}</h2>

          <p style={{ color: "#8ea7c8" }}>
            {ticket.ticketNumber} · {ticket.category}
          </p>

          <p style={{ margin: "14px 0" }}>{ticket.description}</p>

          <div className="ticket-actions">
            <span
              className={`priority ${String(
                ticket.priority || "low"
              ).toLowerCase()}`}
            >
              {ticket.priority}
            </span>

            <span
              className={`status ${String(ticket.status || "")
                .toLowerCase()
                .replace(/\s+/g, "-")}`}
            >
              {ticket.status}
            </span>
          </div>

          {/* ATTACHMENTS */}
          {ticket.attachments?.length > 0 && (
            <div className="ticket-attachments">
              {ticket.attachments.map((file, index) => {
                const fileUrl =
                  typeof file === "string" ? file : file.url;

                if (!fileUrl) return null;

                return (
                  <a
                    key={file._id || fileUrl || index}
                    href={fileUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <img
                      src={fileUrl}
                      alt={
                        file.filename ||
                        `Ticket attachment ${index + 1}`
                      }
                    />
                  </a>
                );
              })}
            </div>
          )}

          {ticket.resolutionNotes && (
            <p className="resolution-notes">
              <strong>Resolution:</strong> {ticket.resolutionNotes}
            </p>
          )}

          {/* OWNER AND ASSIGNEE ACTIONS */}
          <div
            className="ticket-actions"
            style={{
              marginTop: 18,
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            {isOwner && ticket.status === "Resolved" && (
              <button
                type="button"
                className="primary-btn"
                disabled={actionLoading}
                onClick={() => run(() => api.confirm(ticket._id))}
              >
                Confirm repair
              </button>
            )}

            {isOwner &&
              ["Resolved", "Closed"].includes(ticket.status) && (
                <button
                  type="button"
                  className="ghost-btn"
                  disabled={actionLoading}
                  onClick={() =>
                    run(() =>
                      api.reopen(ticket._id, "Still not fixed")
                    )
                  }
                >
                  Reopen
                </button>
              )}

            {isAssignee && ticket.status === "Assigned" && (
              <button
                type="button"
                className="primary-btn"
                disabled={actionLoading}
                onClick={handleStartJob}
              >
                {actionLoading ? "Starting..." : "Start Job"}
              </button>
            )}
          </div>

          {/* WORKER'S OWN NAVIGATION */}
          {isAssignee && (
            <NavigationMap
              ticket={ticket}
              jobStarted={jobStarted}
              autoStart={autoStartNavigation}
            />
          )}

          {/* USER'S LIVE WORKER TRACKING */}
          {isOwner && jobStarted && (
            <section style={{ marginTop: 22 }}>
              <h3>Live Worker Tracking</h3>
              <p style={{ margin: "8px 0 14px" }}>
                Your assigned worker has started the job. Follow their
                latest reported location on the map below.
              </p>
              <LiveWorkerTracking ticket={ticket} />
            </section>
          )}

          {/* RESOLUTION FORM */}
          {isAssignee &&
            ["Assigned", "In Progress"].includes(ticket.status) && (
              <form
                style={{ marginTop: 18 }}
                onSubmit={(e) => {
                  e.preventDefault();

                  const formData = new FormData();
                  formData.append("resolutionNotes", notes);

                  run(() => api.resolveJob(ticket._id, formData));
                }}
              >
                <div className="field">
                  <label>Resolution notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="primary-btn"
                  style={{ marginTop: 10 }}
                  disabled={actionLoading || !jobStarted}
                >
                  Mark resolved
                </button>
              </form>
            )}

          {/* REVIEW FORM */}
          {isOwner &&
            ["Resolved", "Closed"].includes(ticket.status) &&
            !data.review && (
              <form
                style={{ marginTop: 18 }}
                onSubmit={(e) => {
                  e.preventDefault();

                  run(() =>
                    api.review(ticket._id, { rating, feedback })
                  );
                }}
              >
                <div className="field">
                  <label>Rating</label>
                  <select
                    value={rating}
                    onChange={(e) => setRating(Number(e.target.value))}
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n} star{n > 1 ? "s" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>Feedback</label>
                  <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  className="primary-btn"
                  style={{ marginTop: 10 }}
                  disabled={actionLoading}
                >
                  Submit review
                </button>
              </form>
            )}

          {/* COMMENTS */}
          <h3 style={{ marginTop: 28 }}>Comments</h3>

          <div className="comment-list">
            {(data.comments || []).map((c) => (
              <div className="comment-item" key={c._id}>
                <strong>{c.author?.name || "User"}</strong>
                <p>{c.body}</p>
              </div>
            ))}
          </div>

          {/* POST + ACCEPT + IGNORE */}
          <form
            onSubmit={(e) => {
              e.preventDefault();

              if (!comment.trim()) return;

              run(async () => {
                await api.comment(ticket._id, comment);
                setComment("");
              });
            }}
          >
            <div className="field">
              <label>Add comment</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Write a comment..."
                required
              />
            </div>

            <div className="ticket-action-buttons">
              <button
                type="submit"
                className="ghost-btn"
                disabled={actionLoading}
              >
                Post
              </button>

              {canAccept && (
                <>
                  <button
                    type="button"
                    className="primary-btn"
                    disabled={actionLoading}
                    onClick={handleAccept}
                  >
                    Accept Ticket
                  </button>

                  <button
                    type="button"
                    className="ghost-btn"
                    disabled={actionLoading}
                    onClick={() => setShowIgnorePopup(true)}
                  >
                    Ignore Ticket
                  </button>
                </>
              )}
            </div>
          </form>

          {message && (
            <p
              className="alert"
              role="status"
              style={{ marginTop: 14 }}
            >
              {message}
            </p>
          )}
        </div>

        {/* SIDEBAR */}
        <div className="form-card">
          <h3>Details</h3>

          <div className="meta-list" style={{ marginTop: 12 }}>
            <div>
              Location: {ticket.location?.address || "Not provided"}
            </div>

            <div>
              Reporter: {ticket.createdBy?.name || "N/A"}
            </div>

            <div>
              Worker: {ticket.assignedWorker?.name || "Unassigned"}
            </div>

            <div>
              Created:{" "}
              {ticket.createdAt
                ? new Date(ticket.createdAt).toLocaleString()
                : "N/A"}
            </div>

            {ticket.acceptedAt && (
              <div>
                Accepted: {new Date(ticket.acceptedAt).toLocaleString()}
              </div>
            )}

            {ticket.resolvedAt && (
              <div>
                Resolved: {new Date(ticket.resolvedAt).toLocaleString()}
              </div>
            )}
          </div>

          <h3 style={{ marginTop: 24 }}>History</h3>

          <div className="history-list">
            {(data.history || []).map((h) => (
              <div className="history-item" key={h._id}>
                <strong>{h.action}</strong>

                <p>
                  {h.actor?.name || "System"} · {h.fromStatus || ""}{" "}
                  {h.toStatus ? `→ ${h.toStatus}` : ""}
                </p>

                <small>{new Date(h.createdAt).toLocaleString()}</small>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* IGNORE CONFIRMATION POPUP */}
      {showIgnorePopup && (
        <div
          className="ignore-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !actionLoading) {
              setShowIgnorePopup(false);
            }
          }}
        >
          <div
            className="ignore-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ignore-title"
            aria-describedby="ignore-description"
          >
            <div className="ignore-modal-icon">!</div>

            <h2 id="ignore-title">Ignore this ticket?</h2>

            <p id="ignore-description">
              Are you sure you want to ignore this ticket? It will be
              removed from your available tickets list. Other eligible
              workers can still see it.
            </p>

            <div className="ignore-modal-actions">
              <button
                type="button"
                className="ghost-btn"
                disabled={actionLoading}
                onClick={() => setShowIgnorePopup(false)}
              >
                No, Go Back
              </button>

              <button
                type="button"
                className="primary-btn ignore-confirm-btn"
                disabled={actionLoading}
                onClick={handleIgnore}
              >
                {actionLoading ? "Ignoring..." : "Yes, Ignore"}
              </button>
            </div>

            {message && (
              <p
                className="alert"
                role="alert"
                style={{ marginTop: 12 }}
              >
                {message}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
