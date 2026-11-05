// Magic UI — Confetti (canvas-confetti chargé à la demande : 0 octet au démarrage).
export async function fireConfetti(origin) {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const { default: confetti } = await import("canvas-confetti");
  const colors = ["#02a9fc", "#0082fd", "#034eaa", "#f7fbff", "#2fd29a"];
  confetti({ particleCount: 70, spread: 70, startVelocity: 38, origin: origin || { y: 0.6 }, colors, scalar: 0.9, disableForReducedMotion: true });
}
