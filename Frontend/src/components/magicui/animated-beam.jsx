// Magic UI — Animated Beam : faisceau animé entre deux éléments (pipeline de résilience).
import { useEffect, useId, useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export function AnimatedBeam({
  className,
  containerRef,
  fromRef,
  toRef,
  curvature = 0,
  reverse = false,
  duration = 4,
  delay = 0,
  pathColor = "currentColor",
  pathWidth = 2,
  pathOpacity = 0.15,
  gradientStartColor = "#02a9fc",
  gradientStopColor = "#0082fd",
  active = true,
  repeat = Infinity,
  repeatDelay = 0,
  startXOffset = 0,
  startYOffset = 0,
  endXOffset = 0,
  endYOffset = 0,
}) {
  const id = useId();
  const [pathD, setPathD] = useState("");
  const [dim, setDim] = useState({ width: 0, height: 0 });

  const coords = reverse
    ? { x1: ["90%", "-10%"], x2: ["100%", "0%"], y1: ["0%", "0%"], y2: ["0%", "0%"] }
    : { x1: ["10%", "110%"], x2: ["0%", "100%"], y1: ["0%", "0%"], y2: ["0%", "0%"] };

  useEffect(() => {
    const update = () => {
      if (!containerRef.current || !fromRef.current || !toRef.current) return;
      const c = containerRef.current.getBoundingClientRect();
      const a = fromRef.current.getBoundingClientRect();
      const b = toRef.current.getBoundingClientRect();
      setDim({ width: c.width, height: c.height });
      const sx = a.left - c.left + a.width / 2 + startXOffset;
      const sy = a.top - c.top + a.height / 2 + startYOffset;
      const ex = b.left - c.left + b.width / 2 + endXOffset;
      const ey = b.top - c.top + b.height / 2 + endYOffset;
      setPathD(`M ${sx},${sy} Q ${(sx + ex) / 2},${sy - curvature} ${ex},${ey}`);
    };
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    update();
    return () => ro.disconnect();
  }, [containerRef, fromRef, toRef, curvature, startXOffset, startYOffset, endXOffset, endYOffset]);

  return (
    <svg
      fill="none"
      width={dim.width}
      height={dim.height}
      aria-hidden="true"
      className={cn("pointer-events-none absolute top-0 left-0 transform-gpu", className)}
      viewBox={`0 0 ${dim.width} ${dim.height}`}
    >
      <path d={pathD} stroke={pathColor} strokeWidth={pathWidth} strokeOpacity={pathOpacity} strokeLinecap="round" />
      {active && (
        <path d={pathD} strokeWidth={pathWidth} stroke={`url(#${id})`} strokeLinecap="round" />
      )}
      <defs>
        <motion.linearGradient
          id={id}
          gradientUnits="userSpaceOnUse"
          initial={{ x1: "0%", x2: "0%", y1: "0%", y2: "0%" }}
          animate={coords}
          transition={{ delay, duration, ease: [0.16, 1, 0.3, 1], repeat, repeatDelay }}
        >
          <stop stopColor={gradientStartColor} stopOpacity="0" />
          <stop stopColor={gradientStartColor} />
          <stop offset="32.5%" stopColor={gradientStopColor} />
          <stop offset="100%" stopColor={gradientStopColor} stopOpacity="0" />
        </motion.linearGradient>
      </defs>
    </svg>
  );
}
