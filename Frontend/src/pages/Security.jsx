import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ShieldAlert, ShieldCheck, CircleDot, ChevronRight, Check, Radar } from "lucide-react";
import { getIncidents } from "../api";
import { dateFr } from "@/lib/format";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import { ErrorNote, EmptyState } from "@/components/app/states";
import { BorderBeam } from "@/components/magicui/border-beam";
import { cn } from "@/lib/utils";

// Gravité déduite du type d'incident (le backend ne la stocke pas encore).
function severity(kind = "") {
  const k = kind.toLowerCase();
  if (
    k.includes("injection") || k.includes("sql") || k.includes("exfil") ||
    k.includes("indispo") || k.includes("panne") || k.includes("down") ||
    k.includes("base de données")
  )
    return "critique";
  if (
    k.includes("dos") || k.includes("flood") || k.includes("ddos") ||
    k.includes("trafic") || k.includes("déni") || k.includes("deni") || k.includes("pic")
  )
    return "élevé";
  if (
    k.includes("latence") || k.includes("latency") ||
    k.includes("error") || k.includes("erreur") || k.includes("timeout")
  )
    return "moyen";
  if (k) return "faible";
  return "information";
}

const SEV_TONE = {
  critique: "danger",
  élevé: "orange",
  moyen: "warning",
  faible: "brand",
  information: "neutral",
};

const SEV_BAR = {
  critique: "bg-destructive",
  élevé: "bg-orange-500",
  moyen: "bg-warning",
  faible: "bg-electric",
  information: "bg-subtle-foreground",
};

function SevBadge({ level }) {
  return <Badge tone={SEV_TONE[level]} className="capitalize">{level}</Badge>;
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
      <PageHeader title="Cybersécurité" subtitle="Supervision des incidents et anomalies" onRefresh={load} refreshing={loading} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Incidents" value={incidents.length} icon={ShieldAlert} />
        <StatCard label="Ouverts" value={openCount} icon={CircleDot} hint="À traiter" hintTone={openCount ? "warning" : "muted"} />
        <StatCard label="Résolus" value={resolved} icon={ShieldCheck} hint="Après vérification de santé" hintTone="success" />
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Journal des incidents</CardTitle>
            <CardDescription>Cliquez sur un incident pour voir sa chronologie.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {loading && incidents.length === 0 ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : error ? (
            <ErrorNote>{error}</ErrorNote>
          ) : incidents.length === 0 ? (
            <EmptyState icon={Radar} title="Aucun incident pour le moment">
              Les incidents sont créés par la détection et le moteur de remédiation (endpoint interne sécurisé).
            </EmptyState>
          ) : (
            <ul className="space-y-2">
              {incidents.map((inc, i) => {
                const level = severity(inc.kind);
                const isOpen = inc.status === "open";
                return (
                  <motion.li
                    key={inc.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.04, 0.3), duration: 0.3 }}
                  >
                    <button
                      onClick={() => setOpen(inc)}
                      className="group relative flex w-full cursor-pointer items-center gap-4 overflow-hidden rounded-control border border-border bg-surface-2 py-3 pr-3 pl-5 text-left transition hover:border-input hover:bg-muted"
                    >
                      <span aria-hidden="true" className={cn("absolute inset-y-0 left-0 w-1", SEV_BAR[level])} />
                      {isOpen && <BorderBeam size={50} duration={5} colorFrom="#f5b33f" colorTo="#ff5876" />}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-subtle-foreground">#{inc.id}</span>
                          <span className="font-semibold text-foreground">{inc.kind}</span>
                          <SevBadge level={level} />
                        </div>
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">{inc.detail || "Pas de détail fourni."}</p>
                      </div>
                      <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                        <StatusBadge status={inc.status} />
                        <span className="text-xs text-subtle-foreground">{dateFr(inc.created_at)}</span>
                      </div>
                      <div className="sm:hidden"><StatusBadge status={inc.status} /></div>
                      <ChevronRight className="size-4 shrink-0 text-subtle-foreground transition group-hover:translate-x-0.5" aria-hidden="true" />
                    </button>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <IncidentTimeline inc={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function IncidentTimeline({ inc, onClose }) {
  const resolved = inc && inc.status === "resolved";
  const steps = inc
    ? [
        { t: "Apparition de l'anomalie", done: true, at: inc.created_at },
        { t: "Détection", done: true, at: inc.created_at },
        { t: "Qualification de l'incident", done: true },
        { t: "Décision (règles de remédiation)", done: resolved, pending: !resolved },
        { t: "Action de remédiation", done: resolved, pending: !resolved },
        { t: "Vérification du rétablissement", done: resolved, pending: !resolved },
      ]
    : [];
  return (
    <Dialog open={Boolean(inc)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        {inc && (
          <>
            <DialogHeader>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <SevBadge level={severity(inc.kind)} />
                <StatusBadge status={inc.status} />
              </div>
              <DialogTitle>
                Incident #{inc.id} : {inc.kind}
              </DialogTitle>
              <DialogDescription>{inc.detail || "Pas de détail fourni."}</DialogDescription>
            </DialogHeader>

            <ol className="relative space-y-5 pl-1">
              <span aria-hidden="true" className="absolute top-2 bottom-2 left-[13px] w-px bg-border" />
              {steps.map((s, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.06 * i }}
                  className="relative flex gap-3.5"
                >
                  <span
                    className={cn(
                      "relative z-10 mt-0.5 grid size-[26px] shrink-0 place-items-center rounded-full text-[11px] font-semibold",
                      s.done
                        ? "bg-success text-white"
                        : s.pending
                          ? "border-2 border-warning bg-popover text-warning"
                          : "border border-border bg-popover text-subtle-foreground"
                    )}
                  >
                    {s.done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                  </span>
                  <div>
                    <p className={cn("text-sm font-medium", s.done ? "text-foreground" : "text-muted-foreground")}>{s.t}</p>
                    {s.at && <p className="text-xs text-subtle-foreground">{dateFr(s.at)}</p>}
                    {s.pending && <p className="text-xs text-warning">En attente du moteur de remédiation</p>}
                  </div>
                </motion.li>
              ))}
            </ol>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
