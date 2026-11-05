import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import {
  Search, Lock, CheckCircle2, XCircle, Loader2, Receipt, ChevronLeft, ChevronRight, Eye, RotateCcw, Plus,
} from "lucide-react";
import { getTransactions, createTransaction, isTransientError } from "../api";
import { euros, dateFr } from "@/lib/format";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, IconInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { CreditCard } from "@/components/app/credit-card";
import { ErrorNote, EmptyState } from "@/components/app/states";
import { ShimmerButton } from "@/components/magicui/shimmer-button";
import { BorderBeam } from "@/components/magicui/border-beam";
import { fireConfetti } from "@/components/magicui/confetti";
import { cn } from "@/lib/utils";

const PAGE = 10;

// Nouvelles tentatives automatiques d'un paiement refusé pour cause passagère
// (API saturée par une attaque, en reprise, limitation de débit…). On insiste
// jusqu'à RETRY_WINDOW_MS : assez pour que la détection + la remédiation agissent.
// Attentes : 2 s, 4 s, 8 s puis 10 s (± 25 % pour ne pas tirer tous en même temps).
const RETRY_WINDOW_MS = 180000;
const RETRY_BASE_MS = 2000;
const RETRY_MAX_DELAY_MS = 10000;

export default function Transactions() {

  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setAll(await getTransactions({ limit: 200 }));
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = all.filter((t) => {
    if (status && t.status !== status) return false;
    if (query && !String(t.id).includes(query.trim())) return false;
    return true;
  });
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const view = filtered.slice(page * PAGE, page * PAGE + PAGE);

  return (
    <div className="space-y-6">
      <PageHeader title="Transactions" subtitle="Paiements simulés, aucun mouvement réel" onRefresh={load} refreshing={loading} />

      <Checkout
        onPaid={() => {
          load();
          setPage(0);
        }}
      />

      <Card>
        <CardHeader className="flex-wrap">
          <div>
            <CardTitle>Historique</CardTitle>
            <CardDescription>{filtered.length} transaction(s)</CardDescription>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <IconInput
              icon={Search}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              placeholder="N° de transaction…"
              inputMode="numeric"
              aria-label="Rechercher par identifiant"
              className="min-w-0 flex-1 sm:w-60 sm:flex-none"
              inputClassName="h-10"
            />
            <Select
              value={status || "all"}
              onValueChange={(v) => {
                setStatus(v === "all" ? "" : v);
                setPage(0);
              }}
            >
              <SelectTrigger className="h-10 w-full sm:w-44" aria-label="Filtrer par statut">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="validated">Réussie</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="rejected">Échouée</SelectItem>
                <SelectItem value="error">Erreur</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          {loading && all.length === 0 ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-11" />
              ))}
            </div>
          ) : error ? (
            <ErrorNote>{error}</ErrorNote>
          ) : view.length === 0 ? (
            <EmptyState icon={Receipt} title="Aucune transaction">
              {all.length ? "Aucun résultat pour ces filtres." : "Effectuez un paiement ci-dessus pour remplir l'historique."}
            </EmptyState>
          ) : (
            <>
              {/* Tableau (tablette et ordinateur) */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Identifiant</TableHead>
                      <TableHead>Commerçant</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right"><span className="sr-only">Actions</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {view.map((t, i) => (
                      <motion.tr
                        key={t.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: Math.min(i * 0.025, 0.25) }}
                        className="border-b border-border transition-colors hover:bg-muted/60"
                      >
                        <TableCell className="font-mono text-muted-foreground">#{t.id}</TableCell>
                        <TableCell className="text-foreground">{t.merchant}</TableCell>
                        <TableCell className="text-right font-mono font-semibold text-foreground tabular">{euros(t.amount_cents)}</TableCell>
                        <TableCell><StatusBadge status={t.status} /></TableCell>
                        <TableCell className="text-muted-foreground">{dateFr(t.created_at)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => setDetail(t)}>
                            <Eye /> Détail
                          </Button>
                        </TableCell>
                      </motion.tr>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Liste (mobile) */}
              <ul className="space-y-2 sm:hidden">
                {view.map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={() => setDetail(t)}
                      className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-control border border-border bg-surface-2 px-3.5 py-3 text-left"
                    >
                      <div className="min-w-0">
                        <p className="font-mono font-semibold text-foreground tabular">{euros(t.amount_cents)}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          #{t.id} · {dateFr(t.created_at)}
                        </p>
                      </div>
                      <StatusBadge status={t.status} />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {!loading && filtered.length > PAGE && (
            <div className="mt-5 flex items-center justify-between gap-3 text-sm text-muted-foreground">
              <span>
                Page <span className="font-semibold text-foreground">{page + 1}</span> sur {pages}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft /> Précédent
                </Button>
                <Button variant="outline" size="sm" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>
                  Suivant <ChevronRight />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <DetailModal tx={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

/* ---------------- Checkout façon Stripe (simulé) ---------------- */

// Détection simple de la marque à partir du préfixe.
function cardBrand(num) {
  const n = num.replace(/\s/g, "");
  if (/^4/.test(n)) return "Visa";
  if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return "Mastercard";
  if (/^3[47]/.test(n)) return "Amex";
  return "";
}

// Algorithme de Luhn : vérifie qu'un numéro de carte est bien formé.
function luhnValid(num) {
  const n = num.replace(/\s/g, "");
  if (n.length < 13) return false;
  let sum = 0;
  let alt = false;
  for (let i = n.length - 1; i >= 0; i--) {
    let d = parseInt(n[i], 10);
    if (Number.isNaN(d)) return false;
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function formatCard(value) {
  return value
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

function formatExpiry(value) {
  const v = value.replace(/\D/g, "").slice(0, 4);
  if (v.length < 3) return v;
  return v.slice(0, 2) + "/" + v.slice(2);
}

// Génère une clé d'idempotence unique (UUID si disponible, sinon repli).
function newKey() {
  try {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* ignore */
  }
  return "k-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

function Checkout({ onPaid }) {

  const [amount, setAmount] = useState("24.90");
  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [errors, setErrors] = useState({});
  const [stage, setStage] = useState("form"); // form | processing | success | declined
  const [result, setResult] = useState(null);
  // Clé d'idempotence : une par paiement. Un double-clic ou un renvoi réutilise
  // la même clé → le serveur ne crée pas de doublon.
  const [idemKey, setIdemKey] = useState(() => newKey());
  const [retryInfo, setRetryInfo] = useState(null); // { n } pendant une relance auto
  const cancelRef = useRef(false);
  const keyCents = useRef(null); // montant associé à la clé courante

  const brand = cardBrand(number);
  const cents = Math.round(parseFloat((amount || "").replace(",", ".")) * 100);

  function validate() {
    const e = {};
    if (!cents || cents <= 0) e.amount = "Montant invalide";
    if (!luhnValid(number)) e.number = "Numéro de carte invalide";
    if (!name.trim()) e.name = "Nom requis";
    if (!/^\d{2}\/\d{2}$/.test(expiry)) {
      e.expiry = "Format MM/AA";
    } else {
      const [mm, yy] = expiry.split("/").map((x) => parseInt(x, 10));
      const now = new Date();
      const exp = new Date(2000 + yy, mm, 0, 23, 59);
      if (mm < 1 || mm > 12) e.expiry = "Mois invalide";
      else if (exp < now) e.expiry = "Carte expirée";
    }
    if (!/^\d{3,4}$/.test(cvc)) e.cvc = "CVC invalide";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function pay(ev) {
    ev.preventDefault();
    if (!validate()) return;
    setStage("processing");
    setRetryInfo(null);

    // Même clé pour tous les envois d'UN paiement ; si le montant change, c'est
    // un autre paiement → nouvelle clé (sinon le serveur renverrait l'ancien).
    let key = idemKey;
    if (keyCents.current !== null && keyCents.current !== cents) {
      key = newKey();
      setIdemKey(key);
    }
    keyCents.current = cents;

    // Petit délai pour simuler le traitement par la banque.
    await new Promise((r) => setTimeout(r, 1000));

    // Seul le montant part au serveur — JAMAIS les données de carte.
    // Toute carte valide est acceptée : un échec ne survient qu'en cas de
    // problème réel côté serveur (ex. plateforme sous attaque). On réessaie
    // alors automatiquement avec LA MÊME clé d'idempotence : si le premier envoi
    // est en fait passé, le serveur renvoie la transaction existante au lieu de
    // débiter une seconde fois.
    const deadline = Date.now() + RETRY_WINDOW_MS;
    cancelRef.current = false;
    const fail = (reason, retried) => {
      setResult({ reason, retried });
      setStage("declined");
      setRetryInfo(null);
    };
    for (let attempt = 0; ; attempt++) {
      try {
        const r = await createTransaction(cents, key);
        setResult({ ...r, retried: attempt });
        setStage("success");
        setRetryInfo(null);
        onPaid();
        return;
      } catch (err) {
        if (cancelRef.current) return fail("Paiement annulé. Vérifie l'historique avant de réessayer.", attempt);
        if (Date.now() >= deadline || !isTransientError(err)) return fail(err.message, attempt);
        setRetryInfo({ n: attempt + 1 });
        const wait = Math.min(RETRY_BASE_MS * 2 ** attempt, RETRY_MAX_DELAY_MS) * (0.75 + Math.random() * 0.5);
        await new Promise((r) => setTimeout(r, wait));
        if (cancelRef.current) return fail("Paiement annulé. Vérifie l'historique avant de réessayer.", attempt + 1);
      }
    }
  }

  // Retour au formulaire en CONSERVANT la saisie et la clé d'idempotence :
  // un refus peut cacher un paiement passé, une nouvelle clé risquerait un doublon.
  function backToForm() {
    setResult(null);
    setStage("form");
  }

  function reset() {
    setNumber("");
    setName("");
    setExpiry("");
    setCvc("");
    setErrors({});
    setResult(null);
    setStage("form");
    keyCents.current = null;
    setIdemKey(newKey()); // nouveau paiement = nouvelle clé
  }

  // --- Présentation uniquement (aucun impact sur la logique de paiement) ---
  const [cvcFocus, setCvcFocus] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    if (stage === "success") {
      toast.success("Paiement réussi", { description: `${euros(cents)} encaissés` });
      const r = panelRef.current?.getBoundingClientRect();
      fireConfetti(r ? { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 3) / window.innerHeight } : undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  return (
    <Card ref={panelRef} className="relative overflow-hidden">
      {stage === "processing" && <BorderBeam size={120} duration={3} borderWidth={2} />}
      <div className="grid lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        {/* Aperçu de la carte + montant */}
        <div className="relative isolate overflow-hidden border-b border-border bg-surface-2 p-5 sm:p-7 lg:border-r lg:border-b-0">
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(70%_60%_at_20%_0%,rgb(0_130_253/0.14),transparent_70%)]" />
          <h2 className="text-lg font-bold tracking-tight text-foreground">Nouveau paiement</h2>
          <p className="mt-1 text-sm text-muted-foreground">Réglez un montant par carte. Environnement de démonstration.</p>
          <div className="mx-auto mt-6 max-w-[22rem]">
            <CreditCard number={number} name={name} expiry={expiry} cvc={cvc} brand={brand} flipped={cvcFocus} />
          </div>
          <div className="mx-auto mt-6 max-w-[22rem]">
            <Label htmlFor="amount">Montant à payer</Label>
            <div
              className={cn(
                "flex items-center rounded-control border bg-card px-4 transition-[border-color,box-shadow] focus-within:border-ring focus-within:shadow-[0_0_0_4px_rgb(2_169_252/0.15)]",
                errors.amount ? "border-destructive" : "border-input"
              )}
            >
              <input
                id="amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                disabled={stage !== "form"}
                className="h-14 w-full min-w-0 bg-transparent font-mono text-2xl font-semibold text-foreground tabular outline-none"
              />
              <span className="text-lg font-semibold text-subtle-foreground">€</span>
            </div>
            {errors.amount && <p className="mt-1.5 text-xs font-medium text-destructive">{errors.amount}</p>}
          </div>
        </div>

        {/* Formulaire / états */}
        <div className="relative min-h-[26rem] p-5 sm:p-7">
          <AnimatePresence mode="wait" initial={false}>
            {stage === "processing" && (
              <StagePanel key="processing">
                <span className="relative grid size-16 place-items-center">
                  <span className="absolute inset-0 animate-ping rounded-full bg-electric/20 motion-reduce:hidden" />
                  <span className="relative grid size-16 place-items-center rounded-full bg-accent text-accent-foreground">
                    <Loader2 className="size-7 animate-spin" />
                  </span>
                </span>
                <p className="mt-5 text-lg font-semibold text-foreground">Traitement du paiement…</p>
                {retryInfo ? (
                  <>
                    <p className="mt-2 max-w-xs text-sm text-warning">
                      Service momentanément indisponible. Nouvelle tentative automatique n°{retryInfo.n} (jusqu'à 3 min)…
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => {
                        cancelRef.current = true;
                      }}
                    >
                      Annuler
                    </Button>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">Vérification auprès de la banque (simulée)</p>
                )}
              </StagePanel>
            )}

            {stage === "success" && (
              <StagePanel key="success">
                <motion.span
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 18 }}
                  className="grid size-16 place-items-center rounded-full bg-success/15 text-success"
                >
                  <CheckCircle2 className="size-8" />
                </motion.span>
                <h3 className="mt-5 text-xl font-bold tracking-tight text-foreground">Paiement réussi</h3>
                <p className="mt-1 font-mono text-2xl font-semibold text-foreground tabular">{euros(cents)}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Transaction #{result?.id}. Nouveau solde commerçant : {euros(result?.new_balance_cents)}
                </p>
                {result?.retried > 0 && (
                  <p className="mt-2 max-w-xs text-xs font-medium text-success">
                    Validé automatiquement après {result.retried} nouvelle(s) tentative(s), sans double débit.
                  </p>
                )}
                <Button onClick={reset} className="mt-6">
                  <Plus /> Nouveau paiement
                </Button>
              </StagePanel>
            )}

            {stage === "declined" && (
              <StagePanel key="declined">
                <motion.span
                  initial={{ x: 0 }}
                  animate={{ x: [0, -8, 8, -5, 5, 0] }}
                  transition={{ duration: 0.45 }}
                  className="grid size-16 place-items-center rounded-full bg-destructive/15 text-destructive"
                >
                  <XCircle className="size-8" />
                </motion.span>
                <h3 className="mt-5 text-xl font-bold tracking-tight text-foreground">Paiement refusé</h3>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">{result?.reason}</p>
                {result?.retried > 0 && (
                  <p className="mt-2 max-w-sm text-xs text-subtle-foreground">
                    {result.retried} nouvelle(s) tentative(s) automatique(s) sans succès. Aucun double débit possible : le même
                    paiement est renvoyé avec la même clé.
                  </p>
                )}
                <Button variant="outline" onClick={backToForm} className="mt-6">
                  <RotateCcw /> Réessayer
                </Button>
              </StagePanel>
            )}

            {stage === "form" && (
              <motion.form
                key="form"
                onSubmit={pay}
                noValidate
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                <Field label="Numéro de carte" error={errors.number} htmlFor="cc-number">
                  <IconInput
                    id="cc-number"
                    value={number}
                    onChange={(e) => setNumber(formatCard(e.target.value))}
                    placeholder="1234 5678 9012 3456"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    aria-invalid={Boolean(errors.number)}
                    inputClassName="font-mono tracking-wider"
                    trailing={brand ? <span className="text-xs font-bold text-accent-foreground italic">{brand}</span> : null}
                  />
                </Field>

                <Field label="Titulaire de la carte" error={errors.name} htmlFor="cc-name">
                  <Input
                    id="cc-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="PRINCIA R."
                    autoComplete="cc-name"
                    aria-invalid={Boolean(errors.name)}
                    className="uppercase"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Expiration" error={errors.expiry} htmlFor="cc-exp">
                    <Input
                      id="cc-exp"
                      value={expiry}
                      onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                      placeholder="MM/AA"
                      inputMode="numeric"
                      autoComplete="cc-exp"
                      aria-invalid={Boolean(errors.expiry)}
                      className="font-mono"
                    />
                  </Field>
                  <Field label="CVC" error={errors.cvc} htmlFor="cc-cvc">
                    <Input
                      id="cc-cvc"
                      value={cvc}
                      onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      onFocus={() => setCvcFocus(true)}
                      onBlur={() => setCvcFocus(false)}
                      placeholder="123"
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      aria-invalid={Boolean(errors.cvc)}
                      className="font-mono"
                    />
                  </Field>
                </div>

                <ShimmerButton type="submit" className="mt-2 h-12 w-full">
                  <Lock /> Payer {cents > 0 ? euros(cents) : ""}
                </ShimmerButton>

                <p className="flex items-center justify-center gap-1.5 text-center text-xs text-subtle-foreground">
                  <Lock className="size-3" aria-hidden="true" /> Paiement simulé : aucune donnée bancaire réelle n'est collectée ni stockée.
                </p>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Card>
  );
}

function StagePanel({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="flex h-full min-h-[22rem] flex-col items-center justify-center text-center"
      aria-live="polite"
    >
      {children}
    </motion.div>
  );
}

function Field({ label, error, htmlFor, children }) {
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error && <p className="mt-1.5 text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}

/* ---------------- Détail d'une transaction ---------------- */

function DetailModal({ tx, onClose }) {
  return (
    <Dialog open={Boolean(tx)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        {tx && (
          <>
            <DialogHeader>
              <DialogTitle>Transaction #{tx.id}</DialogTitle>
              <DialogDescription>{dateFr(tx.created_at)}</DialogDescription>
            </DialogHeader>
            <div className="mb-5 rounded-2xl bg-surface-2 p-5 text-center">
              <p className="font-mono text-3xl font-semibold tracking-tight text-foreground tabular">{euros(tx.amount_cents)}</p>
              <div className="mt-2 flex justify-center"><StatusBadge status={tx.status} /></div>
            </div>
            <dl className="space-y-0 text-sm">
              <Row k="Identifiant" v={<span className="font-mono">#{tx.id}</span>} />
              <Row k="Commerçant" v={tx.merchant} />
              <Row k="Montant" v={euros(tx.amount_cents)} />
              <Row k="Statut" v={<StatusBadge status={tx.status} />} />
              <Row k="Date" v={dateFr(tx.created_at)} />
              <Row k="Devise" v="EUR" />
            </dl>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-0">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right font-medium text-foreground">{v}</dd>
    </div>
  );
}
