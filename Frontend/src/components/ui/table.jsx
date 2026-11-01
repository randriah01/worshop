import { cn } from "@/lib/utils";

export function Table({ className, ...props }) {
  return (
    <div className="relative w-full overflow-x-auto">
      <table className={cn("w-full caption-bottom text-left text-sm", className)} {...props} />
    </div>
  );
}
export function TableHeader({ className, ...props }) {
  return <thead className={cn("[&_tr]:border-b", className)} {...props} />;
}
export function TableBody({ className, ...props }) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}
export function TableRow({ className, ...props }) {
  return <tr className={cn("border-b border-border transition-colors hover:bg-muted/60", className)} {...props} />;
}
export function TableHead({ className, ...props }) {
  return (
    <th
      className={cn("h-10 px-3 text-xs font-semibold whitespace-nowrap text-subtle-foreground first:pl-0 last:pr-0", className)}
      {...props}
    />
  );
}
export function TableCell({ className, ...props }) {
  return <td className={cn("px-3 py-3 align-middle whitespace-nowrap first:pl-0 last:pr-0", className)} {...props} />;
}
