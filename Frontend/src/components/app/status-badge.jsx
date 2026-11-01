import { CheckCircle2, Clock3, XCircle, AlertTriangle, CircleDot, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Statuts identiques au backend ; seul l'habillage change.
const MAP = {
  validated: { label: "Réussie", tone: "success", icon: CheckCircle2 },
  pending: { label: "En attente", tone: "warning", icon: Clock3 },
  rejected: { label: "Échouée", tone: "danger", icon: XCircle },
  error: { label: "Erreur", tone: "danger", icon: AlertTriangle },
  open: { label: "Ouvert", tone: "warning", icon: CircleDot },
  resolved: { label: "Résolu", tone: "success", icon: CheckCircle2 },
  escalated: { label: "Escaladé", tone: "danger", icon: ArrowUpRight },
};

export function StatusBadge({ status }) {
  const s = MAP[status] || { label: status, tone: "neutral" };
  const Icon = s.icon;
  return (
    <Badge tone={s.tone}>
      {Icon && <Icon aria-hidden="true" />}
      {s.label}
    </Badge>
  );
}
