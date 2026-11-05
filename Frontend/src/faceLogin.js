// Connexion faciale pilote. Le serveur NE délivre le JWT qu'après visage + WebAuthn.
import { request, setToken, clearSetupSession } from './api.js';

function fromBase64Url(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const bin = atob(padded);
  return Uint8Array.from(bin, (char) => char.charCodeAt(0));
}

function toBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let result = '';
  for (const byte of bytes) result += String.fromCharCode(byte);
  return btoa(result).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function getCredentialSupport() {
  if (!window.isSecureContext || !navigator.credentials?.create || !navigator.credentials?.get) {
    throw new Error('WebAuthn nécessite un navigateur compatible et HTTPS.');
  }
}

async function createPasskey(options) {
  getCredentialSupport();
  const publicKey = {
    ...options,
    challenge: fromBase64Url(options.challenge),
    user: { ...options.user, id: fromBase64Url(options.user.id) },
    excludeCredentials: (options.excludeCredentials || []).map((item) => ({ ...item, id: fromBase64Url(item.id) })),
  };
  const cred = await navigator.credentials.create({ publicKey });
  if (!cred) throw new Error('Création de la passkey annulée.');
  return {
    id: cred.id,
    rawId: toBase64Url(cred.rawId),
    type: cred.type,
    response: {
      clientDataJSON: toBase64Url(cred.response.clientDataJSON),
      attestationObject: toBase64Url(cred.response.attestationObject),
      transports: cred.response.getTransports?.() || [],
    },
    authenticatorAttachment: cred.authenticatorAttachment || null,
    clientExtensionResults: cred.getClientExtensionResults(),
  };
}

async function getPasskey(options) {
  getCredentialSupport();
  const publicKey = {
    ...options,
    challenge: fromBase64Url(options.challenge),
    allowCredentials: (options.allowCredentials || []).map((item) => ({ ...item, id: fromBase64Url(item.id) })),
  };
  const cred = await navigator.credentials.get({ publicKey });
  if (!cred) throw new Error('Passkey non validée.');
  return {
    id: cred.id,
    rawId: toBase64Url(cred.rawId),
    type: cred.type,
    response: {
      clientDataJSON: toBase64Url(cred.response.clientDataJSON),
      authenticatorData: toBase64Url(cred.response.authenticatorData),
      signature: toBase64Url(cred.response.signature),
      userHandle: cred.response.userHandle ? toBase64Url(cred.response.userHandle) : null,
    },
    authenticatorAttachment: cred.authenticatorAttachment || null,
    clientExtensionResults: cred.getClientExtensionResults(),
  };
}

export async function registerPasskey(password = null) {
  const result = await request('/auth/face/passkey/register/options', {
    method: 'POST', body: { password },
  });
  const credential = await createPasskey(result.options);
  return request('/auth/face/passkey/register/verify', {
    method: 'POST', body: { challenge_id: result.challenge_id, credential },
  });
}

export async function enrollFace(images, consent, password = null) {
  return request('/auth/face/enroll', { method: 'POST', body: { images, consent, password } });
}

export function faceStatus() {
  return request('/auth/face/status');
}

export function listPasskeys() {
  return request('/auth/face/passkeys');
}

export function deletePasskey(passkeyId, password) {
  return request(`/auth/face/passkeys/${Number(passkeyId)}`, { method: 'DELETE', body: { password } });
}

export function deleteFaceEnrollment(password) {
  return request('/auth/face/enrollment', { method: 'DELETE', body: { password } });
}

export async function finishFaceLogin(challengeId, images) {
  // Le challenge a été créé par /auth/login après validation du mot de passe.
  await request('/auth/face/login/verify', {
    method: 'POST', auth: false, body: { challenge_id: challengeId, images },
  });
  const options = await request('/auth/face/login/passkey/options', {
    method: 'POST', auth: false, body: { challenge_id: challengeId },
  });
  const credential = await getPasskey(options.options);
  const session = await request('/auth/face/login/passkey/verify', {
    method: 'POST', auth: false, body: { challenge_id: challengeId, credential },
  });
  if (!session?.access_token) throw new Error('Jeton de session manquant après vérification MFA.');
  clearSetupSession();
  setToken(session.access_token);
  return session;
}
