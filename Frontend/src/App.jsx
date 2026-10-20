import { useState } from "react";
import { getToken, clearToken } from "./api";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Security from "./pages/Security";
import Resilience from "./pages/Resilience";

const NAV = [
  { key: "dashboard", label: "Tableau de bord", icon: GridIcon, page: Dashboard },
  { key: "transactions", label: "Transactions", icon: CardIcon, page: Transactions },
  { key: "security", label: "Cybersécurité", icon: ShieldIcon, page: Security },
  { key: "resilience", label: "Cyber-résilience", icon: PulseIcon, page: Resilience },
];

export default function App() {
  const [authed, setAuthed] = useState(Boolean(getToken()));
  const [active, setActive] = useState("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!authed) {
    return <Login onSuccess={() => setAuthed(true)} />;
  }

  const current = NAV.find((n) => n.key === active) || NAV[0];
  const PageComponent = current.page;

  function logout() {
    clearToken();
    setAuthed(false);
  }

  return (
    <div className="min-h-screen bg-[#0a0f1f] text-slate-100">
      {/* Barre latérale (desktop) */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-slate-800 bg-slate-950/70 p-4 lg:flex">
        <Brand />
        <nav className="mt-6 flex-1 space-y-1">
          {NAV.map((n) => (
            <NavButton
              key={n.key}
              item={n}
              active={active === n.key}
              onClick={() => setActive(n.key)}
            />
          ))}
        </nav>
        <LogoutButton onClick={logout} />
      </aside>

      {/* En-tête mobile */}
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-950/70 px-4 py-3 lg:hidden">
        <Brand />
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-lg border border-slate-700 p-2 text-slate-300"
          aria-label="Menu"
        >
          <MenuIcon />
        </button>
      </header>
      {mobileOpen && (
        <div className="border-b border-slate-800 bg-slate-950/90 p-3 lg:hidden">
          {NAV.map((n) => (
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

      {/* Contenu */}
      <main className="lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <PageComponent />
        </div>
      </main>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-600 font-bold text-white">
        N
      </span>
      <div className="leading-tight">
        <p className="font-semibold text-white">NovaPay</p>
        <p className="text-[11px] text-slate-500">Resilience-Alpha</p>
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
        (active
          ? "bg-blue-600/15 text-blue-300"
          : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200")
      }
    >
      <Icon />
      {item.label}
    </button>
  );
}

function LogoutButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-400 transition hover:bg-slate-800/60 hover:text-slate-200"
    >
      <LogoutIcon />
      Déconnexion
    </button>
  );
}

/* --- Icônes (SVG inline, sans dépendance) --- */
function GridIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}
function CardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
    </svg>
  );
}
function PulseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 12h4l2 6 4-14 2 8h6" />
    </svg>
  );
}
function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}
function LogoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}
