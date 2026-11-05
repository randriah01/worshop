import { RefreshCw } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PageHeader({ title, subtitle, onRefresh, refreshing, children, className }) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <h1 className="text-[1.65rem] leading-tight font-bold tracking-[-0.03em] text-foreground sm:text-[1.9rem]">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        {children}
        {onRefresh && (
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
            <motion.span
              className="inline-flex"
              animate={refreshing ? { rotate: 360 } : { rotate: 0 }}
              transition={refreshing ? { repeat: Infinity, duration: 0.9, ease: "linear" } : { duration: 0 }}
            >
              <RefreshCw />
            </motion.span>
            Rafraîchir
          </Button>
        )}
      </div>
    </div>
  );
}
