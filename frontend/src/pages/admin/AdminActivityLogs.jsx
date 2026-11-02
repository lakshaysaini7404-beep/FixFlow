
import React from "react";
import { RefreshCw } from "lucide-react";

import { adminApi, rowsFrom } from "../../services/adminApi";
import useAdminResource from "./useAdminResource";

import {
  PageHeader,
  Panel,
  Button,
  DataState,
  Table,
  StatusBadge,
  formatDate,
} from "../../components/AdminUI";

export default function AdminActivityLogs() {
  const r = useAdminResource(adminApi.activityLogs, []);
  const rows = rowsFrom(r.data);

  return (
    <>
      <PageHeader
        title="Activity Logs"
        subtitle="Monitor all recorded administrative activities."
        action={
          <Button variant="secondary" onClick={r.reload}>
            <RefreshCw size={15} />
            Refresh
          </Button>
        }
      />

      <Panel
        title="Audit Trail"
        subtitle={`${r.data?.total ?? rows.length} total activities`}
      >
        <DataState
          loading={r.loading}
          error={r.error}
          empty={!r.loading && !r.error && rows.length === 0}
          onRetry={r.reload}
        />

        {!r.loading && !r.error && rows.length > 0 && (
          <Table
            rows={rows}
            columns={[
              {
                key: "createdAt",
                label: "Date & Time",
                render: (log) =>
                  formatDate(log.createdAt || log.timestamp),
              },
              {
                key: "actor",
                label: "Performed By",
                render: (log) =>
                  log.actor?.name ||
                  log.actor?.email ||
                  "System",
              },
              {
                key: "action",
                label: "Action",
                render: (log) => (
                  <StatusBadge value={log.action || "Unknown"} />
                ),
              },
              {
                key: "target",
                label: "Target",
                render: (log) =>
                  log.targetType
                    ? `${log.targetType} - ${log.targetId || "N/A"}`
                    : "N/A",
              },
              {
                key: "details",
                label: "Details",
                render: (log) =>
                  log.metadata
                    ? JSON.stringify(log.metadata)
                    : "No additional details",
              },
            ]}
          />
        )}
      </Panel>
    </>
  );
}
