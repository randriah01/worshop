// Magic UI — Ripple : ondes concentriques (clin d'œil aux cercles des références).
import { memo } from "react";
import { cn } from "@/lib/utils";

export const Ripple = memo(function Ripple({
  mainCircleSize = 210,
  mainCircleOpacity = 0.24,
  numCircles = 8,
  color = "rgb(255 255 255)",
  className,
  ...props
}) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 select-none", className)}
      {...props}
    >
      {Array.from({ length: numCircles }, (_, i) => (
        <div
          key={i}
          className="absolute animate-ripple rounded-full border"
          style={{
            "--i": i,
            width: `${mainCircleSize + i * 70}px`,
            height: `${mainCircleSize + i * 70}px`,
            opacity: Math.max(mainCircleOpacity - i * 0.03, 0.02),
            animationDelay: `${i * 0.06}s`,
            borderColor: color,
            background: `color-mix(in srgb, ${color} 6%, transparent)`,
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%) scale(1)",
          }}
        />
      ))}
    </div>
  );
});
