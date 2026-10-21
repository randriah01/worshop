// Petits composants d'interface réutilisables + helpers de formatage.

export function euros(cents) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format((cents || 0) / 100);
}

export function dateFr(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function Card({ children, className = "" }) {
  return (
    <div
      className={
        "rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5 shadow-sm " +
        className
      }
    >
      {children}
    </div>
  );
}

export function StatCard({ label, value, hint, hintColor = "text-[var(--text-muted)]" }) {
  return (
    <Card className="np-fade">
      <p className="text-sm text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[var(--text)]">{value}</p>
      {hint && <p className={"mt-1 text-xs " + hintColor}>{hint}</p>}
    </Card>
  );
}

const STATUS_STYLES = {
  validated: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  rejected: "bg-red-500/15 text-red-400 border-red-500/30",
  error: "bg-red-500/15 text-red-400 border-red-500/30",
  open: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  resolved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

const STATUS_LABELS = {
  validated: "Réussie",
  pending: "En attente",
  rejected: "Échouée",
  error: "Erreur",
  open: "Ouvert",
  resolved: "Résolu",
};

export function StatusBadge({ status }) {
  const style =
    STATUS_STYLES[status] || "bg-slate-500/15 text-[var(--text-soft)] border-slate-500/30";
  return (
    <span
      className={
        "inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium " + style
      }
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}

export function Spinner({ label = "Chargement…" }) {
  return (
    <div className="flex items-center gap-3 py-10 text-[var(--text-muted)]">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-blue-400" />
      {label}
    </div>
  );
}

export function ErrorNote({ children }) {
  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
      {children}
    </div>
  );
}

// --- Graphique en aires (SVG, sans dépendance) ---
export function AreaChart({ data = [], height = 180, color = "#3b82f6" }) {
  if (!data.length) {
    return <div className="py-10 text-center text-sm text-[var(--text-faint)]">Aucune donnée</div>;
  }
  const w = 560;
  const h = height;
  const pad = 28;
  const max = Math.max(...data.map((d) => d.value), 1);
  const stepX = (w - pad * 2) / Math.max(data.length - 1, 1);
  const x = (i) => pad + i * stepX;
  const y = (v) => h - pad - (v / max) * (h - pad * 2);
  const line = data.map((d, i) => `${x(i)},${y(d.value)}`).join(" ");
  const area = `${pad},${h - pad} ${line} ${x(data.length - 1)},${h - pad}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="np-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#np-area)" />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(d.value)} r="2.5" fill={color} />
          <text
            x={x(i)}
            y={h - 8}
            textAnchor="middle"
            className="fill-slate-500"
            fontSize="10"
          >
            {d.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

// --- Graphique en anneau (SVG) ---
export function DonutChart({ segments = [], size = 160 }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {total === 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="#1e293b"
              strokeWidth="14"
            />
          )}
          {segments.map((s, i) => {
            const frac = total ? s.value / total : 0;
            const dash = frac * c;
            const circle = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth="14"
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offset}
              />
            );
            offset += dash;
            return circle;
          })}
        </g>
      </svg>
      <div className="space-y-1.5 text-sm">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-[var(--text-soft)]">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: s.color }}
            />
            {s.label} <span className="text-[var(--text-faint)]">· {s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
