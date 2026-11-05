import { cn } from "@/lib/utils";

export function Card({ className, ...props }) {
  return (
    <div
      className={cn("rounded-card border border-border bg-card text-card-foreground", className)}
      {...props}
    />
  );
}
export function CardHeader({ className, ...props }) {
  return <div className={cn("flex items-start justify-between gap-4 p-5 pb-0 sm:p-6 sm:pb-0", className)} {...props} />;
}
export function CardTitle({ className, ...props }) {
  return <h2 className={cn("text-[0.95rem] font-semibold tracking-tight text-foreground", className)} {...props} />;
}
export function CardDescription({ className, ...props }) {
  return <p className={cn("mt-0.5 text-sm text-muted-foreground", className)} {...props} />;
}
export function CardContent({ className, ...props }) {
  return <div className={cn("p-5 sm:p-6", className)} {...props} />;
}
