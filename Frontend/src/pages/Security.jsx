import { useEffect, useState } from "react";
import { getIncidents } from "../api";
import { Card, StatusBadge, Spinner, ErrorNote, StatCard, dateFr } from "../components/ui";
import { Header } from "./Dashboard";

// Gravité déduite du type d'incident (le backend ne la stocke pas encore).
function severity(kind = "") {
  const k = kind.toLowerCase();
  if (k.includes("injection") || k.includes("sql") || k.includes("exfil")) return "critique";
  if (k.includes("dos") || k.includes("flood") || k.includes("ddos")) return "élevé";
  if (k.includes("latence") || k.includes("latency") || k.includes("error")) return "moyen";
  if (k) return "faible";
  return "information";
}

const SEV_STYLE = {
  critique: "bg-red-500/15 text-red-400 border-red-500/30",
  élevé: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  moyen: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  faible: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  information: "bg-slate-500/15 text-slate-300 border-slate-500/30",
};

function SevBadge({ level }) {
  return (
    <span className={"rounded-full border px-2.5 py-0.5 text-xs font-medium " + SEV_STYLE[level]}>
      {level}
    </span>
  );
}

export default function Security() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setIncidents(await getIncidents());
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const openCount = incidents.filter((i) => i.status === "open").length;
  const resolved = incidents.filter((i) => i.status === "resolved").length;

  return (
    <div className="space-y-6">
      <Header title="Cybersécurité" subtitle="Supervision des incidents et anomalies" onRefresh={load} />

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Incidents" value={incidents.length} />
        <StatCard label="Ouverts" value={openCount} hint="à traiter" hintColor={openCount ? "text-amber-400" : "text-slate-400"} />
        <StatCard label="Résolus" value={resolved} hintColor="text-emerald-400" />
      </div>

      <Card>
        <h2 className="mb-4 font-medium text-white">Journal des incidents</h2>
        {loading ? (
          <Spinner />
        ) : error ? (
          <ErrorNote>{error}</ErrorNote>
        ) : incidents.length === 0 ? (
          <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-6 text-center text-sm text-slate-400">
            Aucun incident pour le moment. Les incidents sont créés par la détection
            et le moteur de remédiation (endpoint interne sécurisé).
          </div>
        ) : (
          <div className="space-y-2">
            {incidents.map((inc) => (
              <button
                key={inc.id}
                onClick={() => setOpen(inc)}
                className="flex w-full flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-3 text-left transition hover:border-slate-700"
              >
                <span className="font-mono text-xs text-slate-500">#{inc.id}</span>
                <SevBadge level={severity(inc.kind)} />
                <span className="text-sm font-medium text-slate-200">{inc.kind}</span>
                <span className="flex-1 truncate text-sm text-slate-500">{inc.detail}</span>
                <StatusBadge status={inc.status} />
                <span className="text-xs text-slate-500">{dateFr(inc.created_at)}</span>
              </button>
            ))}
          </div>
        )}
      </Card>

      {open && <IncidentTimeline inc={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function IncidentTimeline({ inc, onClose }) {
  const resolved = inc.status === "resolved";
  const steps = [
    { t: "Apparition de l'anomalie", done: true, at: inc.created_at },
    { t: "Détection", done: true, at: inc.created_at },
    { t: "Qualification de l'incident", done: true },
    { t: "Décision (règles de remédiation)", done: resolved, pending: !resolved },
    { t: "Action de remédiation", done: resolved, pending: !resolved },
    { t: "Vérification du rétablissement", done: resolved, pending: !resolved },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 np-fade"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-semibold text-white">Incident #{inc.id} — {inc.kind}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">✕</button>
        </div>
        <p className="mb-5 text-sm text-slate-400">{inc.detail || "Pas de détail fourni."}</p>

        <ol className="space-y-4">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span
                className={
                  "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] " +
                  (s.done
                    ? "bg-emerald-500 text-white"
                    : s.pending
                      ? "border border-amber-500 text-amber-400"
                      : "border border-slate-600 text-slate-500")
                }
              >
                {s.done ? "✓" : i + 1}
              </span>
              <div>
                <p className={"text-sm " + (s.done ? "text-slate-200" : "text-slate-400")}>{s.t}</p>
                {s.at && <p className="text-xs text-slate-500">{dateFr(s.at)}</p>}
                {s.pending && <p className="text-xs text-amber-400/80">en attente du moteur de remédiation</p>}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
