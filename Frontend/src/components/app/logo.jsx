import { useId } from "react";
import { cn } from "@/lib/utils";

// Emblème NovaPay redessiné en SVG (ruban « N » + étoile), net à toutes les tailles.
export function LogoMark({ className, mono = false }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 100 100" className={cn("size-9 shrink-0", className)} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}a`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={mono ? "#fff" : "#034EAA"} />
          <stop offset="1" stopColor={mono ? "#dbeeff" : "#0082FD"} />
        </linearGradient>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={mono ? "#fff" : "#02A9FC"} />
          <stop offset="1" stopColor={mono ? "#cfe8ff" : "#0082FD"} />
        </linearGradient>
        <linearGradient id={`${id}c`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={mono ? "#b9dcff" : "#011F60"} />
          <stop offset=".55" stopColor={mono ? "#e6f3ff" : "#0157B4"} />
          <stop offset="1" stopColor={mono ? "#fff" : "#029DFF"} />
        </linearGradient>
      </defs>
      <rect x="6" y="12" width="30" height="80" rx="11" fill={`url(#${id}a)`} />
      <rect x="64" y="8" width="30" height="80" rx="11" fill={`url(#${id}b)`} />
      <path
        d="M14 13.5c4.5-4.5 12-4.5 16.5 0l55 55c4.5 4.5 4.5 12 0 16.5l-1 1c-4.5 4.5-12 4.5-16.5 0l-55-55c-4.5-4.5-4.5-12 0-16.5z"
        fill={`url(#${id}c)`}
      />
      <path
        d="M50 29c1.6 12.5 5.5 16.6 18 19-12.5 2.4-16.4 6.5-18 19-1.6-12.5-5.5-16.6-18-19 12.5-2.4 16.4-6.5 18-19z"
        fill={mono ? "#011F60" : "#fff"}
      />
    </svg>
  );
}

// Logo complet. `onDark` force le texte clair (fonds bleu nuit).
export function Logo({ className, markClassName, onDark = false, subtitle }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className={markClassName} />
      <div className="leading-none">
        <p className={cn("text-[1.2rem] font-extrabold tracking-[-0.03em]", onDark ? "text-white" : "text-navy dark:text-white")}>
          Nova<span className="text-sky">Pay</span>
        </p>
        {subtitle && (
          <p className={cn("mt-1 max-w-40 truncate text-[11px] font-medium", onDark ? "text-white/55" : "text-muted-foreground")}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
