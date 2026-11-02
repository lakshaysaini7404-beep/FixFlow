import React, { useMemo, useState } from "react";
import { Download, RefreshCw, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";

import {
  PageHeader,
  Panel,
  Table,
  DataState,
  SearchBox,
  Button,
} from "../../components/AdminUI";

import { rowsFrom } from "../../services/adminApi";
import useAdminResource from "./useAdminResource";

export default function ResourceTablePage({
  title,
  subtitle,
  loader,
  columns = [],
  searchFields = [],
  detailBase,
  actions,
  emptyLabel,
}) {
  const resource = useAdminResource(loader, [loader]);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  const navigate = useNavigate();

  const rows = useMemo(() => {
    return rowsFrom(resource.data);
  }, [resource.data]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return rows.filter((row) => {
      const fieldsToSearch = searchFields.length
        ? searchFields.map((key) => row?.[key])
        : [
            row?.name,
            row?.fullName,
            row?.email,
            row?.title,
            row?.description,
            row?.category,
            row?.status,
            row?.priority,
            row?.ticketId,
          ];

      const searchableText = fieldsToSearch
        .filter((value) => value !== undefined && value !== null)
        .map((value) =>
          typeof value === "object"
            ? JSON.stringify(value)
            : String(value)
        )
        .join(" ")
        .toLowerCase();

      const matchesQuery = searchableText.includes(normalizedQuery);

      const rowStatus = String(row?.status || "").toLowerCase();
      const selectedStatus = status.toLowerCase();

      const matchesStatus =
        selectedStatus === "all" || rowStatus === selectedStatus;

      return matchesQuery && matchesStatus;
    });
  }, [rows, query, status, searchFields]);

  const fullColumns = useMemo(() => {
    const result = [...columns];

    if (detailBase) {
      result.push({
        key: "_actions",
        label: "Details",
        render: (row) => (
          <Button
            variant="ghost"
            onClick={() => {
              const id = row?._id || row?.id;

              if (id !== undefined && id !== null) {
                navigate(`${detailBase}/${encodeURIComponent(id)}`);
              }
            }}
          >
            <Eye size={15} />
            Open
          </Button>
        ),
      });
    }

    return result;
  }, [columns, detailBase, navigate]);

  // Read a user's name, email and contact from a populated object.
  const getPersonField = (person, field) => {
    if (!person) return "";

    if (typeof person !== "object") {
      return field === "name" ? String(person) : "";
    }

    if (field === "name") {
      return (
        person.name ||
        person.fullName ||
        person.username ||
        person.user?.name ||
        person.user?.fullName ||
        person.worker?.name ||
        person.worker?.fullName ||
        ""
      );
    }

    if (field === "email") {
      return (
        person.email ||
        person.user?.email ||
        person.worker?.email ||
        ""
      );
    }

    if (field === "contact") {
      return (
        person.phone ||
        person.phoneNumber ||
        person.mobile ||
        person.contact ||
        person.contactNumber ||
        person.user?.phone ||
        person.user?.phoneNumber ||
        person.user?.mobile ||
        person.user?.contact ||
        person.worker?.phone ||
        person.worker?.phoneNumber ||
        person.worker?.mobile ||
        ""
      );
    }

    return "";
  };

  const getValue = (row, key) => {
    // Ticket creator details
    if (key === "createdByName") {
      return getPersonField(row?.createdBy, "name");
    }

    if (key === "createdByEmail") {
      return getPersonField(row?.createdBy, "email");
    }

    if (key === "createdByContact") {
      return getPersonField(row?.createdBy, "contact");
    }

    // Assigned worker details
    if (key === "assignedWorkerName") {
      return getPersonField(row?.assignedWorker, "name");
    }

    if (key === "assignedWorkerEmail") {
      return getPersonField(row?.assignedWorker, "email");
    }

    if (key === "assignedWorkerContact") {
      return getPersonField(row?.assignedWorker, "contact");
    }

    if (key === "assignedWorker") {
      return getPersonField(row?.assignedWorker, "name");
    }

    if (key === "ticketNumber") {
      return row?.ticketNumber ?? row?.ticketId ?? "";
    }

    if (key === "createdAt" || key === "created") {
      const value = row?.[key];

      if (!value) return "";

      const date = new Date(value);

      return Number.isNaN(date.getTime())
        ? value
        : date.toISOString();
    }

    const value = row?.[key];

    if (value === null || value === undefined) {
      return "";
    }

    if (Array.isArray(value)) {
      return value
        .map((item) =>
          typeof item === "object"
            ? item?.name || item?.fullName || item?.email || ""
            : String(item)
        )
        .filter(Boolean)
        .join(", ");
    }

    if (typeof value === "object") {
      return (
        value.name ||
        value.fullName ||
        value.username ||
        value.email ||
        value.title ||
        ""
      );
    }

    return value;
  };

  const escapeCSV = (value) => {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
  };

  const exportRows = () => {
    const isTicketExport =
      columns.some((column) => column.key === "title") &&
      columns.some((column) => column.key === "category");

    const exportColumns = isTicketExport
      ? [
          { label: "Ticket ID", key: "ticketNumber" },
          { label: "Issue", key: "title" },
          { label: "Category", key: "category" },
          { label: "Priority", key: "priority" },
          { label: "Status", key: "status" },
          { label: "Created", key: "createdAt" },

          { label: "Reported By", key: "createdByName" },
          { label: "User Email", key: "createdByEmail" },
          { label: "User Contact", key: "createdByContact" },

          { label: "Assigned Worker", key: "assignedWorkerName" },
          { label: "Worker Email", key: "assignedWorkerEmail" },
          { label: "Worker Contact", key: "assignedWorkerContact" },
        ]
      : columns;

    const csv = [
      exportColumns
        .map((column) => escapeCSV(column.label))
        .join(","),

      ...filtered.map((row) =>
        exportColumns
          .map((column) => escapeCSV(getValue(row, column.key)))
          .join(",")
      ),
    ].join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `fixflow-${title
      .toLowerCase()
      .replace(/\s+/g, "-")}.csv`;

    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        action={
          <Button variant="secondary" onClick={resource.reload}>
            <RefreshCw size={15} />
            Refresh
          </Button>
        }
      />

      <Panel
        title={`${title} directory`}
        subtitle={`${filtered.length} record${
          filtered.length === 1 ? "" : "s"
        } shown`}
        action={
          <Button
            variant="secondary"
            onClick={exportRows}
            disabled={!filtered.length}
          >
            <Download size={15} />
            Export CSV
          </Button>
        }
      >
        <div className="table-toolbar">
          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder={`Search ${title.toLowerCase()}...`}
          />

          <label className="filter-select">
            <span>Status</span>

            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="pending">Pending</option>
              <option value="in progress">In progress</option>
              <option value="active">Active</option>
              <option value="resolved">Resolved</option>
              <option value="completed">Completed</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </label>
        </div>

        <DataState
          loading={resource.loading}
          error={resource.error}
          empty={
            !resource.loading &&
            !resource.error &&
            filtered.length === 0
          }
          onRetry={resource.reload}
        />

        {!resource.loading &&
          !resource.error &&
          filtered.length > 0 && (
            <Table columns={fullColumns} rows={filtered} />
          )}
      </Panel>

      {actions && (
        <Panel
          title="Management actions"
          subtitle="Actions are sent to your configured backend endpoints"
        >
          {actions}
        </Panel>
      )}
    </>
  );
}