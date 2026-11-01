// Graphiques SVG sans dépendance (repris de l'ancien kit, redessinés).
// Le tracé se dessine une seule fois à l'apparition (Motion pathLength).
import { useId, useState } from "react";
import { motion } from "motion/react";

export function AreaChart({ data = [], height = 200, format = (v) => v }) {
  const id = useId().replace(/:/g, "");
  const [hover, setHover] = useState(null);
  if (!data.length) {
    return <div className="py-12 text-center text-sm text-subtle-foreground">Aucune donnée sur la période.</div>;
  }
  const w = 600;
  const h = height;
  const padX = 18;
  const padTop = 18;
  const padBottom = 28;
  const max = Math.max(...data.map((d) => d.value), 1);
  const stepX = (w - padX * 2) / Math.max(data.length - 1, 1);
  const x = (i) => padX + i * stepX;
  const y = (v) => h - padBottom - (v / max) * (h - padTop - padBottom);
  // Courbe lissée (Catmull-Rom → Bézier).
  const pts = data.map((d, i) => [x(i), y(d.value)]);
  let line = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    line += ` C ${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  const area = `${line} L ${x(data.length - 1)},${h - padBottom} L ${padX},${h - padBottom} Z`;
  const grid = [0.25, 0.5, 0.75, 1].map((f) => h - padBottom - f * (h - padTop - padBottom));

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full overflow-visible" role="img" aria-label="Volume encaissé par jour">
        <defs>
          <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0082fd" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0082fd" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#034eaa" />
            <stop offset="100%" stopColor="#02a9fc" />
          </linearGradient>
        </defs>
        {grid.map((gy, i) => (
          <line key={i} x1={padX} x2={w - padX} y1={gy} y2={gy} stroke="var(--border)" strokeDasharray="3 5" />
        ))}
        <motion.path d={area} fill={`url(#${id}f)`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.3 }} />
        <motion.path
          d={line}
          fill="none"
          stroke={`url(#${id}s)`}
          strokeWidth="2.5"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        />
        {data.map((d, i) => (
          <g key={i}>
            <rect
              x={x(i) - stepX / 2}
              y={0}
              width={stepX}
              height={h}
              fill="transparent"
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
            />
            {hover === i && <line x1={x(i)} x2={x(i)} y1={padTop} y2={h - padBottom} stroke="var(--input)" />}
            <circle
              cx={x(i)}
              cy={y(d.value)}
              r={hover === i ? 5 : 3}
              fill="var(--card)"
              stroke="#0082fd"
              strokeWidth="2"
              style={{ transition: "r .15s" }}
            />
            <text x={x(i)} y={h - 8} textAnchor="middle" fontSize="11" fill="var(--subtle-foreground)">
              {d.label}
            </text>
          </g>
        ))}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg bg-navy px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-white shadow-float"
          style={{ left: `${(x(hover) / w) * 100}%`, top: `${(y(data[hover].value) / h) * 100}%`, marginTop: -10 }}
        >
          {format(data[hover].value)}
          <span className="ml-1.5 font-normal text-white/60">{data[hover].label}</span>
        </div>
      )}
    </div>
  );
}

export function DonutChart({ segments = [], size = 156 }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const stroke = 16;
  const r = size / 2 - stroke;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Répartition des statuts">
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={stroke} />
            {segments.map((s, i) => {
              const frac = total ? s.value / total : 0;
              const dash = Math.max(frac * c - (frac > 0 && frac < 1 ? 3 : 0), 0);
              const el = (
                <motion.circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={stroke}
                  strokeLinecap="butt"
                  strokeDasharray={`${dash} ${c - dash}`}
                  strokeDashoffset={-offset}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.15 * i, duration: 0.4 }}
                />
              );
              offset += frac * c;
              return el;
            })}
          </g>
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-2xl font-bold tracking-tight text-foreground tabular">{total}</p>
            <p className="text-[11px] text-muted-foreground">transactions</p>
          </div>
        </div>
      </div>
      <ul className="space-y-2 text-sm">
        {segments.map((s, i) => (
          <li key={i} className="flex items-center gap-2.5 text-muted-foreground">
            <span className="inline-block size-2.5 rounded-full" style={{ background: s.color }} />
            <span className="text-foreground">{s.label}</span>
            <span className="font-mono text-xs tabular">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
