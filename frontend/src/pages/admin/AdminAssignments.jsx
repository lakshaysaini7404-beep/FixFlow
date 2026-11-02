
import React, { useState } from "react";

import {
  GitBranch,
  RefreshCw,
  Plus,
  User,
  ClipboardList,
  ArrowRightLeft,
} from "lucide-react";

import { adminApi, rowsFrom } from "../../services/adminApi";
import useAdminResource from "./useAdminResource";

import {
  PageHeader,
  Panel,
  Button,
  DataState,
  Table,
  StatusBadge,
  Field,
  formatDate,
} from "../../components/AdminUI";

export default function AdminAssignments() {
  const r = useAdminResource(adminApi.assignments, []);

  const [ticketId, setTicketId] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  const rows = rowsFrom(r.data);

  const [reassignTicket, setReassignTicket] = useState("");
  const [reassignWorker, setReassignWorker] = useState("");
  const [reassigning, setReassigning] = useState(false);

  const submit = async (e) => {
    e.preventDefault();

    setSaving(true);
    setMessage("");

    try {
      const response = await adminApi.createAssignment({
        ticketId: ticketId.trim(),
        workerId: workerId.trim(),
      });

      setMessage(response.message || "Worker assigned successfully.");
      setMessageType("success");

      setTicketId("");
      setWorkerId("");

      await r.reload();
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  };

  const handleReassign = async (e) => {
    e.preventDefault();

    setReassigning(true);
    setMessage("");

    try {
      const response = await adminApi.reassignWorker(
        reassignTicket.trim(),
        reassignWorker.trim()
      );

      setMessage(response.message || "Worker reassigned successfully.");
      setMessageType("success");

      setReassignTicket("");
      setReassignWorker("");

      await r.reload();
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setReassigning(false);
    }
  };

  const assignedCount = rows.length;

  const activeCount = rows.filter((a) =>
    ["Assigned", "In Progress"].includes(a.status)
  ).length;

  const completedCount = rows.filter((a) =>
    ["Resolved", "Closed"].includes(a.status)
  ).length;

  const workerCount = new Set(
    rows.map((a) => a.assignedWorker?._id).filter(Boolean)
  ).size;

  const columns = [
    {
      key: "ticket",
      label: "Ticket",
      render: (a) => (
        <div>
          <strong>{a.ticketNumber || a.title || "Ticket"}</strong>
          <div className="muted-text">{a.title || a._id}</div>
        </div>
      ),
    },
    {
      key: "category",
      label: "Category",
      render: (a) => a.category || "—",
    },
    {
      key: "worker",
      label: "Assigned Worker",
      render: (a) => (
        <div>
          <strong>{a.assignedWorker?.name || "Unknown"}</strong>
          <div className="muted-text">
            {a.assignedWorker?.email || ""}
          </div>
        </div>
      ),
    },
    {
      key: "priority",
      label: "Priority",
      render: (a) => <StatusBadge value={a.priority || "Medium"} />,
    },
    {
      key: "status",
      label: "Status",
      render: (a) => <StatusBadge value={a.status || "Assigned"} />,
    },
    {
      key: "createdAt",
      label: "Created",
      render: (a) => formatDate(a.createdAt),
    },
    {
      key: "updatedAt",
      label: "Updated",
      render: (a) => formatDate(a.updatedAt),
    },
    {
      key: "ticketId",
      label: "Ticket ID",
      render: (a) => (
        <button
          type="button"
          className="text-button"
          onClick={() => {
            setReassignTicket(a._id);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          Select ticket
        </button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Assignments"
        subtitle="Manage maintenance tickets and worker assignments."
        action={
          <Button
            variant="secondary"
            onClick={r.reload}
            disabled={r.loading}
          >
            <RefreshCw size={15} />
            Refresh
          </Button>
        }
      />

      <div className="detail-grid">
        <Panel
          title="Create Assignment"
          subtitle="Assign a ticket to an active and approved worker."
        >
          <form className="form-stack" onSubmit={submit}>
            <Field label="Ticket ID">
              <input
                required
                value={ticketId}
                onChange={(e) => setTicketId(e.target.value)}
                placeholder="Enter ticket MongoDB ID"
              />
            </Field>

            <Field label="Worker ID">
              <input
                required
                value={workerId}
                onChange={(e) => setWorkerId(e.target.value)}
                placeholder="Enter worker MongoDB ID"
              />
            </Field>

            <Button type="submit" disabled={saving}>
              <Plus size={15} />
              {saving ? "Assigning..." : "Assign Worker"}
            </Button>
          </form>
        </Panel>

        <Panel
          title="Reassign Worker"
          subtitle="Move an existing ticket to another worker."
        >
          <form className="form-stack" onSubmit={handleReassign}>
            <Field label="Ticket ID">
              <input
                required
                value={reassignTicket}
                onChange={(e) => setReassignTicket(e.target.value)}
                placeholder="Enter existing ticket ID"
              />
            </Field>

            <Field label="New Worker ID">
              <input
                required
                value={reassignWorker}
                onChange={(e) => setReassignWorker(e.target.value)}
                placeholder="Enter new worker ID"
              />
            </Field>

            <Button type="submit" disabled={reassigning}>
              <ArrowRightLeft size={15} />
              {reassigning ? "Reassigning..." : "Reassign Worker"}
            </Button>
          </form>
        </Panel>
      </div>

      {message && (
        <Panel title="Assignment Result">
          <p
            style={{
              color: messageType === "error" ? "#dc2626" : "#16a34a",
            }}
          >
            {message}
          </p>
        </Panel>
      )}

      <div className="detail-grid">
        <Panel title="Total Assignments">
          <h2>{assignedCount}</h2>
          <p className="muted-text">Assigned tickets</p>
        </Panel>

        <Panel title="Active Assignments">
          <h2>{activeCount}</h2>
          <p className="muted-text">Assigned or in progress</p>
        </Panel>

        <Panel title="Completed Assignments">
          <h2>{completedCount}</h2>
          <p className="muted-text">Resolved or closed</p>
        </Panel>

        <Panel title="Workers Assigned">
          <h2>{workerCount}</h2>
          <p className="muted-text">Unique assigned workers</p>
        </Panel>
      </div>

      <Panel
        title="Assignment Queue"
        subtitle="All currently assigned maintenance tickets."
      >
        <DataState
          loading={r.loading}
          error={r.error}
          empty={!r.loading && !r.error && rows.length === 0}
          onRetry={r.reload}
        />

        {!r.loading && !r.error && rows.length > 0 && (
          <Table rows={rows} columns={columns} />
        )}
      </Panel>
    </>
  );
}
