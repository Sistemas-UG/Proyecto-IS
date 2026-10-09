// Cliente HTTP centralizado para hablar con el backend (Node.js + Express).
// Guarda/lee el token JWT-like en localStorage y lo manda en cada request.

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
const TOKEN_KEY = "smartflow_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };

  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // 204 No Content
  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message = data?.error?.message || `Error ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }

  return data;
}

export const api = {
  // Auth
  login: (email, password) => request("/auth/login", { method: "POST", body: { email, password }, auth: false }),
  register: (payload) => request("/auth/register", { method: "POST", body: payload, auth: false }),
  me: () => request("/auth/me"),

  // Flujos
  getFlows: () => request("/flows"),
  getFlow: (id) => request(`/flows/${id}`),
  createFlow: (flow) => request("/flows", { method: "POST", body: flow }),
  updateFlow: (id, flow) => request(`/flows/${id}`, { method: "PUT", body: flow }),
  deleteFlow: (id) => request(`/flows/${id}`, { method: "DELETE" }),

  // IA
  generateFlow: (descripcion, general = false) => request("/ai/generate-flow", { method: "POST", body: { descripcion, general } }),
  generateReport: (flowData) => request("/ai/generate-report", { method: "POST", body: flowData }),

  // Dashboard
  getKpis: () => request("/dashboard/kpis"),
  getRecentFlows: () => request("/dashboard/recent-flows"),

  // Reportes
  getReportsSummary: () => request("/reports/summary"),
  getBottlenecks: () => request("/reports/bottlenecks"),
  getInsights: () => request("/reports/insights"),
  getInsightById: (id) => request(`/reports/insights/${id}`),

  // Usuarios
  getUsers: () => request("/users"),

  // Organizaciones
  getMyOrganization: () => request("/organizations/me"),
  createOrganization: (payload) => request("/organizations", { method: "POST", body: payload }),
  updateMyHierarchy: (jerarquia) => request("/organizations/me/jerarquia", { method: "PUT", body: { jerarquia } }),
  // payload: { nombre?, tipo_industria?, jerarquia? } — actualización parcial,
  // usado desde Configuración para que la IA genere flujos acordes al tipo
  // de empresa y a la jerarquía real (sin asumir gerentes/juntas directivas
  // que esa empresa no tenga).
  updateMyOrganization: (payload) => request("/organizations/me", { method: "PUT", body: payload }),
};