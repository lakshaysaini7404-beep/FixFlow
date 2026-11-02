const API_URL = "http://localhost:5000/api";

function getToken() {
  return localStorage.getItem("token");
}



async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || "Request failed");
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export const api = {
  register: (body) => request("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  registerWorker: (body) =>
    request("/auth/register-worker", { method: "POST", body: JSON.stringify(body) }),
  login: (body) => request("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  me: () => request("/auth/me"),
  updateProfile: (body) =>
    request("/auth/profile", { method: "PATCH", body: JSON.stringify(body) }),
  changePassword: (body) =>
    request("/auth/change-password", { method: "POST", body: JSON.stringify(body) }),
  forgotPassword: (body) =>
    request("/auth/forgot-password", { method: "POST", body: JSON.stringify(body) }),
  updateWorkerLocation: (id, latitude, longitude) =>
  request(`/workers/tickets/${id}/location`, {
    method: "POST",
    body: JSON.stringify({ latitude, longitude }),
  }),
resetPassword: (body) =>
    request(`/auth/reset-password/${encodeURIComponent(body.token)}`, {
        method: "POST",
        body: JSON.stringify({ password: body.password }),
    }),

  createTicket: (formData) =>
    request("/tickets", { method: "POST", body: formData }),
  myTickets: (params = "") => request(`/tickets/my${params}`),
  getTicket: (id) => request(`/tickets/${id}`),
  comment: (id, body) =>
    request(`/tickets/${id}/comments`, { method: "POST", body: JSON.stringify({ body }) }),
  confirm: (id) => request(`/tickets/${id}/confirm-resolution`, { method: "POST" }),
  reopen: (id, reason) =>
    request(`/tickets/${id}/reopen`, { method: "POST", body: JSON.stringify({ reason }) }),
  review: (id, body) =>
    request(`/tickets/${id}/reviews`, { method: "POST", body: JSON.stringify(body) }),

  availableTickets: () => request("/workers/available-tickets"),
  myJobs: () => request("/workers/my-jobs"),
  myStats: () => request("/workers/my-stats"),
  acceptanceLimit: () => request("/workers/my-acceptance-limit"),
  acceptTicket: (id) => request(`/workers/tickets/${id}/accept`, { method: "POST" }),
  ignoreTicket: (id) => request(`/workers/tickets/${id}/ignore`, { method: "POST" }),
  startJob: (id) => request(`/workers/tickets/${id}/start`, { method: "POST" }),
  addNotes: (id, notes) =>
    request(`/workers/tickets/${id}/notes`, { method: "POST", body: JSON.stringify({ notes }) }),
  resolveJob: (id, formData) =>
    request(`/workers/tickets/${id}/resolve`, { method: "POST", body: formData }),

  adminDashboard: () => request("/admin/dashboard"),
  adminTickets: (params = "") => request(`/admin/tickets${params}`),
  assignWorker: (id, workerId) =>
    request(`/admin/tickets/${id}/assign`, {
      method: "PATCH",
      body: JSON.stringify({ workerId }),
    }),
updateTicketStatus: (id, status) =>
  request(`/admin/tickets/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  }),

updatePriority: (id, priority) =>
  request(`/admin/tickets/${id}/priority`, {
    method: "PATCH",
    body: JSON.stringify({ priority }),
  }),
  adminUsers: () => request("/admin/users"),
  userStatus: (id, isActive) =>
    request(`/admin/users/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
    }),
  adminWorkers: () => request("/admin/workers"),
  workerStatus: (id, body) =>
    request(`/admin/workers/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  reports: () => request("/admin/reports"),

  notifications: () => request("/notifications"),
  markRead: (id) => request(`/notifications/${id}/read`, { method: "PATCH" }),
  markAllRead: () => request("/notifications/read-all", { method: "PATCH" }),
};

export { API_URL };
