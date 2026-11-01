import { lazy, Suspense, useEffect, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { LayoutGrid, CreditCard, ShieldAlert, Activity, Users } from "lucide-react";
import { getToken, clearToken, getMe } from "./api";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import { AppShell } from "@/components/app/app-shell";
import { PageSkeleton } from "@/components/app/states";
import { LogoMark } from "@/components/app/logo";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

// Pages de l'espace connecté chargées à la demande (bundle initial plus léger).
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Transactions = lazy(() => import("./pages/Transactions"));
const Security = lazy(() => import("./pages/Security"));
const Resilience = lazy(() => import("./pages/Resilience"));
const Admin = lazy(() => import("./pages/Admin"));

const NAV = [
  { key: "dashboard", label: "Tableau de bord", icon: LayoutGrid, page: Dashboard },
  { key: "transactions", label: "Transactions", icon: CreditCard, page: Transactions },
  { key: "security", label: "Cybersécurité", icon: ShieldAlert, page: Security },
  { key: "resilience", label: "Cyber-résilience", icon: Activity, page: Resilience },
  { key: "admin", label: "Administration", icon: Users, page: Admin, admin: true },
];

function readTheme() {
  try {
    return localStorage.getItem("novapay_theme") || "dark";
  } catch {
    return "dark";
  }
}

function applyThemeClass(theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.setAttribute("data-theme", theme);
}

export default function App() {
  const [authed, setAuthed] = useState(Boolean(getToken()));
  const [authMode, setAuthMode] = useState("landing"); // landing | login | register
  const [me, setMe] = useState(null);
  const [active, setActive] = useState("dashboard");
  const [theme, setTheme] = useState(readTheme());

  useEffect(() => {
    applyThemeClass(theme);
    try {
      localStorage.setItem("novapay_theme", theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  // Charge le profil après authentification.
  useEffect(() => {
    if (!authed) {
      setMe(null);
      return;
    }
    getMe()
      .then(setMe)
      .catch(() => {
        clearToken();
        setAuthed(false);
      });
  }, [authed]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [active, authMode, authed]);

  function changeTheme(next) {
    setTheme(next);
  }

  function logout() {
    clearToken();
    setAuthed(false);
    setActive("dashboard");
    setAuthMode("login");
  }

  let screen;
  if (!authed) {
    screen =
      authMode === "landing" ? (
        <Landing key="landing" onLogin={() => setAuthMode("login")} onRegister={() => setAuthMode("register")} />
      ) : authMode === "login" ? (
        <Login
          key="login"
          onSuccess={() => setAuthed(true)}
          onRegister={() => setAuthMode("register")}
          onBack={() => setAuthMode("landing")}
        />
      ) : (
        <Register
          key="register"
          onSuccess={() => setAuthed(true)}
          onLogin={() => setAuthMode("login")}
          onBack={() => setAuthMode("landing")}
        />
      );
  } else if (!me) {
    screen = (
      <div key="boot" className="grid min-h-dvh place-items-center bg-navy-950">
        <motion.div animate={{ scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }} transition={{ repeat: Infinity, duration: 1.6 }}>
          <LogoMark className="size-14" />
        </motion.div>
      </div>
    );
  } else {
    const nav = NAV.filter((n) => !n.admin || me.role === "admin");
    const current = nav.find((n) => n.key === active) || nav[0];
    const PageComponent = current.page;
    screen = (
      <AppShell key="app" nav={nav} active={current.key} onNavigate={setActive} me={me} onLogout={logout} theme={theme} onThemeChange={changeTheme}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={current.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <Suspense fallback={<PageSkeleton />}>
              <PageComponent me={me} />
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
          <motion.div key={authed ? "in" : authMode} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            {screen}
          </motion.div>
        </AnimatePresence>
        <Toaster theme={theme} />
      </TooltipProvider>
    </MotionConfig>
  );
}
