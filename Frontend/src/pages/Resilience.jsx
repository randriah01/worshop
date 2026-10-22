import { useEffect, useState } from "react";
import { getIncidents, getHealth } from "../api";
import { Card, StatCard, StatusBadge, Spinner, ErrorNote, dateFr } from "../components/ui";
import { Header } from "./Dashboard";

const CYCLE = [
  "Fonctionnement normal",
  "Détection d'une anomalie",
  "Qualification de l'incident",
  "Décision (règles explicites)",
  "Action de remédiation",
  "Vérification de l'état du service",
  "Retour à la normale ou escalade",
];

function recoverySeconds(inc) {
  if (!inc.resolved_at) return null;
  return Math.max(0, Math.round((new Date(inc.resolved_at) - new Date(inc.created_at)) / 1000));
}

export default function Resilience() {
  const [incidents, setIncidents] = useState([]);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setIncidents(await getIncidents());
      setHealth(await getHealth());
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 8000); // rafraîchissement auto pendant la démo
    return () => clearInterval(t);
  }, []);

  if (loading && incidents.length === 0) return <Spinner />;
  if (error) return <ErrorNote>{error}</ErrorNote>;

  const open = incidents.filter((i) => i.status === "open");
  const resolved = incidents.filter((i) => i.status === "resolved");
  const escalated = incidents.filter((i) => i.status === "escalated");
  const serviceUp = health && health.status === "ok";

  // Étape courante du cycle.
  const currentStep = open.length > 0 ? 4 : 0; // remédiation en cours, sinon normal

  // Temps de rétablissement moyen (sur les incidents résolus).
  const recos = resolved.map(recoverySeconds).filter((x) => x !== null);
  const avgReco = recos.length ? Math.round(recos.reduce((a, b) => a + b, 0) / recos.length) : null;

  const history = incidents.filter((i) => i.status === "resolved" || i.status === "escalated");

  return (
    <div className="space-y-6">
      <Header title="Cyber-résilience" subtitle="Mécanisme de reprise automatique" onRefresh={load} />

      {/* État du moteur */}
      <div
        className={
          "rounded-xl border px-4 py-3 text-sm " +
          (open.length > 0
            ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
            : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300")
        }
      >
        Moteur de remédiation : <span className="font-medium">actif</span>
        {open.length > 0
          ? ` — remédiation en cours (${open.length} incident ouvert).`
          : " — aucun incident ouvert, plateforme nominale."}
      </div>

      {/* Cycle */}
      <Card>
        <h2 className="mb-5 font-medium text-[var(--text)]">Cycle de résilience</h2>
        <ol className="space-y-3">
          {CYCLE.map((label, i) => {
            const active = open.length > 0 && i === currentStep;
            const passed = open.length > 0 && i < currentStep;
            return (
              <li key={i} className="flex items-center gap-3">
                <span
                  className={
                    "grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-medium " +
                    (passed
                      ? "bg-emerald-500 text-white"
                      : active
                        ? "bg-blue-600 text-white ring-4 ring-blue-600/20"
                        : "border border-[var(--border)] text-[var(--text-faint)]")
                  }
                >
                  {passed ? "✓" : i + 1}
                </span>
                <span className={active ? "text-[var(--text)]" : passed ? "text-[var(--text-soft)]" : "text-[var(--text-faint)]"}>
                  {label}
                </span>
                {active && <span className="rounded-full bg-blue-600/15 px-2 py-0.5 text-xs text-blue-500">en cours</span>}
              </li>
            );
          })}
        </ol>
      </Card>

      {/* Métriques */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Service de paiement" value={serviceUp ? "Disponible" : "Indisponible"} hintColor={serviceUp ? "text-emerald-400" : "text-red-400"} hint={serviceUp ? "santé OK" : "santé KO"} />
        <StatCard label="Remédiations réussies" value={resolved.length} hintColor="text-emerald-400" />
        <StatCard label="Temps de rétablissement moyen" value={avgReco !== null ? `${avgReco}s` : "—"} hint={avgReco !== null ? "détection → reprise" : "aucune encore"} />
        <StatCard label="Escalades" value={escalated.length} hintColor={escalated.length ? "text-red-400" : "text-[var(--text-muted)]"} hint="reprise échouée" />
      </div>

      <p className="text-xs text-[var(--text-faint)]">
        Principe clé : un incident n'est déclaré résolu qu'après vérification que le
        service répond réellement (contrôle de santé), pas seulement parce qu'une
        action a été exécutée.
      </p>

      {/* Historique */}
      <Card>
        <h2 className="mb-4 font-medium text-[var(--text)]">Historique des remédiations</h2>
        {history.length === 0 ? (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-2)] p-6 text-center text-sm text-[var(--text-muted)]">
            Aucune remédiation pour le moment. Lance une attaque : la détection créera
            un incident, et le moteur le traitera automatiquement.
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((inc) => {
              const sec = recoverySeconds(inc);
              return (
                <div key={inc.id} className="rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono text-xs text-[var(--text-faint)]">#{inc.id}</span>
                    <span className="font-medium text-[var(--text)]">{inc.kind}</span>
                    <StatusBadge status={inc.status} />
                    {sec !== null && <span className="text-xs text-emerald-400">rétabli en {sec}s</span>}
                    <span className="ml-auto text-xs text-[var(--text-faint)]">{dateFr(inc.created_at)}</span>
                  </div>
                  {inc.action && (
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      Action : {inc.action}
                      {inc.attempts ? ` · ${inc.attempts} tentative(s)` : ""}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
