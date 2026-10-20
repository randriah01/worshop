import { useEffect, useState } from "react";
import { getStats, getHealth, getMerchants } from "../api";
import {
  Card,
  StatCard,
  AreaChart,
  DonutChart,
  Spinner,
  ErrorNote,
  euros,
} from "../components/ui";

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [health, setHealth] = useState(null);
  const [merchants, setMerchants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [s, m] = await Promise.all([getStats(), getMerchants()]);
      setStats(s);
      setMerchants(m);
    } catch (err) {
      setError(err.message);
    }
    // Santé séparée : ne doit pas bloquer le reste si la base répond lentement.
    try {
      setHealth(await getHealth());
    } catch {
      setHealth({ status: "down" });
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <Spinner />;
  if (error) return <ErrorNote>Impossible de charger les données : {error}</ErrorNote>;

  const series = (stats.series || []).map((d) => ({
    label: d.day.slice(5),
    value: Math.round(d.volume_cents / 100),
  }));

  const dbOk = health && health.status === "ok";

  const services = [
    { nom: "API de paiement", ok: true },
    { nom: "Base de données", ok: dbOk },
    { nom: "Authentification", ok: true },
    { nom: "Moteur de remédiation", ok: null }, // non connecté pour l'instant
  ];

  return (
    <div className="space-y-6">
      <Header title="Tableau de bord" subtitle="État global de la plateforme NovaPay" onRefresh={load} />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Volume encaissé" value={euros(stats.volume_cents)} />
        <StatCard label="Transactions" value={stats.total} hint={`${stats.validated} réussies`} hintColor="text-emerald-400" />
        <StatCard
          label="Taux de réussite"
          value={`${stats.success_rate}%`}
          hint={`${stats.failed} échouées`}
          hintColor={stats.failed ? "text-red-400" : "text-slate-400"}
        />
        <StatCard
          label="Incidents de sécurité"
          value={stats.incidents_total}
          hint={`${stats.incidents_open} ouverts`}
          hintColor={stats.incidents_open ? "text-amber-400" : "text-slate-400"}
        />
      </div>

      {/* Graphiques */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium text-white">Volume encaissé (7 jours)</h2>
            <span className="text-xs text-slate-500">en euros / jour</span>
          </div>
          <AreaChart data={series} />
        </Card>
        <Card>
          <h2 className="mb-4 font-medium text-white">Répartition des statuts</h2>
          <DonutChart
            segments={[
              { label: "Réussies", value: stats.validated, color: "#10b981" },
              { label: "Échouées", value: stats.failed, color: "#ef4444" },
              { label: "En attente", value: stats.pending, color: "#f59e0b" },
            ]}
          />
        </Card>
      </div>

      {/* État des services */}
      <Card>
        <h2 className="mb-4 font-medium text-white">État des services</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((s) => (
            <ServiceState key={s.nom} nom={s.nom} ok={s.ok} />
          ))}
        </div>
      </Card>

      {/* Soldes commerçants */}
      <Card>
        <h2 className="mb-4 font-medium text-white">Soldes des commerçants</h2>
        <div className="space-y-2">
          {merchants.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between border-b border-slate-800 pb-2 text-sm last:border-0"
            >
              <span className="text-slate-300">{m.name}</span>
              <span className="font-medium text-white">{euros(m.balance_cents)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function ServiceState({ nom, ok }) {
  const map =
    ok === true
      ? { text: "Opérationnel", dot: "bg-emerald-400", cls: "text-emerald-400" }
      : ok === false
        ? { text: "Indisponible", dot: "bg-red-400", cls: "text-red-400" }
        : { text: "Non connecté", dot: "bg-slate-500", cls: "text-slate-400" };
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2.5">
      <span className="text-sm text-slate-300">{nom}</span>
      <span className={"flex items-center gap-2 text-xs " + map.cls}>
        <span className={"h-2 w-2 rounded-full " + map.dot} />
        {map.text}
      </span>
    </div>
  );
}

export function Header({ title, subtitle, onRefresh }) {
  return (
    <div className="flex items-end justify-between">
      <div>
        <h1 className="text-xl font-semibold text-white">{title}</h1>
        {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
      </div>
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800"
        >
          Rafraîchir
        </button>
      )}
    </div>
  );
}
