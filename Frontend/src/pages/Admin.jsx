import { useEffect, useState } from "react";
import { getAdminUsers } from "../api";
import { Card, StatCard, StatusBadge, Spinner, ErrorNote, euros, dateFr } from "../components/ui";
import { Header } from "./Dashboard";

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

  if (loading) return <Spinner />;
  if (error) return <ErrorNote>{error}</ErrorNote>;

  const totalTx = users.reduce((s, u) => s + u.transactions.length, 0);
  const totalVolume = users.reduce(
    (s, u) => s + u.transactions.filter((t) => t.status === "validated").reduce((a, t) => a + t.amount_cents, 0),
    0
  );

  return (
    <div className="space-y-6">
      <Header title="Administration" subtitle="Tous les comptes et leurs transactions" onRefresh={load} />

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Comptes" value={users.length} />
        <StatCard label="Transactions" value={totalTx} />
        <StatCard label="Volume total" value={euros(totalVolume)} />
      </div>

      <div className="space-y-3">
        {users.map((u) => {
          const vol = u.transactions
            .filter((t) => t.status === "validated")
            .reduce((a, t) => a + t.amount_cents, 0);
          const isOpen = open === u.merchant_id;
          return (
            <Card key={u.merchant_id}>
              <button
                onClick={() => setOpen(isOpen ? null : u.merchant_id)}
                className="flex w-full flex-wrap items-center gap-3 text-left"
              >
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-600/15 text-sm font-semibold text-blue-500">
                  {u.shop_name.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-[var(--text)]">
                    {u.shop_name}
                    {u.role === "admin" && (
                      <span className="ml-2 rounded-full bg-purple-500/15 px-2 py-0.5 text-xs text-purple-400">admin</span>
                    )}
                  </p>
                  <p className="text-xs text-[var(--text-faint)]">@{u.login}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-[var(--text)]">{euros(u.balance_cents)}</p>
                  <p className="text-xs text-[var(--text-faint)]">{u.transactions.length} transaction(s)</p>
                </div>
                <span className="text-[var(--text-faint)]">{isOpen ? "▲" : "▼"}</span>
              </button>

              {isOpen && (
                <div className="mt-4 border-t border-[var(--border)] pt-4">
                  <div className="mb-2 flex justify-between text-xs text-[var(--text-muted)]">
                    <span>Volume encaissé : {euros(vol)}</span>
                    <span>Inscrit le {dateFr(u.created_at)}</span>
                  </div>
                  {u.transactions.length === 0 ? (
                    <p className="py-3 text-center text-sm text-[var(--text-faint)]">Aucune transaction.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="text-xs uppercase text-[var(--text-faint)]">
                          <tr className="border-b border-[var(--border)]">
                            <th className="py-2 pr-4">ID</th>
                            <th className="py-2 pr-4">Montant</th>
                            <th className="py-2 pr-4">Statut</th>
                            <th className="py-2">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {u.transactions.slice(0, 15).map((t) => (
                            <tr key={t.id} className="border-b border-[var(--border)] last:border-0">
                              <td className="py-2 pr-4 font-mono text-[var(--text-faint)]">#{t.id}</td>
                              <td className="py-2 pr-4 font-medium text-[var(--text)]">{euros(t.amount_cents)}</td>
                              <td className="py-2 pr-4"><StatusBadge status={t.status} /></td>
                              <td className="py-2 text-[var(--text-muted)]">{dateFr(t.created_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
