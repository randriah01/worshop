// Carte bancaire NovaPay : élément signature de l'identité.
// - Inclinaison 3D qui suit le pointeur (désactivée au toucher / réduction des animations)
// - Retournement recto/verso (pour afficher le CVC pendant la saisie)
// Uniquement transform/opacity : animé sur le GPU, sans re-rendu React.
import { useEffect } from "react";
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion, useMotionTemplate } from "motion/react";
import { Nfc } from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoMark } from "./logo";

function Chip() {
  return (
    <svg viewBox="0 0 48 36" className="h-auto w-[13cqw]" aria-hidden="true">
      <defs>
        <linearGradient id="np-chip" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f3f7ff" />
          <stop offset=".5" stopColor="#a9bcd9" />
          <stop offset="1" stopColor="#e4ecf8" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="46" height="34" rx="7" fill="url(#np-chip)" />
      <path d="M1 12h14M1 24h14M33 12h14M33 24h14M15 1v34M33 1v34M15 18h18" stroke="#7d90b0" strokeWidth="1.4" fill="none" opacity=".7" />
    </svg>
  );
}

function maskNumber(n) {
  const digits = (n || "").replace(/\s/g, "");
  const filled = (digits + "•".repeat(16)).slice(0, 16);
  return filled.replace(/(.{4})/g, "$1 ").trim();
}

export function CreditCard({
  number = "",
  name = "",
  expiry = "",
  cvc = "",
  brand = "",
  flipped = false,
  interactive = true,
  className,
  variant = "brand",
}) {
  const reduce = useReducedMotion();
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const sx = useSpring(px, { stiffness: 160, damping: 18 });
  const sy = useSpring(py, { stiffness: 160, damping: 18 });
  const rotateX = useTransform(sy, [0, 1], [9, -9]);
  const tiltY = useTransform(sx, [0, 1], [-12, 12]);
  const flip = useSpring(flipped ? 180 : 0, { stiffness: 140, damping: 20 });
  useEffect(() => {
    flip.set(flipped ? 180 : 0);
  }, [flipped, flip]);
  const rotateY = useTransform([tiltY, flip], ([t, f]) => t + f);
  const shineX = useTransform(sx, [0, 1], ["0%", "100%"]);
  const shineY = useTransform(sy, [0, 1], ["0%", "100%"]);
  const shine = useMotionTemplate`radial-gradient(circle at ${shineX} ${shineY}, rgb(255 255 255 / 0.28), transparent 45%)`;

  const canTilt = interactive && !reduce;
  function onMove(e) {
    if (!canTilt || e.pointerType === "touch") return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width);
    py.set((e.clientY - r.top) / r.height);
  }
  function onLeave() {
    px.set(0.5);
    py.set(0.5);
  }

  const face =
    variant === "night"
      ? "bg-[radial-gradient(120%_90%_at_100%_0%,#0b3d8f_0%,transparent_55%),linear-gradient(140deg,#030820_0%,#0a1640_55%,#011f60_100%)]"
      : "bg-[radial-gradient(90%_80%_at_100%_0%,rgb(2_169_252/0.85)_0%,transparent_60%),radial-gradient(70%_70%_at_0%_100%,rgb(59_43_184/0.55)_0%,transparent_60%),linear-gradient(140deg,#011f60_0%,#034eaa_55%,#0082fd_100%)]";

  return (
    <div className={cn("[container-type:inline-size] [perspective:1200px]", className)} onPointerMove={onMove} onPointerLeave={onLeave}>
      <motion.div
        className="relative aspect-[1.586/1] w-full [transform-style:preserve-3d]"
        style={{ rotateX: canTilt ? rotateX : 0, rotateY: canTilt ? rotateY : flip }}
      >
        {/* Recto */}
        <div
          className={cn(
            "absolute inset-0 flex flex-col justify-between overflow-hidden rounded-[6%/9.5%] p-[6.5%] text-white shadow-[0_30px_60px_-20px_rgb(1_31_96/0.7),inset_0_1px_0_rgb(255_255_255/0.25)] [backface-visibility:hidden]",
            face
          )}
        >
          <svg className="pointer-events-none absolute -right-[12%] -bottom-[28%] h-[110%] opacity-[0.13]" viewBox="0 0 100 100" aria-hidden="true">
            <path d="M50 4c4 32 14 42 46 46-32 4-42 14-46 46-4-32-14-42-46-46 32-4 42-14 46-46z" fill="#fff" />
          </svg>
          <motion.div className="pointer-events-none absolute inset-0" style={{ background: shine }} />
          <div className="relative flex items-start justify-between">
            <div className="flex items-center gap-[0.4em] text-[4.2cqw]">
              <LogoMark mono className="size-[1.9em]" />
              <span className="font-extrabold tracking-[-0.02em]">NovaPay</span>
            </div>
            <Nfc className="size-[7cqw] opacity-80" strokeWidth={1.6} />
          </div>
          <div className="relative">
            <Chip />
          </div>
          <div className="relative">
            <p className="font-mono text-[6.1cqw] leading-none font-medium tracking-[0.04em] whitespace-nowrap tabular [text-shadow:0_1px_2px_rgb(0_0_0/0.3)]">
              {maskNumber(number)}
            </p>
            <div className="mt-[5cqw] flex items-end justify-between gap-3 text-[3.6cqw]">
              <div className="min-w-0">
                <p className="text-[2.6cqw] font-medium text-white/60">Titulaire</p>
                <p className="truncate font-semibold tracking-wide uppercase">{name || "Prénom Nom"}</p>
              </div>
              <div className="shrink-0">
                <p className="text-[2.6cqw] font-medium text-white/60">Expire</p>
                <p className="font-mono font-medium">{expiry || "MM/AA"}</p>
              </div>
              <p className="shrink-0 text-[4.4cqw] font-extrabold tracking-tight italic">{brand || "VISA"}</p>
            </div>
          </div>
        </div>

        {/* Verso */}
        <div
          className={cn(
            "absolute inset-0 overflow-hidden rounded-[6%/9.5%] text-white shadow-[0_30px_60px_-20px_rgb(1_31_96/0.7)] [backface-visibility:hidden] [transform:rotateY(180deg)]",
            face
          )}
        >
          <div className="mt-[9%] h-[19%] bg-navy-950/90" />
          <div className="mx-[6.5%] mt-[7%] flex h-[16%] items-center justify-end rounded-[0.4rem] bg-[repeating-linear-gradient(135deg,#f7fbff_0_6px,#dbe7f8_6px_12px)] px-[4%]">
            <span className="rounded bg-white px-[2.4cqw] py-[0.6cqw] font-mono text-[5cqw] font-semibold text-navy tabular">
              {cvc ? cvc.replace(/./g, "•").slice(0, -1) + cvc.slice(-1) : "•••"}
            </span>
          </div>
          <p className="mx-[6.5%] mt-[5%] text-[2.6cqw] leading-snug text-white/60">
            Carte de démonstration NovaPay. Aucune donnée bancaire n'est transmise.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
