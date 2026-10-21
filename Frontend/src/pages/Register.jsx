import { useState } from "react";
import { register } from "../api";

export default function Register({ onSuccess, onLogin }) {
  const [shopName, setShopName] = useState("");
  const [loginName, setLoginName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!shopName.trim() || !loginName.trim() || !password) {
      setError("Tous les champs sont requis.");
      return;
    }
    if (password.length < 6) {
      setError("Le mot de passe doit faire au moins 6 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    try {
      await register(loginName.trim(), password, shopName.trim());
      onSuccess();
    } catch (err) {
      setError(err.message || "Inscription impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4 py-8">
      <div className="w-full max-w-sm np-fade">
        <div className="mb-8 flex items-center justify-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-blue-600 text-lg font-bold text-white">N</span>
          <div className="leading-tight">
            <p className="text-lg font-semibold text-[var(--text)]">NovaPay</p>
            <p className="text-xs text-[var(--text-faint)]">Créer votre compte commerçant</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-xl">
          <h1 className="text-center text-base font-medium text-[var(--text)]">Inscription</h1>

          <Field label="Nom du commerce">
            <input value={shopName} onChange={(e) => setShopName(e.target.value)} className={inputCls} placeholder="Ma boutique" />
          </Field>
          <Field label="Identifiant">
            <input value={loginName} onChange={(e) => setLoginName(e.target.value)} className={inputCls} placeholder="mon_identifiant" autoComplete="username" />
          </Field>
          <Field label="Mot de passe">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="6 caractères minimum" autoComplete="new-password" />
          </Field>
          <Field label="Confirmer le mot de passe">
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} placeholder="••••••••" autoComplete="new-password" />
          </Field>

          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
          )}

          <button type="submit" disabled={loading} className="w-full rounded-lg bg-blue-600 py-2.5 font-medium text-white transition hover:bg-blue-500 disabled:opacity-60">
            {loading ? "Création…" : "Créer mon compte"}
          </button>

          <p className="text-center text-sm text-[var(--text-muted)]">
            Déjà un compte ?{" "}
            <button type="button" onClick={onLogin} className="text-blue-500 hover:underline">
              Se connecter
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-[var(--text)] outline-none focus:border-blue-500";

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-sm text-[var(--text-muted)]">{label}</label>
      {children}
    </div>
  );
}
