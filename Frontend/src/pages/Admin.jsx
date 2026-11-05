import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Users, ArrowLeftRight, Wallet, ChevronDown, Shield } from "lucide-react";
import { getAdminUsers } from "../api";
import { euros, dateFr } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import { ErrorNote, PageSkeleton } from "@/components/app/states";
import { cn } from "@/lib/utils";

const fmtEuros = (n) => euros(Math.round(n));

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setUsers(await getAdminUsers());
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  if (loading && users.length === 0) return <PageSkeleton />;
  if (error) return <ErrorNote>{error}</ErrorNote>;

  const totalTx = users.reduce((s, u) => s + u.transactions.length, 0);
  const totalVolume = users.reduce(
    (s, u) => s + u.transactions.filter((t) => t.status === "validated").reduce((a, t) => a + t.amount_cents, 0),
    0
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Administration" subtitle="Tous les comptes et leurs transactions" onRefresh={load} refreshing={loading} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Comptes" value={users.length} icon={Users} />
        <StatCard label="Transactions" value={totalTx} icon={ArrowLeftRight} />
        <StatCard label="Volume total" value={totalVolume} format={fmtEuros} icon={Wallet} />
      </div>

      <div className="space-y-3">
        {users.map((u) => {
          const vol = u.transactions.filter((t) => t.status === "validated").reduce((a, t) => a + t.amount_cents, 0);
          const isOpen = open === u.merchant_id;
          return (
            <Card key={u.merchant_id} className={cn("overflow-hidden transition-colors", isOpen && "border-input")}>
              <button
                onClick={() => setOpen(isOpen ? null : u.merchant_id)}
                aria-expanded={isOpen}
                className="flex w-full cursor-pointer flex-wrap items-center gap-4 p-4 text-left transition hover:bg-muted/50 sm:p-5"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand text-base font-bold text-white">
                  {u.shop_name.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
                    <span className="truncate">{u.shop_name}</span>
                    {u.role === "admin" && (
                      <Badge tone="violet">
                        <Shield /> admin
                      </Badge>
                    )}
                  </p>
                  <p className="font-mono text-xs text-subtle-foreground">@{u.login}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-semibold text-foreground tabular">{euros(u.balance_cents)}</p>
                  <p className="text-xs text-subtle-foreground">{u.transactions.length} transaction(s)</p>
                </div>
                <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.25 }} className="text-subtle-foreground">
                  <ChevronDown className="size-5" aria-hidden="true" />
                </motion.span>
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-border px-4 pt-4 pb-5 sm:px-5">
                      <div className="mb-3 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                        <span>
                          Volume encaissé : <span className="font-semibold text-foreground">{euros(vol)}</span>
                        </span>
                        <span>Inscrit le {dateFr(u.created_at)}</span>
                      </div>
                      {u.transactions.length === 0 ? (
                        <p className="py-4 text-center text-sm text-subtle-foreground">Aucune transaction.</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              <TableHead>Identifiant</TableHead>
                              <TableHead className="text-right">Montant</TableHead>
                              <TableHead>Statut</TableHead>
                              <TableHead>Date</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {u.transactions.slice(0, 15).map((t) => (
                              <TableRow key={t.id}>
                                <TableCell className="font-mono text-subtle-foreground">#{t.id}</TableCell>
                                <TableCell className="text-right font-mono font-semibold text-foreground tabular">{euros(t.amount_cents)}</TableCell>
                                <TableCell><StatusBadge status={t.status} /></TableCell>
                                <TableCell className="text-muted-foreground">{dateFr(t.created_at)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
