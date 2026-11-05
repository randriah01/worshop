import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef(function Input({ className, type = "text", ...props }, ref) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-11 w-full min-w-0 rounded-control border border-input bg-surface-2 px-3.5 text-[0.95rem] text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-subtle-foreground",
        "focus-visible:border-ring focus-visible:shadow-[0_0_0_4px_rgb(2_169_252/0.15)] focus-visible:outline-none",
        "aria-invalid:border-destructive aria-invalid:shadow-[0_0_0_4px_rgb(220_47_79/0.12)] disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
});

// Champ avec icône à gauche (et contenu optionnel à droite), façon formulaires de connexion.
export const IconInput = forwardRef(function IconInput(
  { icon: Icon, trailing, className, inputClassName, ...props },
  ref
) {
  return (
    <div className={cn("relative", className)}>
      {Icon && (
        <Icon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-subtle-foreground"
        />
      )}
      <Input ref={ref} className={cn(Icon && "pl-11", trailing && "pr-14", inputClassName)} {...props} />
      {trailing && <div className="absolute top-1/2 right-3 -translate-y-1/2">{trailing}</div>}
    </div>
  );
});
