// Page d'accueil publique (avant la connexion). Purement présentationnelle :
// aucun appel API, elle mène vers la connexion ou l'inscription.
import { motion } from "motion/react";
import {
  CreditCard as CardIcon,
  Radar,
  RotateCcw,
  ShieldCheck,
  Gauge,
  BrainCircuit,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  Activity,
  LogIn,
} from "lucide-react";
import { Logo } from "@/components/app/logo";
import { CreditCard } from "@/components/app/credit-card";
import { Button } from "@/components/ui/button";
import { ShimmerButton } from "@/components/magicui/shimmer-button";
import { Ripple } from "@/components/magicui/ripple";
import { WordRotate } from "@/components/magicui/word-rotate";
import { AnimatedList } from "@/components/magicui/animated-list";
import { DotPattern } from "@/components/magicui/dot-pattern";

const EVENTS = [
  { icon: CheckCircle2, tone: "text-[#2fd29a]", title: "Paiement accepté", meta: "Le Fournil · 24,90 €" },
  { icon: CheckCircle2, tone: "text-[#2fd29a]", title: "Paiement accepté", meta: "Café des Arts · 7,40 €" },
  { icon: AlertTriangle, tone: "text-[#f5b33f]", title: "Pic de trafic anormal", meta: "Détecté par le modèle d'IA" },
  { icon: Activity, tone: "text-sky", title: "Remédiation lancée", meta: "Redémarrage de payment-api" },
  { icon: ShieldCheck, tone: "text-[#2fd29a]", title: "Service rétabli", meta: "Santé vérifiée en 14 s" },
];

const STEPS = [
  {
    icon: CardIcon,
    title: "Encaisser",
    text: "Vos clients paient par carte. Chaque paiement porte une clé unique : un renvoi ne débite jamais deux fois.",
  },
  {
    icon: Radar,
    title: "Détecter",
    text: "Un modèle d'IA surveille le trafic en continu et ouvre un incident dès qu'un comportement sort de la normale.",
  },
  {
    icon: RotateCcw,
    title: "Rétablir",
    text: "Le moteur de remédiation applique la bonne action, puis vérifie que le service répond avant de clôturer.",
  },
];

const GUARDS = [
  { icon: Gauge, title: "Pare-feu applicatif", text: "Limitation de débit et filtrage des requêtes avant qu'elles n'atteignent l'API." },
  { icon: BrainCircuit, title: "Détection par IA", text: "Isolation Forest entraîné sur le trafic normal de NovaPay." },
  { icon: KeyRound, title: "Idempotence", text: "Les nouvelles tentatives automatiques sont sûres, sans doublon." },
];

const ease = [0.16, 1, 0.3, 1];

