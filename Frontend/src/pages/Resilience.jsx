import { useEffect, useState } from "react";
import { getIncidents, getHealth } from "../api";
import { Card, StatCard, Spinner, ErrorNote, dateFr } from "../components/ui";
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
  }, []);

  if (loading) return <Spinner />;
  if (error) return <ErrorNote>{error}</ErrorNote>;

  const openIncidents = incidents.filter((i) => i.status === "open");
  const resolvedIncidents = incidents.filter((i) => i.status === "resolved");
  // État courant du cycle, déduit de la santé et des incidents ouverts.
  const currentStep = openIncidents.length > 0 ? 1 : 0;
  const serviceUp = health && health.status === "ok";

  return (
    <div className="space-y-6">
      <Header title="Cyber-résilience" subtitle="Mécanisme de reprise automatique" onRefresh={load} />

      {/* Bannière d'état du moteur */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
        Moteur de remédiation : <span className="font-medium">non connecté</span> — à
        brancher (branche <code className="rounded bg-[var(--panel-2)] px-1">feature/dev</code>).
        Les temps et contrôles ci-dessous seront alimentés par ce service.
      </div>

      {/* Cycle de résilience */}
      <Card>
        <h2 className="mb-5 font-medium text-[var(--text)]">Cycle de résilience</h2>
        <ol className="space-y-3">
          {CYCLE.map((label, i) => {
            const active = i === currentStep;
            const passed = i < currentStep;
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
                {active && (
                  <span className="rounded-full bg-blue-600/15 px-2 py-0.5 text-xs text-blue-300">
                    état courant
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </Card>

      {/* Métriques de reprise */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Service de paiement" value={serviceUp ? "Disponible" : "Indisponible"} hintColor={serviceUp ? "text-emerald-400" : "text-red-400"} hint={serviceUp ? "santé OK" : "santé KO"} />
        <StatCard label="Temps de détection" value="—" hint="moteur non connecté" />
        <StatCard label="Temps de remédiation" value="—" hint="moteur non connecté" />
        <StatCard label="Temps de rétablissement" value="—" hint="moteur non connecté" />
      </div>

      <p className="text-xs text-[var(--text-faint)]">
        Principe clé : un incident n'est jamais déclaré résolu parce qu'une commande a
        été lancée — le moteur devra vérifier que le service répond réellement (contrôle
        de santé) et qu'une nouvelle transaction passe.
      </p>

      {/* Historique des remédiations */}
      <Card>
        <h2 className="mb-4 font-medium text-[var(--text)]">Historique des remédiations</h2>
        {resolvedIncidents.length === 0 ? (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-2)] p-6 text-center text-sm text-[var(--text-muted)]">
            Aucune remédiation enregistrée. L'historique se remplira quand le moteur
            aura résolu des incidents.
          </div>
        ) : (
          <div className="space-y-2">
            {resolvedIncidents.map((inc) => (
              <div
                key={inc.id}
                className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-4 py-3 text-sm"
              >
                <span className="text-[var(--text-soft)]">
                  <span className="font-mono text-xs text-[var(--text-faint)]">#{inc.id}</span> {inc.kind}
                </span>
                <span className="text-xs text-emerald-400">résolu · {dateFr(inc.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
