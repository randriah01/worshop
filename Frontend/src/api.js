// Couche d'accès à l'API NovaPay.
// En développement, Vite proxifie /api et /auth vers le WAF (voir vite.config.js).
// En production, le dashboard est servi derrière le même proxy : même origine.

const TOKEN_KEY = "novapay_token";

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(t) {
  try {
    localStorage.setItem(TOKEN_KEY, t);
  } catch {
    /* ignore (mode privé) */
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const t = getToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    clearToken();
    throw new ApiError("Session expirée, reconnecte-toi.", 401);
  }
  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const detail = data && data.detail ? data.detail : `Erreur ${res.status}`;
    throw new ApiError(detail, res.status);
  }
  return data;
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// --- Authentification ---
export async function login(loginName, password) {
  const data = await request("/auth/login", {
    method: "POST",
    auth: false,
    body: { login: loginName, password },
  });
  setToken(data.access_token);
  return data;
}

export async function register(loginName, password, shopName) {
  const data = await request("/auth/register", {
    method: "POST",
    auth: false,
    body: { login: loginName, password, shop_name: shopName },
  });
  setToken(data.access_token);
  return data;
}

// --- Données ---
export const getHealth = () => request("/api/health", { auth: false });
export const getStats = () => request("/api/stats");
export const getMe = () => request("/api/me");
export const getAdminUsers = () => request("/api/admin/users");
export const getIncidents = () => request("/api/incidents", { auth: false });

export function getTransactions({ limit = 50, offset = 0, status } = {}) {
  const p = new URLSearchParams({ limit, offset });
  if (status) p.set("status", status);
  return request(`/api/transactions?${p.toString()}`);
}

export function createTransaction(amountCents) {
  return request("/api/transactions", {
    method: "POST",
    body: { amount_cents: amountCents },
  });
}
