import { useEffect, useRef, useState } from "react";
import { getTransactions, createTransaction, isTransientError } from "../api";
import { Card, StatusBadge, Spinner, ErrorNote, euros, dateFr } from "../components/ui";
import { Header } from "./Dashboard";

const PAGE = 10;

// Nouvelles tentatives automatiques d'un paiement refusé pour cause passagère
// (API saturée par une attaque, en reprise, limitation de débit…). On insiste
// jusqu'à RETRY_WINDOW_MS : assez pour que la détection + la remédiation agissent.
// Attentes : 2 s, 4 s, 8 s puis 10 s (± 25 % pour ne pas tirer tous en même temps).
const RETRY_WINDOW_MS = 180000;
const RETRY_BASE_MS = 2000;
const RETRY_MAX_DELAY_MS = 10000;

export default function Transactions() {
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setAll(await getTransactions({ limit: 200 }));
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = all.filter((t) => {
    if (status && t.status !== status) return false;
    if (query && !String(t.id).includes(query.trim())) return false;
    return true;
  });
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const view = filtered.slice(page * PAGE, page * PAGE + PAGE);

  return (
    <div className="space-y-6">
      <Header title="Transactions" subtitle="Paiements simulés — aucun mouvement réel" onRefresh={load} />

      <Checkout
        onPaid={() => {
          load();
          setPage(0);
        }}
      />

      <h2 className="pt-2 text-sm font-medium uppercase tracking-wide text-[var(--text-faint)]">
        Historique
      </h2>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
          placeholder="Rechercher par identifiant…"
          className="w-full max-w-xs rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-blue-500"
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(0);
          }}
          className="rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-blue-500"
        >
          <option value="">Tous les statuts</option>
          <option value="validated">Réussie</option>
          <option value="pending">En attente</option>
          <option value="rejected">Échouée</option>
          <option value="error">Erreur</option>
        </select>
      </div>

      {/* Tableau */}
      <Card>
        {loading ? (
          <Spinner />
        ) : error ? (
          <ErrorNote>{error}</ErrorNote>
        ) : view.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--text-faint)]">
            Aucune transaction. Effectue un paiement ci-dessus.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-[var(--text-faint)]">
                <tr className="border-b border-[var(--border)]">
                  <th className="py-2 pr-4">ID</th>
                  <th className="py-2 pr-4">Commerçant</th>
                  <th className="py-2 pr-4">Montant</th>
                  <th className="py-2 pr-4">Statut</th>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {view.map((t) => (
                  <tr key={t.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-2.5 pr-4 font-mono text-[var(--text-muted)]">#{t.id}</td>
                    <td className="py-2.5 pr-4 text-[var(--text-soft)]">{t.merchant}</td>
                    <td className="py-2.5 pr-4 font-medium text-[var(--text)]">{euros(t.amount_cents)}</td>
                    <td className="py-2.5 pr-4"><StatusBadge status={t.status} /></td>
                    <td className="py-2.5 pr-4 text-[var(--text-muted)]">{dateFr(t.created_at)}</td>
                    <td className="py-2.5 text-right">
                      <button
                        onClick={() => setDetail(t)}
                        className="text-xs text-blue-400 hover:underline"
                      >
                        Détail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filtered.length > PAGE && (
          <div className="mt-4 flex items-center justify-between text-sm text-[var(--text-muted)]">
            <span>{filtered.length} transaction(s) · page {page + 1}/{pages}</span>
            <div className="flex gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-[var(--border)] px-3 py-1 disabled:opacity-40"
              >
                Précédent
              </button>
              <button
                disabled={page >= pages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-[var(--border)] px-3 py-1 disabled:opacity-40"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </Card>

      {detail && <DetailModal tx={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

/* ---------------- Checkout façon Stripe (simulé) ---------------- */

// Détection simple de la marque à partir du préfixe.
function cardBrand(num) {
  const n = num.replace(/\s/g, "");
  if (/^4/.test(n)) return "Visa";
  if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return "Mastercard";
  if (/^3[47]/.test(n)) return "Amex";
  return "";
}

// Algorithme de Luhn : vérifie qu'un numéro de carte est bien formé.
function luhnValid(num) {
  const n = num.replace(/\s/g, "");
  if (n.length < 13) return false;
  let sum = 0;
  let alt = false;
  for (let i = n.length - 1; i >= 0; i--) {
    let d = parseInt(n[i], 10);
    if (Number.isNaN(d)) return false;
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function formatCard(value) {
  return value
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

function formatExpiry(value) {
  const v = value.replace(/\D/g, "").slice(0, 4);
  if (v.length < 3) return v;
  return v.slice(0, 2) + "/" + v.slice(2);
}

// Génère une clé d'idempotence unique (UUID si disponible, sinon repli).
function newKey() {
  try {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* ignore */
  }
  return "k-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

function Checkout({ onPaid }) {
  const [amount, setAmount] = useState("24.90");
  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [errors, setErrors] = useState({});
  const [stage, setStage] = useState("form"); // form | processing | success | declined
  const [result, setResult] = useState(null);
  // Clé d'idempotence : une par paiement. Un double-clic ou un renvoi réutilise
  // la même clé → le serveur ne crée pas de doublon.
  const [idemKey, setIdemKey] = useState(() => newKey());
  const [retryInfo, setRetryInfo] = useState(null); // { n } pendant une relance auto
  const cancelRef = useRef(false);
  const keyCents = useRef(null); // montant associé à la clé courante

  const brand = cardBrand(number);
  const cents = Math.round(parseFloat((amount || "").replace(",", ".")) * 100);

  function validate() {
    const e = {};
    if (!cents || cents <= 0) e.amount = "Montant invalide";
    if (!luhnValid(number)) e.number = "Numéro de carte invalide";
    if (!name.trim()) e.name = "Nom requis";
    if (!/^\d{2}\/\d{2}$/.test(expiry)) {
      e.expiry = "Format MM/AA";
    } else {
      const [mm, yy] = expiry.split("/").map((x) => parseInt(x, 10));
      const now = new Date();
      const exp = new Date(2000 + yy, mm, 0, 23, 59);
      if (mm < 1 || mm > 12) e.expiry = "Mois invalide";
      else if (exp < now) e.expiry = "Carte expirée";
    }
    if (!/^\d{3,4}$/.test(cvc)) e.cvc = "CVC invalide";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function pay(ev) {
    ev.preventDefault();
    if (!validate()) return;
    setStage("processing");
    setRetryInfo(null);

    // Même clé pour tous les envois d'UN paiement ; si le montant change, c'est
    // un autre paiement → nouvelle clé (sinon le serveur renverrait l'ancien).
    let key = idemKey;
    if (keyCents.current !== null && keyCents.current !== cents) {
      key = newKey();
      setIdemKey(key);
    }
    keyCents.current = cents;

    // Petit délai pour simuler le traitement par la banque.
    await new Promise((r) => setTimeout(r, 1000));

    // Seul le montant part au serveur — JAMAIS les données de carte.
    // Toute carte valide est acceptée : un échec ne survient qu'en cas de
    // problème réel côté serveur (ex. plateforme sous attaque). On réessaie
    // alors automatiquement avec LA MÊME clé d'idempotence : si le premier envoi
    // est en fait passé, le serveur renvoie la transaction existante au lieu de
    // débiter une seconde fois.
    const deadline = Date.now() + RETRY_WINDOW_MS;
    cancelRef.current = false;
    const fail = (reason, retried) => {
      setResult({ reason, retried });
      setStage("declined");
      setRetryInfo(null);
    };
    for (let attempt = 0; ; attempt++) {
      try {
        const r = await createTransaction(cents, key);
        setResult({ ...r, retried: attempt });
        setStage("success");
        setRetryInfo(null);
        onPaid();
        return;
      } catch (err) {
        if (cancelRef.current) return fail("Paiement annulé. Vérifie l'historique avant de réessayer.", attempt);
        if (Date.now() >= deadline || !isTransientError(err)) return fail(err.message, attempt);
        setRetryInfo({ n: attempt + 1 });
        const wait = Math.min(RETRY_BASE_MS * 2 ** attempt, RETRY_MAX_DELAY_MS) * (0.75 + Math.random() * 0.5);
        await new Promise((r) => setTimeout(r, wait));
        if (cancelRef.current) return fail("Paiement annulé. Vérifie l'historique avant de réessayer.", attempt + 1);
      }
    }
  }

  // Retour au formulaire en CONSERVANT la saisie et la clé d'idempotence :
  // un refus peut cacher un paiement passé, une nouvelle clé risquerait un doublon.
  function backToForm() {
    setResult(null);
    setStage("form");
  }

  function reset() {
    setNumber("");
    setName("");
    setExpiry("");
    setCvc("");
    setErrors({});
    setResult(null);
    setStage("form");
    keyCents.current = null;
    setIdemKey(newKey()); // nouveau paiement = nouvelle clé
  }

  if (stage === "processing") {
    return (
      <Card>
        <div className="flex flex-col items-center gap-3 py-12">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border)] border-t-blue-400" />
          <p className="text-[var(--text-soft)]">Traitement du paiement…</p>
          {retryInfo ? (
            <>
              <p className="text-xs text-amber-400">
                Service momentanément indisponible — nouvelle tentative automatique n°{retryInfo.n} (jusqu'à 3 min)…
              </p>
              <button
                type="button"
                onClick={() => { cancelRef.current = true; }}
                className="mt-1 rounded-lg border border-[var(--border)] px-3 py-1 text-xs text-[var(--text-soft)] hover:bg-[var(--panel-2)]"
              >
                Annuler
              </button>
            </>
          ) : (
            <p className="text-xs text-[var(--text-faint)]">Vérification auprès de la banque (simulée)</p>
          )}
        </div>
      </Card>
    );
  }

  if (stage === "success") {
    return (
      <Card className="np-fade">
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-emerald-500/15 text-3xl text-emerald-400">✓</span>
          <h2 className="text-lg font-semibold text-[var(--text)]">Paiement réussi</h2>
          <p className="text-[var(--text-soft)]">{euros(cents)} encaissés</p>
          <p className="text-sm text-[var(--text-faint)]">
            Transaction #{result?.id} · nouveau solde commerçant {euros(result?.new_balance_cents)}
          </p>
          {result?.retried > 0 && (
            <p className="text-xs text-emerald-400">
              Validé automatiquement après {result.retried} nouvelle(s) tentative(s), sans double débit.
            </p>
          )}
          <button
            onClick={reset}
            className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            Nouveau paiement
          </button>
        </div>
      </Card>
    );
  }

  if (stage === "declined") {
    return (
      <Card className="np-fade">
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-red-500/15 text-3xl text-red-400">✕</span>
          <h2 className="text-lg font-semibold text-[var(--text)]">Paiement refusé</h2>
          <p className="max-w-sm text-sm text-[var(--text-muted)]">{result?.reason}</p>
          {result?.retried > 0 && (
            <p className="max-w-sm text-xs text-[var(--text-faint)]">
              {result.retried} nouvelle(s) tentative(s) automatique(s) sans succès. Aucun double débit possible : le même paiement est renvoyé avec la même clé.
            </p>
          )}
          <button
            onClick={backToForm}
            className="mt-3 rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text)] hover:bg-[var(--panel-2)]"
          >
            Réessayer
          </button>
        </div>
      </Card>
    );
  }

  // --- Formulaire ---
  return (
    <Card>
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Résumé (gauche) */}
        <div className="lg:col-span-2">
          <h2 className="font-medium text-[var(--text)]">Nouveau paiement</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Règle un montant par carte. Environnement de démonstration.
          </p>
          <div className="mt-5">
            <label className="mb-1 block text-xs text-[var(--text-muted)]">Montant à payer (€)</label>
            <div className="flex items-center rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-3">
              <span className="text-[var(--text-faint)]">€</span>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-transparent px-2 py-2 text-lg font-semibold text-[var(--text)] outline-none"
              />
            </div>
            {errors.amount && <p className="mt-1 text-xs text-red-400">{errors.amount}</p>}
          </div>
        </div>

        {/* Formulaire carte (droite) */}
        <form onSubmit={pay} className="space-y-4 lg:col-span-3">
          <Field label="Numéro de carte" error={errors.number}>
            <div className="flex items-center rounded-lg border border-[var(--border)] bg-[var(--panel-2)] pr-3 focus-within:border-blue-500">
              <input
                value={number}
                onChange={(e) => setNumber(formatCard(e.target.value))}
                placeholder="1234 5678 9012 3456"
                inputMode="numeric"
                className="w-full bg-transparent px-3 py-2 font-mono text-[var(--text)] outline-none"
              />
              {brand && <span className="text-xs font-medium text-[var(--text-muted)]">{brand}</span>}
            </div>
          </Field>

          <Field label="Titulaire de la carte" error={errors.name}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="PRINCIA R."
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 uppercase text-[var(--text)] outline-none focus:border-blue-500"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Expiration" error={errors.expiry}>
              <input
                value={expiry}
                onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                placeholder="MM/AA"
                inputMode="numeric"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-[var(--text)] outline-none focus:border-blue-500"
              />
            </Field>
            <Field label="CVC" error={errors.cvc}>
              <input
                value={cvc}
                onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="123"
                inputMode="numeric"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-[var(--text)] outline-none focus:border-blue-500"
              />
            </Field>
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-blue-600 py-2.5 font-medium text-white transition hover:bg-blue-500"
          >
            Payer {cents > 0 ? euros(cents) : ""}
          </button>

          <p className="flex items-center justify-center gap-1.5 text-xs text-[var(--text-faint)]">
            <LockIcon /> Paiement simulé — aucune donnée bancaire réelle n'est collectée ni stockée.
          </p>
        </form>
      </div>
    </Card>
  );
}

function Field({ label, error, children }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-[var(--text-muted)]">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

/* ---------------- Détail d'une transaction ---------------- */

function DetailModal({ tx, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 np-fade"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-[var(--text)]">Transaction #{tx.id}</h3>
          <button onClick={onClose} className="text-[var(--text-faint)] hover:text-[var(--text-soft)]">✕</button>
        </div>
        <dl className="space-y-3 text-sm">
          <Row k="Identifiant" v={`#${tx.id}`} />
          <Row k="Commerçant" v={tx.merchant} />
          <Row k="Montant" v={euros(tx.amount_cents)} />
          <Row k="Statut" v={<StatusBadge status={tx.status} />} />
          <Row k="Date" v={dateFr(tx.created_at)} />
          <Row k="Devise" v="EUR" />
        </dl>
      </div>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--border)] pb-2 last:border-0">
      <dt className="text-[var(--text-muted)]">{k}</dt>
      <dd className="font-medium text-[var(--text)]">{v}</dd>
    </div>
  );
}
