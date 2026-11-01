import { MagicCard } from "@/components/magicui/magic-card";
import { NumberTicker } from "@/components/magicui/number-ticker";
import { cn } from "@/lib/utils";

// Carte KPI : valeur animée (Number Ticker) + projecteur au survol (Magic Card).
// `value` peut être un nombre (animé) ou un texte (affiché tel quel).
export function StatCard({ label, value, format, decimals = 0, hint, hintTone = "muted", icon: Icon, className }) {
  const tones = {
    muted: "text-muted-foreground",
    success: "text-success",
    warning: "text-warning",
    danger: "text-destructive",
    brand: "text-accent-foreground",
  };
  return (
    <MagicCard className={cn("h-full", className)}>
      <div className="flex h-full flex-col p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[0.8rem] font-medium text-muted-foreground">{label}</p>
          {Icon && (
            <span className="grid size-8 place-items-center rounded-[0.6rem] bg-accent text-accent-foreground">
              <Icon className="size-4" aria-hidden="true" />
            </span>
          )}
        </div>
        <p className="mt-3 truncate text-[1.55rem] leading-none font-bold tracking-[-0.03em] text-foreground sm:text-[1.75rem]">
          {typeof value === "number" ? <NumberTicker value={value} format={format} decimalPlaces={decimals} /> : value}
        </p>
        {hint && <p className={cn("mt-2 text-xs font-medium", tones[hintTone])}>{hint}</p>}
      </div>
    </MagicCard>
  );
}
