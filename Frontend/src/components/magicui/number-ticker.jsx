// Magic UI — Number Ticker (adapté : format fr-FR, formateur libre, démarrage au
// montage, repart de la valeur précédente au rafraîchissement, respecte la réduction des animations).
import { useEffect, useRef } from "react";
import { useMotionValue, useSpring, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

const defaultFormat = (n, decimals) =>
  new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);

export function NumberTicker({
  value,
  startValue = 0,
  delay = 0,
  decimalPlaces = 0,
  format,
  className,
  ...props
}) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const motionValue = useMotionValue(reduce ? value : startValue);
  const springValue = useSpring(motionValue, { damping: 28, stiffness: 150, restDelta: 0.5 });
  const fmt = format || ((n) => defaultFormat(n, decimalPlaces));

  useEffect(() => {
    // Démarre au montage (et repart de la valeur affichée lors d'un rafraîchissement) :
    // aucune valeur ne reste bloquée à 0 hors écran.
    const t = setTimeout(() => motionValue.set(value), delay * 1000);
    return () => clearTimeout(t);
  }, [motionValue, delay, value]);

  useEffect(() => {
    const render = (latest) => {
      if (ref.current) ref.current.textContent = fmt(Number(latest.toFixed(decimalPlaces)));
    };
    render(springValue.get());
    return springValue.on("change", render);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [springValue, decimalPlaces, format]);

  return (
    <span ref={ref} className={cn("inline-block tabular", className)} {...props}>
      {fmt(reduce ? value : startValue)}
    </span>
  );
}
