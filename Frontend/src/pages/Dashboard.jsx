import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ArrowLeftRight, ShieldAlert, Wallet, Server, Database, KeyRound, Wrench, Nfc } from "lucide-react";
import { getStats, getHealth } from "../api";
import { euros } from "@/lib/format";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { AreaChart, DonutChart } from "@/components/app/charts";
import { ErrorNote, PageSkeleton } from "@/components/app/states";
import { LogoMark } from "@/components/app/logo";
import { NumberTicker } from "@/components/magicui/number-ticker";
import { Ripple } from "@/components/magicui/ripple";
import { AnimatedCircularProgressBar } from "@/components/magicui/animated-circular-progress-bar";
import { cn } from "@/lib/utils";

const fmtEuros = (n) => euros(Math.round(n));

export default function Dashboard({ me }) {
  const [stats, setStats] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setStats(await getStats());
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

  if (loading && !stats) return <PageSkeleton />;
  if (error) return <ErrorNote>Impossible de charger les données : {error}</ErrorNote>;

  const series = (stats.series || []).map((d) => ({
    label: d.day.slice(8, 10) + "/" + d.day.slice(5, 7),
    value: Math.round(d.volume_cents / 100),
  }));

  const dbOk = health && health.status === "ok";

  const services = [
    { nom: "API de paiement", ok: true, icon: Server },
    { nom: "Base de données", ok: dbOk, icon: Database },
    { nom: "Authentification", ok: true, icon: KeyRound },
    { nom: "Moteur de remédiation", ok: null, icon: Wrench }, // non connecté pour l'instant
  ];

  const balance = me ? me.balance_cents : stats.volume_cents;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tableau de bord"
        subtitle={me ? `Bonjour, ${me.shop_name}` : "Vue d'ensemble"}
        onRefresh={load}
        refreshing={loading}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Solde présenté comme une carte de paiement : l'élément signature de la page */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="grain relative isolate overflow-hidden rounded-[1.5rem] bg-brand p-6 text-white shadow-[0_30px_60px_-30px_rgb(1_31_96/0.8)] sm:p-7 lg:col-span-2"
        >
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(60%_80%_at_100%_0%,rgb(2_169_252/0.6),transparent_65%),radial-gradient(50%_70%_at_0%_100%,rgb(59_43_184/0.5),transparent_65%)]" />
          <Ripple className="-z-10 left-auto w-1/2 [mask-image:radial-gradient(circle_at_70%_50%,black,transparent_70%)]" mainCircleSize={140} numCircles={6} mainCircleOpacity={0.2} />
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-white/85">
              <LogoMark mono className="size-6" /> Mon solde
            </div>
            <Nfc className="size-6 text-white/70" aria-hidden="true" />
          </div>
          <p className="mt-8 text-[2.4rem] leading-none font-extrabold tracking-[-0.04em] sm:text-[3.2rem]">
            <NumberTicker value={balance} format={fmtEuros} />
          </p>
          <div className="mt-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-3 text-sm">
            <div>
              <p className="text-xs text-white/60">Commerce</p>
              <p className="font-semibold">{me?.shop_name || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-white/60">Volume encaissé</p>
              <p className="font-mono font-semibold tabular">{euros(stats.volume_cents)}</p>
            </div>
            <div>
              <p className="text-xs text-white/60">Identifiant</p>
              <p className="font-mono font-semibold">@{me?.login || "marchand"}</p>
            </div>
          </div>
        </motion.div>

        {/* Taux de réussite */}
        <Card className="flex flex-col">
          <CardHeader>
            <div>
              <CardTitle>Taux de réussite</CardTitle>
              <CardDescription>Sur l'ensemble de vos paiements</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 items-center justify-center gap-6">
            <AnimatedCircularProgressBar
              value={stats.success_rate}
              gaugePrimaryColor="var(--success)"
              gaugeSecondaryColor="var(--muted)"
              className="size-36"
            >
              <span className="text-3xl font-bold tracking-tight text-foreground tabular">
                <NumberTicker value={stats.success_rate} decimalPlaces={stats.success_rate % 1 ? 1 : 0} />
                <span className="text-lg text-muted-foreground">%</span>
              </span>
            </AnimatedCircularProgressBar>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Réussies</dt>
                <dd className="font-semibold text-success tabular">{stats.validated}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Échouées</dt>
                <dd className={cn("font-semibold tabular", stats.failed ? "text-destructive" : "text-foreground")}>{stats.failed}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Transactions" value={stats.total} icon={ArrowLeftRight} hint={`${stats.validated} réussies`} hintTone="success" />
        <StatCard label="Volume encaissé" value={stats.volume_cents} format={fmtEuros} icon={Wallet} hint="Paiements réussis" />
        <StatCard
          label="Incidents de sécurité"
          value={stats.incidents_total}
          icon={ShieldAlert}
          hint={`${stats.incidents_open} ouverts`}
          hintTone={stats.incidents_open ? "warning" : "muted"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Volume encaissé</CardTitle>
              <CardDescription>7 derniers jours, en euros par jour</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <AreaChart data={series} format={(v) => `${v.toLocaleString("fr-FR")} €`} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Répartition des statuts</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <DonutChart
              segments={[
                { label: "Réussies", value: stats.validated, color: "var(--success)" },
                { label: "Échouées", value: stats.failed, color: "var(--destructive)" },
                { label: "En attente", value: stats.pending, color: "var(--warning)" },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>État des services</CardTitle>
            <CardDescription>Contrôle de santé de la plateforme</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((s) => (
            <ServiceState key={s.nom} {...s} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ServiceState({ nom, ok, icon: Icon }) {
  const map =
    ok === true
      ? { text: "Opérationnel", dot: "bg-success", cls: "text-success", ping: true }
      : ok === false
        ? { text: "Indisponible", dot: "bg-destructive", cls: "text-destructive", ping: true }
        : { text: "Non connecté", dot: "bg-subtle-foreground", cls: "text-muted-foreground", ping: false };
  return (
    <div className="flex items-center gap-3 rounded-control border border-border bg-surface-2 px-3.5 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-[0.6rem] bg-accent text-accent-foreground">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{nom}</p>
        <p className={cn("flex items-center gap-1.5 text-xs font-medium", map.cls)}>
          <span className="relative flex size-2">
            {map.ping && <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-50 motion-reduce:hidden", map.dot)} />}
            <span className={cn("relative inline-flex size-2 rounded-full", map.dot)} />
          </span>
          {map.text}
        </p>
      </div>
    </div>
  );
}
