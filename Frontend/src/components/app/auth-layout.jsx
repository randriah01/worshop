import { motion } from "motion/react";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Ripple } from "@/components/magicui/ripple";
import { CreditCard } from "./credit-card";
import { Logo } from "./logo";

// Mise en page « carte scindée » des écrans d'authentification :
// visuel de marque à gauche (carte bancaire + ondes), formulaire à droite.
export function AuthLayout({ children, onBack, cardName = "", headline, text }) {
  return (
    <div className="relative flex min-h-dvh items-center overflow-hidden bg-navy-950 px-4 py-6 sm:py-10">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_15%_10%,rgb(3_78_170/0.55),transparent_70%),radial-gradient(50%_45%_at_90%_90%,rgb(59_43_184/0.35),transparent_70%)]" />
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative mx-auto grid w-full max-w-5xl overflow-hidden rounded-frame border border-white/10 bg-card shadow-[0_40px_80px_-30px_rgb(0_0_0/0.7)] lg:min-h-[640px] lg:grid-cols-[1.05fr_1fr]"
      >
        {/* Panneau de marque */}
        <div className="grain relative isolate flex flex-col overflow-hidden bg-brand p-6 text-white sm:p-8 lg:p-10">
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(70%_60%_at_100%_0%,rgb(2_169_252/0.55),transparent_65%),radial-gradient(60%_60%_at_0%_100%,rgb(59_43_184/0.6),transparent_65%)]" />
          <Ripple className="-z-10 [mask-image:radial-gradient(circle_at_center,black,transparent_75%)]" mainCircleSize={180} numCircles={7} mainCircleOpacity={0.22} />

          <div className="flex items-center justify-between">
            <Logo onDark />
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/85 backdrop-blur-sm transition hover:bg-white/10"
              >
                <ArrowLeft className="size-3.5" /> Accueil
              </button>
            )}
          </div>

          <div className="hidden flex-1 items-center justify-center py-8 lg:flex">
            <motion.div
              initial={{ opacity: 0, rotate: -8, y: 24 }}
              animate={{ opacity: 1, rotate: -6, y: 0 }}
              transition={{ duration: 0.9, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-[22rem]"
            >
              <CreditCard variant="night" name={cardName} number="4970 1024 8812 2026" expiry="12/29" />
            </motion.div>
          </div>

          <div className="mt-6 lg:mt-0">
            <h2 className="max-w-sm text-2xl leading-tight font-bold tracking-[-0.03em] text-balance sm:text-[1.9rem]">{headline}</h2>
            <p className="mt-2 hidden max-w-sm text-sm text-white/70 sm:block">{text}</p>
            <p className="mt-5 hidden items-center gap-2 text-xs font-medium text-white/60 lg:flex">
              <ShieldCheck className="size-4" /> Connexion chiffrée, session limitée dans le temps
            </p>
          </div>
        </div>

        {/* Formulaire */}
        <div className="flex items-center justify-center p-6 sm:p-10 lg:p-12">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </motion.div>
    </div>
  );
}

export function FormError({ children }) {
  if (!children) return null;
  return (
    <motion.p
      role="alert"
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-control border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
    >
      {children}
    </motion.p>
  );
}
