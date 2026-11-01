import { useState } from "react";
import { motion } from "motion/react";
import { LogOut, Menu, ChevronsUpDown, Moon, Sun } from "lucide-react";
import { Logo } from "./logo";
import { Sheet } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { AnimatedThemeToggler } from "@/components/magicui/animated-theme-toggler";
import { cn } from "@/lib/utils";

// Barre latérale toujours en bleu nuit (signature de marque, dans les deux thèmes).
function SidebarContent({ nav, active, onNavigate, me, onLogout, theme, onThemeChange, layoutKey }) {
  return (
    <div className="grain relative flex h-full flex-col overflow-hidden bg-navy-950 px-4 py-5 text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_40%_at_0%_0%,rgb(3_78_170/0.45),transparent_70%),radial-gradient(80%_35%_at_100%_100%,rgb(59_43_184/0.3),transparent_70%)]" />
      <div className="relative px-2">
        <Logo onDark subtitle="Plateforme cyber-résiliente" />
      </div>

      <nav className="relative mt-9 flex-1 space-y-1" aria-label="Navigation principale">
        {nav.map((n) => {
          const isActive = active === n.key;
          return (
            <button
              key={n.key}
              onClick={() => onNavigate(n.key)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex w-full cursor-pointer items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium transition-colors",
                isActive ? "text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
              )}
            >
              {isActive && (
                <motion.span
                  layoutId={`nav-active-${layoutKey}`}
                  className="absolute inset-0 rounded-control bg-[linear-gradient(100deg,rgb(0_130_253/0.35),rgb(2_169_252/0.12))] shadow-[inset_0_0_0_1px_rgb(2_169_252/0.35)]"
                  transition={{ type: "spring", stiffness: 420, damping: 36 }}
                />
              )}
              <n.icon className={cn("relative size-[18px]", isActive && "text-sky")} aria-hidden="true" />
              <span className="relative">{n.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="relative">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-2.5 text-left transition hover:bg-white/[0.08]">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand text-sm font-bold">
                {(me?.shop_name || "?").slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{me?.shop_name}</span>
                <span className="block truncate text-xs text-white/50">
                  {me?.role === "admin" ? "Administrateur" : "Compte marchand"}
                </span>
              </span>
              <ChevronsUpDown className="size-4 text-white/40" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
            <DropdownMenuLabel>
              <p className="truncate text-sm font-semibold">{me?.shop_name}</p>
              <p className="truncate text-xs text-muted-foreground">@{me?.login || "marchand"}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onThemeChange(theme === "dark" ? "light" : "dark", true)}>
              {theme === "dark" ? <Sun /> : <Moon />}
              {theme === "dark" ? "Mode clair" : "Mode sombre"}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onLogout} className="text-destructive data-[highlighted]:text-destructive [&_svg]:text-destructive">
              <LogOut /> Déconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export function AppShell({ nav, active, onNavigate, me, onLogout, theme, onThemeChange, children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const current = nav.find((n) => n.key === active);
  const shared = { nav, active, me, onLogout, theme, onThemeChange };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[17rem] lg:block">
        <SidebarContent {...shared} onNavigate={onNavigate} layoutKey="desktop" />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen} title="Navigation">
        <SidebarContent
          {...shared}
          layoutKey="mobile"
          onNavigate={(k) => {
            onNavigate(k);
            setMobileOpen(false);
          }}
        />
      </Sheet>

      <div className="lg:pl-[17rem]">
        <header className="sticky top-0 z-20 border-b border-border/70 bg-background/80 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              onClick={() => setMobileOpen(true)}
              className="grid size-10 cursor-pointer place-items-center rounded-control border border-border text-muted-foreground transition hover:bg-muted lg:hidden"
              aria-label="Ouvrir le menu"
            >
              <Menu className="size-5" />
            </button>
            <div className="lg:hidden">
              <Logo markClassName="size-8" />
            </div>
            <p className="hidden text-sm text-muted-foreground lg:block">
              <span className="text-subtle-foreground">NovaPay</span>
              <span className="mx-2 text-border">/</span>
              <span className="font-semibold text-foreground">{current?.label}</span>
            </p>
            <div className="ml-auto flex items-center gap-2">
              <span className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground sm:inline-flex">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60 motion-reduce:hidden" />
                  <span className="relative inline-flex size-2 rounded-full bg-success" />
                </span>
                Démo, paiements simulés
              </span>
              <AnimatedThemeToggler
                theme={theme}
                onThemeChange={onThemeChange}
                className="grid size-10 place-items-center rounded-control border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground"
              />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
