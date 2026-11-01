// Magic UI — Dot Pattern (version optimisée : un seul motif SVG <pattern> au lieu
// d'un cercle animé par point, donc coût de rendu constant quelle que soit la taille).
import { useId } from "react";
import { cn } from "@/lib/utils";

export function DotPattern({ width = 18, height = 18, cx = 1, cy = 1, cr = 1, className, ...props }) {
  const id = useId();
  return (
    <svg aria-hidden="true" className={cn("pointer-events-none absolute inset-0 h-full w-full fill-current", className)} {...props}>
      <defs>
        <pattern id={id} width={width} height={height} patternUnits="userSpaceOnUse">
          <circle cx={cx} cy={cy} r={cr} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
