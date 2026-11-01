import { createRef, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  Activity, Radar, ClipboardList, GitBranch, Wrench, HeartPulse, RotateCcw, Check,
  ServerCog, CheckCircle2, Timer, ArrowUpRight, History,
} from "lucide-react";
import { getIncidents, getHealth } from "../api";
import { dateFr } from "@/lib/format";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import { ErrorNote, EmptyState, PageSkeleton } from "@/components/app/states";
import { AnimatedBeam } from "@/components/magicui/animated-beam";
import { cn } from "@/lib/utils";

const CYCLE = [
  "Fonctionnement normal",
  "Détection d'une anomalie",
  "Qualification de l'incident",
  "Décision (règles explicites)",
  "Action de remédiation",
  "Vérification de l'état du service",
  "Retour à la normale ou escalade",
];
const CYCLE_ICONS = [Activity, Radar, ClipboardList, GitBranch, Wrench, HeartPulse, RotateCcw];

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

  if (loading && incidents.length === 0 && !health) return <PageSkeleton />;
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
  const remediating = open.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Cyber-résilience" subtitle="Mécanisme de reprise automatique" onRefresh={load} refreshing={loading} />

      {/* État du moteur */}
      <motion.div
        layout
        className={cn(
          "flex items-center gap-4 rounded-card border px-4 py-3.5 sm:px-5",
          remediating ? "border-warning/30 bg-warning/10" : "border-success/30 bg-success/10"
        )}
      >
        <span className="relative flex size-3 shrink-0">
          <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-60 motion-reduce:hidden", remediating ? "bg-warning" : "bg-success")} />
          <span className={cn("relative inline-flex size-3 rounded-full", remediating ? "bg-warning" : "bg-success")} />
        </span>
        <p className={cn("text-sm", remediating ? "text-warning" : "text-success")}>
          Moteur de remédiation : <span className="font-semibold">actif</span>
          {remediating
            ? `. Remédiation en cours (${open.length} incident ouvert).`
            : ". Aucun incident ouvert, plateforme nominale."}
        </p>
      </motion.div>

      <CyclePipeline currentStep={currentStep} active={remediating} />

      {/* Métriques */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Service de paiement"
          value={serviceUp ? "Disponible" : "Indisponible"}
          icon={ServerCog}
          hint={serviceUp ? "Santé OK" : "Santé KO"}
          hintTone={serviceUp ? "success" : "danger"}
        />
        <StatCard label="Remédiations réussies" value={resolved.length} icon={CheckCircle2} hintTone="success" hint="Clôturées après contrôle" />
        <StatCard
          label="Temps de rétablissement moyen"
          value={avgReco !== null ? `${avgReco} s` : "—"}
          icon={Timer}
          hint={avgReco !== null ? "Détection → reprise" : "Aucune encore"}
        />
        <StatCard
          label="Escalades"
          value={escalated.length}
          icon={ArrowUpRight}
          hint="Reprise échouée"
          hintTone={escalated.length ? "danger" : "muted"}
        />
      </div>

      <p className="rounded-card border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
        Principe clé : un incident n'est déclaré résolu qu'après vérification que le service répond réellement (contrôle
        de santé), pas seulement parce qu'une action a été exécutée.
      </p>

      {/* Historique */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Historique des remédiations</CardTitle>
            <CardDescription>Incidents résolus ou escaladés</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <EmptyState icon={History} title="Aucune remédiation pour le moment">
              Lancez une attaque : la détection créera un incident, et le moteur le traitera automatiquement.
            </EmptyState>
          ) : (
            <ul className="space-y-2">
              {history.map((inc) => {
                const sec = recoverySeconds(inc);
                return (
                  <li key={inc.id} className="rounded-control border border-border bg-surface-2 px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <span className="font-mono text-xs text-subtle-foreground">#{inc.id}</span>
                      <span className="font-semibold text-foreground">{inc.kind}</span>
                      <StatusBadge status={inc.status} />
                      {sec !== null && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                          <Timer className="size-3.5" /> Rétabli en {sec} s
                        </span>
                      )}
                      <span className="ml-auto text-xs text-subtle-foreground">{dateFr(inc.created_at)}</span>
                    </div>
                    {inc.action && (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        Action : <span className="font-mono text-foreground">{inc.action}</span>
                        {inc.attempts ? `, ${inc.attempts} tentative(s)` : ""}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* Pipeline du cycle : les nœuds sont reliés par des faisceaux (Magic UI Animated Beam).
   En remédiation, le faisceau circule jusqu'à l'étape en cours ; au repos, seul le
   premier nœud « respire ». Horizontal sur grand écran, vertical sur mobile. */
function CyclePipeline({ currentStep, active }) {
  const containerRef = useRef(null);
  const nodeRefs = useMemo(() => CYCLE.map(() => createRef()), []);

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div>
          <CardTitle>Cycle de résilience</CardTitle>
          <CardDescription>{active ? "Remédiation en cours" : "Surveillance continue, en attente d'anomalie"}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div ref={containerRef} className="relative">
          <ol className="relative z-10 flex flex-col gap-5 lg:grid lg:grid-cols-7 lg:gap-2">
            {CYCLE.map((label, i) => {
              const isActive = active ? i === currentStep : i === 0;
              const passed = active && i < currentStep;
              const Icon = CYCLE_ICONS[i];
              return (
                <li key={i} className="flex items-center gap-4 lg:flex-col lg:gap-3 lg:text-center">
                  <span ref={nodeRefs[i]} className="relative grid size-12 shrink-0 place-items-center">
                    {isActive && (
                      <span
                        className={cn(
                          "absolute inset-0 animate-ping rounded-2xl opacity-40 motion-reduce:hidden",
                          active ? "bg-electric" : "bg-success"
                        )}
                      />
                    )}
                    <span
                      className={cn(
                        "relative grid size-12 place-items-center rounded-2xl border transition-colors duration-500",
                        passed && "border-success/40 bg-success text-white",
                        isActive && active && "border-transparent bg-brand text-white shadow-[0_10px_30px_-8px_rgb(0_130_253/0.8)]",
                        isActive && !active && "border-success/40 bg-success/15 text-success",
                        !passed && !isActive && "border-border bg-card text-subtle-foreground"
                      )}
                    >
                      {passed ? <Check className="size-5" strokeWidth={2.5} /> : <Icon className="size-5" aria-hidden="true" />}
                    </span>
                  </span>
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "text-sm leading-snug font-medium lg:text-[0.8rem]",
                        isActive ? "text-foreground" : passed ? "text-muted-foreground" : "text-subtle-foreground"
                      )}
                    >
                      {label}
                    </p>
                    {isActive && active && (
                      <span className="mt-1 inline-block rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
                        En cours
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
          {CYCLE.slice(0, -1).map((_, i) => (
            <AnimatedBeam
              key={i}
              containerRef={containerRef}
              fromRef={nodeRefs[i]}
              toRef={nodeRefs[i + 1]}
              active={active && i < currentStep}
              duration={2.2}
              delay={i * 0.35}
              repeatDelay={0.6}
              pathColor="var(--input)"
              pathOpacity={1}
              pathWidth={2}
              className="z-0"
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
