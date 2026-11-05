// Magic UI — Magic Card (adapté pour Vite : sans next-themes, couleurs via tokens CSS).
// Le projecteur suit le pointeur ; uniquement transform/background, aucun re-rendu React.
import { useCallback, useEffect } from "react";
import { motion, useMotionTemplate, useMotionValue } from "motion/react";
import { cn } from "@/lib/utils";

export function MagicCard({
  children,
  className,
  gradientSize = 220,
  gradientColor = "rgb(2 169 252 / 0.10)",
  gradientFrom = "#02a9fc",
  gradientTo = "#034eaa",
}) {
  const mouseX = useMotionValue(-gradientSize);
  const mouseY = useMotionValue(-gradientSize);

  const reset = useCallback(() => {
    mouseX.set(-gradientSize);
    mouseY.set(-gradientSize);
  }, [mouseX, mouseY, gradientSize]);

  const onMove = useCallback(
    (e) => {
      if (e.pointerType === "touch") return;
      const r = e.currentTarget.getBoundingClientRect();
      mouseX.set(e.clientX - r.left);
      mouseY.set(e.clientY - r.top);
    },
    [mouseX, mouseY]
  );

  useEffect(() => {
    window.addEventListener("blur", reset);
    return () => window.removeEventListener("blur", reset);
  }, [reset]);

  const border = useMotionTemplate`
    linear-gradient(var(--card) 0 0) padding-box,
    radial-gradient(${gradientSize}px circle at ${mouseX}px ${mouseY}px, ${gradientFrom}, ${gradientTo}, var(--border) 100%) border-box`;
  const glow = useMotionTemplate`radial-gradient(${gradientSize}px circle at ${mouseX}px ${mouseY}px, ${gradientColor}, transparent 100%)`;

  return (
    <motion.div
      className={cn("group relative isolate overflow-hidden rounded-card border border-transparent", className)}
      onPointerMove={onMove}
      onPointerLeave={reset}
      style={{ background: border }}
    >
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-px z-10 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: glow }}
      />
      <div className="relative z-20 h-full">{children}</div>
    </motion.div>
  );
}
