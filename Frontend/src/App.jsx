import { lazy, Suspense, useEffect, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { LayoutGrid, CreditCard, ShieldAlert, ScanFace, Activity, Users } from "lucide-react";
import {
  getToken, clearToken, getMe,
  getSetupToken, getSetupLogin, clearSetupSession,
} from "./api";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import FaceSetup from "./pages/FaceSetup";
import { AppShell } from "@/components/app/app-shell";
import { PageSkeleton } from "@/components/app/states";
import { LogoMark } from "@/components/app/logo";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Transactions = lazy(() => import("./pages/Transactions"));
const Security = lazy(() => import("./pages/Security"));
const Resilience = lazy(() => import("./pages/Resilience"));
const Admin = lazy(() => import("./pages/Admin"));

const NAV = [
  { key: "dashboard", label: "Tableau de bord", icon: LayoutGrid, page: Dashboard },
  { key: "transactions", label: "Transactions", icon: CreditCard, page: Transactions },
  { key: "security", label: "Cybersécurité", icon: ShieldAlert, page: Security },
  { key: "face", label: "Connexion faciale", icon: ScanFace, page: FaceSetup },
  { key: "resilience", label: "Cyber-résilience", icon: Activity, page: Resilience },
  { key: "admin", label: "Administration", icon: Users, page: Admin, admin: true },
];

function readTheme() {
  try { return localStorage.getItem("novapay_theme") || "dark"; }
  catch { return "dark"; }
}

function applyThemeClass(theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.setAttribute("data-theme", theme);
}

export default function App() {
  const [authed, setAuthed] = useState(Boolean(getToken()));
  const [setupPending, setSetupPending] = useState(Boolean(getSetupToken()));
  const [authMode, setAuthMode] = useState("landing");
  const [me, setMe] = useState(null);
  const [profileError, setProfileError] = useState("");
  const [profileRetry, setProfileRetry] = useState(0);
  const [active, setActive] = useState("dashboard");
  const [theme, setTheme] = useState(readTheme());

  useEffect(() => {
    applyThemeClass(theme);
    try { localStorage.setItem("novapay_theme", theme); } catch { /* mode privé */ }
  }, [theme]);

  // Une indisponibilité /api/me ne doit pas effacer un JWT valide ; seul HTTP 401 le fait.
  useEffect(() => {
    let cancelled = false;
    if (!authed) {
      setMe(null);
      setProfileError("");
      return;
    }
    setProfileError("");
    getMe()
      .then((profile) => { if (!cancelled) setMe(profile); })
      .catch((err) => {
        if (cancelled) return;
        setMe(null);
        if (err?.status === 401) {
          clearToken();
          setAuthed(false);
          setAuthMode("login");
        } else {
          setProfileError(err?.message || "Impossible de charger le profil commerçant.");
        }
      });
    return () => { cancelled = true; };
  }, [authed, profileRetry]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [active, authMode, authed, setupPending]);

  function logout() {
    clearToken();
    clearSetupSession();
    setAuthed(false);
    setSetupPending(false);
    setMe(null);
    setActive("dashboard");
    setAuthMode("login");
  }

  function finishEnrollment() {
    clearSetupSession();
    setSetupPending(false);
    setAuthMode("login");
  }

  let screen;
  if (!authed && setupPending) {
    screen = (
      <div key="setup" className="min-h-dvh bg-background px-5 py-10 text-foreground">
        <div className="mx-auto max-w-xl">
          <FaceSetup
            mode="setup"
            me={{ login: getSetupLogin() }}
            onComplete={finishEnrollment}
            onLogout={finishEnrollment}
          />
        </div>
      </div>
    );
  } else if (!authed) {
    screen = authMode === "landing" ? (
      <Landing key="landing" onLogin={() => setAuthMode("login")} onRegister={() => setAuthMode("register")} />
    ) : authMode === "login" ? (
      <Login
        key="login"
        onSuccess={() => { setActive("dashboard"); setAuthed(true); }}
        onNeedsSetup={() => setSetupPending(true)}
        onRegister={() => setAuthMode("register")}
        onBack={() => setAuthMode("landing")}
      />
    ) : (
      <Register
        key="register"
        onSuccess={(result) => {
          if (result?.requires_enrollment) {
            setSetupPending(true);
          } else {
            setAuthMode("login");
          }
        }}
        onLogin={() => setAuthMode("login")}
        onBack={() => setAuthMode("landing")}
      />
    );
  } else if (!me) {
    screen = (
      <div key="boot" className="grid min-h-dvh place-items-center bg-background px-5 text-foreground">
        {profileError ? (
          <div role="alert" className="w-full max-w-lg space-y-4 rounded-card border border-border bg-card p-6">
            <h1 className="text-lg font-semibold">Profil NovaPay indisponible</h1>
            <p className="text-sm text-muted-foreground">L’API /api/me n'a pas répondu correctement. Votre session est conservée.</p>
            <p className="rounded-control border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{profileError}</p>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => setProfileRetry((n) => n + 1)} className="rounded-control bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Réessayer</button>
              <button type="button" onClick={logout} className="rounded-control border border-border px-4 py-2 text-sm">Se déconnecter</button>
            </div>
          </div>
        ) : (
          <motion.div animate={{ scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }} transition={{ repeat: Infinity, duration: 1.6 }}>
            <LogoMark className="size-14" />
          </motion.div>
        )}
      </div>
    );
  } else {
    const nav = NAV.filter((item) => !item.admin || me.role === "admin");
    const current = nav.find((item) => item.key === active) || nav[0];
    const PageComponent = current.page;
    screen = (
      <AppShell key="app" nav={nav} active={current.key} onNavigate={setActive} me={me} onLogout={logout} theme={theme} onThemeChange={setTheme}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={current.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <Suspense fallback={<PageSkeleton />}>
              <PageComponent me={me} onContinue={() => setActive("dashboard")} onLogout={logout} />
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </AppShell>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider delayDuration={200}>
        <AnimatePresence mode="wait">
          <motion.div key={!authed && setupPending ? "setup" : authed ? "in" : authMode} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            {screen}
          </motion.div>
        </AnimatePresence>
        <Toaster theme={theme} />
      </TooltipProvider>
    </MotionConfig>
  );
}
