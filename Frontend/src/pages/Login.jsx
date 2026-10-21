import { useState } from "react";
import { login } from "../api";

export default function Login({ onSuccess, onRegister }) {
  const [loginName, setLoginName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!loginName.trim() || !password.trim()) {
      setError("Identifiant et mot de passe requis.");
      return;
    }
    setLoading(true);
    try {
      await login(loginName.trim(), password);
      onSuccess();
    } catch (err) {
      setError(err.message || "Connexion impossible.");
    } finally {
      setLoading(false);
    }
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
          <h1 className="text-center text-base font-medium text-[var(--text)]">Connexion</h1>

          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Identifiant</label>
            <input
              value={loginName}
              onChange={(e) => setLoginName(e.target.value)}
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
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-[var(--text)] outline-none focus:border-blue-500"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
          )}

          <button type="submit" disabled={loading} className="w-full rounded-lg bg-blue-600 py-2.5 font-medium text-white transition hover:bg-blue-500 disabled:opacity-60">
            {loading ? "Connexion…" : "Se connecter"}
          </button>

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
