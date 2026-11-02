
const adminEndpoints = {
  dashboard: "/api/admin/dashboard",

  activityLogs: "/api/admin/activity-logs",

  tickets: "/api/admin/tickets",
  ticket: (id) => `/api/admin/tickets/${encodeURIComponent(id)}`,
  ticketStatus: (id) =>
    `/api/admin/tickets/${encodeURIComponent(id)}/status`,
  ticketPriority: (id) =>
    `/api/admin/tickets/${encodeURIComponent(id)}/priority`,

  assignments: "/api/admin/assignments",

  users: "/api/admin/users",
  user: (id) => `/api/admin/users/${encodeURIComponent(id)}`,
  userStatus: (id) =>
    `/api/admin/users/${encodeURIComponent(id)}/status`,

  workers: "/api/admin/workers",
  worker: (id) => `/api/admin/workers/${encodeURIComponent(id)}`,
  workerStatus: (id) =>
    `/api/admin/workers/${encodeURIComponent(id)}/status`,

  analytics: "/api/admin/reports",
  notifications: "/api/notifications",
  settings: "/api/admin/settings",
};

export default adminEndpoints;
