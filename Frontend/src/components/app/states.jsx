import { AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function ErrorNote({ children, className }) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-card border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive",
        className
      )}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center rounded-card border border-dashed border-border bg-surface-2 px-6 py-10 text-center">
      {Icon && (
        <span className="mb-3 grid size-11 place-items-center rounded-full bg-accent text-accent-foreground">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      )}
      {title && <p className="font-semibold text-foreground">{title}</p>}
      {children && <p className="mt-1 max-w-md text-sm text-muted-foreground">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// Squelette générique d'une page (remplace l'ancien spinner).
export function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Chargement">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-card" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-card lg:col-span-2" />
        <Skeleton className="h-72 rounded-card" />
      </div>
    </div>
  );
}

export function Spinner({ label = "Chargement…", className }) {
  return (
    <div className={cn("flex items-center gap-3 py-10 text-sm text-muted-foreground", className)}>
      <span className="size-4 animate-spin rounded-full border-2 border-border border-t-sky" />
      {label}
    </div>
  );
}
