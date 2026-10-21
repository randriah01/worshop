import { useEffect, useState } from "react";
import { getToken, clearToken, getMe } from "./api";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Security from "./pages/Security";
import Resilience from "./pages/Resilience";
import Admin from "./pages/Admin";
import { Spinner } from "./components/ui";

const NAV = [
  { key: "dashboard", label: "Tableau de bord", icon: GridIcon, page: Dashboard },
  { key: "transactions", label: "Transactions", icon: CardIcon, page: Transactions },
  { key: "security", label: "Cybersécurité", icon: ShieldIcon, page: Security },
  { key: "resilience", label: "Cyber-résilience", icon: PulseIcon, page: Resilience },
  { key: "admin", label: "Administration", icon: UsersIcon, page: Admin, admin: true },
];

function readTheme() {
  try {
    return localStorage.getItem("novapay_theme") || "dark";
  } catch {
    return "dark";
  }
}

export default function App() {
  const [authed, setAuthed] = useState(Boolean(getToken()));
  const [authMode, setAuthMode] = useState("login");
  const [me, setMe] = useState(null);
  const [active, setActive] = useState("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState(readTheme());

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
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

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  if (!authed) {
    return authMode === "login" ? (
      <Login
        onSuccess={() => setAuthed(true)}
        onRegister={() => setAuthMode("register")}
      />
    ) : (
      <Register
        onSuccess={() => setAuthed(true)}
        onLogin={() => setAuthMode("login")}
      />
    );
  }

  if (!me) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
        <Spinner />
      </div>
    );
  }

  const nav = NAV.filter((n) => !n.admin || me.role === "admin");
  const current = nav.find((n) => n.key === active) || nav[0];
  const PageComponent = current.page;

  function logout() {
    clearToken();
    setAuthed(false);
    setActive("dashboard");
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-[var(--border)] bg-[var(--panel)] p-4 lg:flex">
        <Brand me={me} />
        <nav className="mt-6 flex-1 space-y-1">
          {nav.map((n) => (
            <NavButton key={n.key} item={n} active={active === n.key} onClick={() => setActive(n.key)} />
          ))}
        </nav>
        <ThemeButton theme={theme} onClick={toggleTheme} />
        <LogoutButton onClick={logout} />
      </aside>

      <header className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--panel)] px-4 py-3 lg:hidden">
        <Brand me={me} />
        <div className="flex items-center gap-2">
          <ThemeButton theme={theme} onClick={toggleTheme} compact />
          <button onClick={() => setMobileOpen((v) => !v)} className="rounded-lg border border-[var(--border)] p-2 text-[var(--text-muted)]" aria-label="Menu">
            <MenuIcon />
          </button>
        </div>
      </header>
      {mobileOpen && (
        <div className="border-b border-[var(--border)] bg-[var(--panel)] p-3 lg:hidden">
          {nav.map((n) => (
            <NavButton
              key={n.key}
              item={n}
              active={active === n.key}
              onClick={() => {
                setActive(n.key);
                setMobileOpen(false);
              }}
            />
          ))}
          <LogoutButton onClick={logout} />
        </div>
      )}

      <main className="lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <PageComponent me={me} />
        </div>
      </main>
    </div>
  );
}

function Brand({ me }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-600 font-bold text-white">N</span>
      <div className="leading-tight">
        <p className="font-semibold text-[var(--text)]">NovaPay</p>
        <p className="text-[11px] text-[var(--text-faint)]">
          {me ? me.shop_name : "Resilience-Alpha"}
        </p>
      </div>
    </div>
  );
}

function NavButton({ item, active, onClick }) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      className={
        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition " +
        (active ? "bg-blue-600/15 text-blue-500" : "text-[var(--text-muted)] hover:bg-[var(--panel-2)] hover:text-[var(--text)]")
      }
    >
      <Icon />
      {item.label}
    </button>
  );
}

function ThemeButton({ theme, onClick, compact }) {
  const dark = theme === "dark";
  if (compact) {
    return (
      <button onClick={onClick} className="rounded-lg border border-[var(--border)] p-2 text-[var(--text-muted)]" aria-label="Changer de thème">
        {dark ? <SunIcon /> : <MoonIcon />}
      </button>
    );
  }
  return (
    <button onClick={onClick} className="mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--text-muted)] transition hover:bg-[var(--panel-2)] hover:text-[var(--text)]">
      {dark ? <SunIcon /> : <MoonIcon />}
      {dark ? "Mode clair" : "Mode sombre"}
    </button>
  );
}

function LogoutButton({ onClick }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--text-muted)] transition hover:bg-[var(--panel-2)] hover:text-[var(--text)]">
      <LogoutIcon />
      Déconnexion
    </button>
  );
}

function GridIcon() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>);
}
function CardIcon() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>);
}
function ShieldIcon() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" /></svg>);
}
function PulseIcon() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h4l2 6 4-14 2 8h6" /></svg>);
}
function UsersIcon() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>);
}
function MenuIcon() {
  return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18" /></svg>);
}
function LogoutIcon() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>);
}
function SunIcon() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>);
}
function MoonIcon() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>);
}
