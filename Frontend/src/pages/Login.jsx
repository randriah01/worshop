import { useState } from "react";
import { login } from "../api";
import { finishFaceLogin } from "../faceLogin";
import FaceCamera from "../components/FaceCamera";

export default function Login({ onSuccess, onRegister, onNeedsSetup }) {
  const [loginName, setLoginName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [challengeId, setChallengeId] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!loginName.trim() || !password.trim()) {
      setError("Identifiant et mot de passe requis.");
      return;
    }
    setLoading(true);
    try {
      const result = await login(loginName.trim(), password);
      if (result.requires_enrollment) {
        onNeedsSetup();
      } else if (result.requires_face && result.challenge_id) {
        setChallengeId(result.challenge_id);
      } else if (result.access_token) {
        onSuccess();
      } else {
        throw new Error("Réponse d'authentification inattendue");
      }
    } catch (err) {
      setError(err.message || "Connexion impossible.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyFace(images) {
    setError(""); setLoading(true);
    try {
      if (!challengeId) throw new Error("Saisis d'abord ton identifiant et ton mot de passe.");
      await finishFaceLogin(challengeId, images);
      onSuccess();
    } catch (err) {
      setError(err.message || "Vérification faciale refusée.");
    } finally { setLoading(false); }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4">
      <div className="w-full max-w-sm np-fade">
        <div className="mb-8 flex items-center justify-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-blue-600 text-lg font-bold text-white">N</span>
          <div className="leading-tight">
            <p className="text-lg font-semibold text-[var(--text)]">NovaPay</p>
            <p className="text-xs text-[var(--text-faint)]">Plateforme cyber-résiliente</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-xl">
          <h1 className="text-center text-base font-medium text-[var(--text)]">Connexion sécurisée</h1>
          {challengeId && <p className="rounded-lg bg-blue-600/10 p-3 text-sm text-[var(--text)]">
            Mot de passe validé. Vérifie maintenant ton visage, puis confirme ta passkey.
            Le dashboard reste verrouillé jusqu'à la fin.
          </p>}

          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Identifiant</label>
            <input
              value={loginName}
              onChange={(e) => { setLoginName(e.target.value); setChallengeId(null); }}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-[var(--text)] outline-none focus:border-blue-500"
              placeholder="votre identifiant"
              autoComplete="username"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setChallengeId(null); }}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-[var(--text)] outline-none focus:border-blue-500"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
          )}

          <button type="submit" disabled={loading} className="w-full rounded-lg bg-blue-600 py-2.5 font-medium text-white transition hover:bg-blue-500 disabled:opacity-60">
            {loading ? "Vérification…" : challengeId ? "Recommencer la vérification du mot de passe" : "Vérifier mes identifiants"}
          </button>

          {challengeId && <FaceCamera key={challengeId} onCapture={verifyFace} disabled={loading} />}

          <p className="text-center text-sm text-[var(--text-muted)]">
            Pas encore de compte ?{" "}
            <button type="button" onClick={onRegister} className="text-blue-500 hover:underline">
              Créer un compte
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
