import { useState } from "react";
import { login } from "../api";

export default function Login({ onSuccess }) {
  const [loginName, setLoginName] = useState("fournil");
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
    <div className="flex min-h-screen items-center justify-center bg-[#0a0f1f] px-4">
      <div className="w-full max-w-sm np-fade">
        <div className="mb-8 flex items-center justify-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-blue-600 text-lg font-bold text-white">
            N
          </span>
          <div className="leading-tight">
            <p className="text-lg font-semibold text-white">NovaPay</p>
            <p className="text-xs text-slate-500">Plateforme cyber-résiliente</p>
          </div>
        </div>

        <form
          onSubmit={submit}
          className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl"
        >
          <h1 className="text-center text-base font-medium text-slate-200">
            Connexion commerçant
          </h1>

          <div>
            <label className="mb-1 block text-sm text-slate-400">Identifiant</label>
            <input
              value={loginName}
              onChange={(e) => setLoginName(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-blue-500"
              placeholder="fournil"
              autoComplete="username"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-400">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-blue-500"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-2.5 font-medium text-white transition hover:bg-blue-500 disabled:opacity-60"
          >
            {loading ? "Connexion…" : "Se connecter"}
          </button>

          <p className="text-center text-xs text-slate-500">
            Démo : <span className="text-slate-400">fournil</span> /{" "}
            <span className="text-slate-400">demo1234</span>
          </p>
        </form>
      </div>
    </div>
  );
}
