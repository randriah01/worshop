// API NovaPay : Vite proxifie /auth et /api vers le WAF en développement.
const TOKEN_KEY = "novapay_token";
const SETUP_TOKEN_KEY = "novapay_setup_token";
const SETUP_LOGIN_KEY = "novapay_setup_login";

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(token) {
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* mode privé */ }
}
export function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* mode privé */ }
}

export function getSetupToken() {
  try { return sessionStorage.getItem(SETUP_TOKEN_KEY); } catch { return null; }
}
export function getSetupLogin() {
  try { return sessionStorage.getItem(SETUP_LOGIN_KEY) || ""; } catch { return ""; }
}
export function setSetupSession(token, loginName) {
  clearToken();
  sessionStorage.setItem(SETUP_TOKEN_KEY, token);
  sessionStorage.setItem(SETUP_LOGIN_KEY, loginName);
}
export function clearSetupSession() {
  try {
    sessionStorage.removeItem(SETUP_TOKEN_KEY);
    sessionStorage.removeItem(SETUP_LOGIN_KEY);
  } catch { /* mode privé */ }
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// Un échec de validation métier ou d'authentification ne doit pas relancer automatiquement un paiement.
export function isTransientError(err) {
  if (!err || err.name === "AbortError") return false;
  const status = Number(err.status);
  if (Number.isInteger(status) && status > 0) {
    return [408, 425, 429, 500, 502, 503, 504].includes(status);
  }
  return status === 0 || err instanceof TypeError;
}

export async function request(path, { method = "GET", body, auth = true, extraHeaders = {}, headers: legacyHeaders } = {}) {
  const headers = { "Content-Type": "application/json", ...legacyHeaders, ...extraHeaders };
  if (auth) {
    const token = getToken() || getSetupToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  let res;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Serveur injoignable.", 0);
  }

  if (res.status === 401) {
    clearToken();
    throw new ApiError("Session expirée, reconnecte-toi.", 401);
  }
  let data = null;
  const responseText = await res.text();
  if (responseText) {
    try { data = JSON.parse(responseText); }
    catch { data = responseText; }
  }
  if (!res.ok) {
    const detail = data && data.detail ? data.detail : `Erreur ${res.status}`;
    throw new ApiError(typeof detail === "string" ? detail : JSON.stringify(detail), res.status);
  }
  return data;
}

export async function login(loginName, password) {
  const data = await request("/auth/login", {
    method: "POST", auth: false, body: { login: loginName, password },
  });
  if (data?.requires_enrollment && data?.setup_token) {
    setSetupSession(data.setup_token, loginName.trim().toLowerCase());
  } else if (data?.requires_face && data?.challenge_id) {
    // Aucun JWT complet n'est stocké avant la vérification du visage ET de la passkey.
    clearToken();
  } else {
    // Un access_token renvoyé dès le mot de passe révèle une configuration backend non MFA.
    // Bloquer ce chemin dans l'interface ; le serveur doit EN PLUS imposer le MFA.
    clearToken();
    throw new ApiError("Le serveur n'impose pas encore l'authentification faciale. Vérifier FACE_LOGIN_REQUIRED.", 409);
  }
  return data;
}

export async function register(loginName, password, shopName) {
  const data = await request("/auth/register", {
    method: "POST", auth: false, body: { login: loginName, password, shop_name: shopName },
  });
  if (data?.requires_enrollment) {
    if (!data.access_token) throw new ApiError("Jeton d'inscription biométrique manquant.", 502);
    setSetupSession(data.access_token, loginName.trim().toLowerCase());
  } else {
    clearToken();
    throw new ApiError("L'inscription doit déclencher l'activation biométrique obligatoire. Vérifier FACE_LOGIN_REQUIRED.", 409);
  }
  return data;
}

export const getHealth = () => request("/api/health", { auth: false });
export const getStats = () => request("/api/stats");
export const getMe = () => request("/api/me");
export const getAdminUsers = () => request("/api/admin/users");
export const getIncidents = () => request("/api/incidents", { auth: false });

export function getTransactions({ limit = 50, offset = 0, status } = {}) {
  const params = new URLSearchParams({ limit, offset });
  if (status) params.set("status", status);
  return request(`/api/transactions?${params.toString()}`);
}

export function createTransaction(amountCents, idempotencyKey, simulateDecline = false) {
  return request("/api/transactions", {
    method: "POST",
    body: { amount_cents: amountCents, simulate_decline: simulateDecline },
    extraHeaders: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {},
  });
}