export default function Landing({ onLogin, onRegister }) {
  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-navy-950 p-3 text-white sm:p-5">
      {/* Fond : halos de marque, comme les dégradés des références */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(55%_45%_at_0%_0%,rgb(3_78_170/0.6),transparent_70%),radial-gradient(45%_40%_at_100%_100%,rgb(59_43_184/0.45),transparent_70%),radial-gradient(35%_30%_at_100%_0%,rgb(2_169_252/0.25),transparent_70%)]"
      />

      <div className="grain relative mx-auto max-w-7xl overflow-hidden rounded-frame border border-white/10 bg-navy-900/90 shadow-[0_40px_120px_-40px_rgb(0_0_0/0.8)]">
        <DotPattern className="text-white/[0.06] [mask-image:radial-gradient(80%_60%_at_70%_30%,black,transparent)]" />

        {/* Navigation */}
        <header className="relative z-10 flex items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:px-12">
          <Logo onDark />
          <nav className="hidden items-center gap-8 text-sm font-medium text-white/70 md:flex" aria-label="Sections">
            <a href="#fonctionnement" className="transition hover:text-white">Fonctionnement</a>
            <a href="#securite" className="transition hover:text-white">Sécurité</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="glass" size="sm" onClick={onLogin} className="h-9 px-3.5">
              <LogIn /> Se connecter
            </Button>
            <Button variant="light" size="sm" onClick={onRegister} className="hidden h-9 px-3.5 sm:inline-flex">
              Créer un compte
            </Button>
          </div>
        </header>

        {/* Hero */}
        <section className="relative z-10 grid items-center gap-10 px-5 pt-6 pb-14 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-6 lg:px-12 lg:pt-10 lg:pb-20">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease }}
              className="text-[2.6rem] leading-[1.02] font-extrabold tracking-[-0.045em] sm:text-6xl lg:text-[4.4rem]"
            >
              Des paiements
              <br />
              <WordRotate words={["encaissés.", "surveillés.", "protégés.", "rétablis."]} />
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1, ease }}
              className="mt-6 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg"
            >
              NovaPay encaisse les paiements de vos commerçants, repère une attaque en quelques secondes et remet le
              service en route sans intervention humaine.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease }}
              className="mt-9 flex flex-wrap items-center gap-3"
            >
              <ShimmerButton onClick={onRegister} className="h-12 px-6">
                Ouvrir un compte marchand
              </ShimmerButton>
              <Button variant="glass" size="lg" onClick={onLogin}>
                J'ai déjà un compte
              </Button>
            </motion.div>
            <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/65">
              {["Détection en continu", "Reprise vérifiée", "Aucun double débit"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-sky" aria-hidden="true" /> {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Visuel signature : carte bancaire + ondes + flux d'événements en direct.
              Mobile : le flux passe sous la carte. Grand écran : il chevauche le coin bas. */}
          <div className="relative mx-auto w-full max-w-[540px]">
            <div className="relative flex min-h-[300px] items-center justify-center sm:min-h-[360px] lg:min-h-[420px] lg:items-start lg:justify-start lg:pt-6">
              <Ripple
                mainCircleSize={220}
                numCircles={7}
                color="rgb(2 169 252)"
                mainCircleOpacity={0.3}
                className="[mask-image:radial-gradient(circle_at_center,black_30%,transparent_75%)]"
              />
              <motion.div
                initial={{ opacity: 0, y: 30, rotate: -14 }}
                animate={{ opacity: 1, y: 0, rotate: -7 }}
                transition={{ duration: 1, delay: 0.2, ease }}
                className="relative w-[86%] max-w-[400px] lg:ml-2"
              >
                <CreditCard name="Le Fournil de Paris" number="4970 1024 8812 2026" expiry="12/29" />
              </motion.div>
            </div>

            <div className="relative mx-auto -mt-4 h-[13.5rem] w-full max-w-[20rem] overflow-hidden [mask-image:linear-gradient(to_bottom,black_70%,transparent)] lg:absolute lg:right-[-1.5rem] lg:bottom-[-3rem] lg:mt-0 lg:w-[18.5rem]">
              <AnimatedList delay={1600}>
                {EVENTS.map((e, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-navy-800/90 px-3.5 py-2.5 shadow-[0_16px_40px_-16px_rgb(0_0_0/0.8)] backdrop-blur-md"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/5">
                      <e.icon className={"size-4 " + e.tone} aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{e.title}</p>
                      <p className="truncate text-xs text-white/55">{e.meta}</p>
                    </div>
                  </div>
                ))}
              </AnimatedList>
            </div>
          </div>
        </section>

        {/* Fonctionnement : vraie séquence en 3 étapes */}
        <section id="fonctionnement" className="relative z-10 scroll-mt-6 border-t border-white/10 px-5 py-14 sm:px-8 lg:px-12 lg:py-20">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-[-0.035em] sm:text-4xl">Un cycle qui se répare tout seul</h2>
            <p className="mt-3 text-white/65">
              Du paiement à la reprise, chaque étape est automatique et tracée dans votre tableau de bord.
            </p>
          </div>
          <ol className="relative mt-12 grid gap-4 md:grid-cols-3">
            <div aria-hidden="true" className="absolute top-7 right-[16%] left-[16%] hidden h-px bg-gradient-to-r from-royal via-electric to-sky md:block" />
            {STEPS.map((s, i) => (
              <motion.li
                key={s.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.6, delay: i * 0.12, ease }}
                className="relative rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-6"
              >
                <div className="flex items-center gap-3">
                  <span className="relative grid size-14 place-items-center rounded-2xl bg-brand shadow-[0_12px_30px_-10px_rgb(0_130_253/0.8)]">
                    <s.icon className="size-6" aria-hidden="true" />
                  </span>
                  <span className="font-mono text-sm text-white/40">Étape {i + 1}</span>
                </div>
                <h3 className="mt-5 text-xl font-bold tracking-tight">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/65">{s.text}</p>
              </motion.li>
            ))}
          </ol>
        </section>

        {/* Sécurité */}
        <section id="securite" className="relative z-10 scroll-mt-6 px-5 pb-14 sm:px-8 lg:px-12 lg:pb-20">
          <div className="grid gap-8 overflow-hidden rounded-[1.75rem] bg-brand p-7 sm:p-10 lg:grid-cols-[1fr_1.4fr] lg:items-center">
            <div>
              <h2 className="text-3xl font-bold tracking-[-0.035em] sm:text-4xl">Trois défenses, une seule plateforme</h2>
              <p className="mt-3 max-w-md text-white/75">
                Filtrer, détecter, rejouer sans risque : NovaPay combine les trois pour garder vos encaissements
                disponibles.
              </p>
              <Button variant="light" size="lg" onClick={onLogin} className="mt-7">
                Accéder au tableau de bord
              </Button>
            </div>
            <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {GUARDS.map((g) => (
                <li key={g.title} className="rounded-2xl border border-white/15 bg-navy-950/25 p-5 backdrop-blur-sm">
                  <g.icon className="size-5 text-white" aria-hidden="true" />
                  <p className="mt-4 font-semibold">{g.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-white/70">{g.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <footer className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-6 text-xs text-white/45 sm:px-8 lg:px-12">
          <p>Projet Resilience-Alpha, workshop EPSI 2026.</p>
          <p>Environnement de démonstration : aucun paiement réel n'est effectué.</p>
        </footer>
      </div>
    </div>
  );
}
