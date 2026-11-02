
import adminEndpoints from "../config/adminEndpoints";

export const API_BASE_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000"
).replace(/\/$/, "");

export class AdminApiError extends Error {
  constructor(message, status = 0, data = null) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
    this.data = data;
  }
}

export async function request(path, options = {}) {
  const token = localStorage.getItem("token");

  const headers = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new AdminApiError(
      `Cannot reach ${API_BASE_URL}. Check that the FixFlow backend is running and CORS allows this frontend.`,
      0
    );
  }

  const raw = await response.text();

  let data = null;

  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw ? { message: raw } : null;
  }

  if (!response.ok) {
    const message =
      data?.message ||
      data?.error ||
      `Request failed (${response.status}) for ${path}.`;

    throw new AdminApiError(message, response.status, data);
  }

  return data;
}

export const adminApi = {
  dashboard: () => request(adminEndpoints.dashboard),

  tickets: (params = "") =>
    request(`${adminEndpoints.tickets}${params ? `?${params}` : ""}`),

  ticket: (id) => request(adminEndpoints.ticket(id)),

  updateTicketStatus: (id, status) =>
    request(adminEndpoints.ticketStatus(id), {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  updatePriority: (id, priority) =>
    request(adminEndpoints.ticketPriority(id), {
      method: "PATCH",
      body: JSON.stringify({ priority }),
    }),

  updateTicket: (id, payload) =>
    request(adminEndpoints.ticket(id), {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  users: (params = "") =>
    request(`${adminEndpoints.users}${params ? `?${params}` : ""}`),

  user: (id) => request(adminEndpoints.user(id)),

  updateUserStatus: (id, isActive) =>
    request(adminEndpoints.userStatus(id), {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
    }),

  workers: (params = "") =>
    request(`${adminEndpoints.workers}${params ? `?${params}` : ""}`),

  worker: (id) => request(adminEndpoints.worker(id)),

  updateWorkerStatus: (id, payload) =>
    request(adminEndpoints.workerStatus(id), {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  assignments: (params = "") =>
    request(`${adminEndpoints.assignments}${params ? `?${params}` : ""}`),

  createAssignment: (payload) =>
    request(adminEndpoints.assignments, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  reassignWorker: (ticketId, workerId) =>
    request(
      `${adminEndpoints.ticket(ticketId)}/reassign`,
      {
        method: "PATCH",
        body: JSON.stringify({ workerId }),
      }
    ),

  analytics: () => request(adminEndpoints.analytics),

  notifications: () => request(adminEndpoints.notifications),

  activityLogs: () => request(adminEndpoints.activityLogs),

  settings: () => request(adminEndpoints.settings),

  saveSettings: (payload) =>
    request(adminEndpoints.settings, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
};

export function rowsFrom(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];

  for (const key of [
    "data",
    "items",
    "results",
    "tickets",
    "users",
    "workers",
    "assignments",
    "notifications",
    "logs",
  ]) {
    if (Array.isArray(data[key])) return data[key];

    if (data[key] && typeof data[key] === "object") {
      for (const nested of ["items", "results", "rows"]) {
        if (Array.isArray(data[key][nested])) {
          return data[key][nested];
        }
      }
    }
  }

  return [];
}

export function objectFrom(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {};
  }

  let result = data;

  if (
    result.data &&
    typeof result.data === "object" &&
    !Array.isArray(result.data)
  ) {
    result = result.data;
  }

  for (const key of ["ticket", "user", "worker"]) {
    if (
      result[key] &&
      typeof result[key] === "object" &&
      !Array.isArray(result[key])
    ) {
      return result[key];
    }
  }

  return result;
}
