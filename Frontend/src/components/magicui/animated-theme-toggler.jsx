// Magic UI — Animated Theme Toggler (mode contrôlé, transition circulaire via View Transitions).
import { useCallback, useRef } from "react";
import { Moon, Sun } from "lucide-react";
import { flushSync } from "react-dom";
import { cn } from "@/lib/utils";

export function AnimatedThemeToggler({ theme, onThemeChange, duration = 450, className, children, ...props }) {
  const ref = useRef(null);
  const busy = useRef(false);
  const isDark = theme === "dark";

  const toggle = useCallback(() => {
    const next = isDark ? "light" : "dark";
    const apply = () => {
      document.documentElement.classList.toggle("dark", next === "dark");
      onThemeChange?.(next);
    };
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (busy.current || typeof document.startViewTransition !== "function" || reduce || !ref.current) {
      apply();
      return;
    }
    const { top, left, width, height } = ref.current.getBoundingClientRect();
    const x = left + width / 2;
    const y = top + height / 2;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const r = Math.hypot(Math.max(x, vw - x), Math.max(y, vh - y));
    const toR = (v) => `${(v / (Math.hypot(vw, vh) / Math.SQRT2)) * 100}%`;
    const at = `${(x / vw) * 100}% ${(y / vh) * 100}%`;
    const clip = [`circle(0% at ${at})`, `circle(${toR(r)} at ${at})`];
    const root = document.documentElement;
    root.dataset.magicuiThemeVt = "active";
    root.style.setProperty("--magicui-theme-vt-clip-from", clip[0]);
    busy.current = true;
    const t = document.startViewTransition(() => flushSync(apply));
    t.ready
      .then(() =>
        root.animate({ clipPath: clip }, { duration, easing: "ease-in-out", fill: "forwards", pseudoElement: "::view-transition-new(root)" })
      )
      .catch(() => {});
    t.finished.finally(() => {
      busy.current = false;
      delete root.dataset.magicuiThemeVt;
      root.style.removeProperty("--magicui-theme-vt-clip-from");
    });
  }, [isDark, onThemeChange, duration]);

  return (
    <button
      ref={ref}
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Passer en mode clair" : "Passer en mode sombre"}
      className={cn("cursor-pointer", className)}
      {...props}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      {children}
    </button>
  );
}
