import { useState } from "react";
import { Lock, Store, User, Loader2, ShieldCheck } from "lucide-react";
import { register } from "../api";
import { AuthLayout, FormError } from "@/components/app/auth-layout";
import { IconInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShimmerButton } from "@/components/magicui/shimmer-button";

export default function Register({ onSuccess, onLogin, onBack }) {
  const [shopName, setShopName] = useState("");
  const [loginName, setLoginName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!shopName.trim() || !loginName.trim() || !password) {
      setError("Tous les champs sont requis.");
      return;
    }
    if (password.length < 6) {
      setError("Le mot de passe doit faire au moins 6 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    try {
      const result = await register(loginName.trim(), password, shopName.trim());
      onSuccess(result);
    } catch (err) {
      setError(err.message || "Inscription impossible.");
    } finally {
      setLoading(false);
    }
  }

  const strong = password.length >= 6;

  return (
    <AuthLayout
      onBack={onBack}
      cardName={shopName}
      headline="Votre commerce, prêt à encaisser en deux minutes."
      text="Créez votre compte marchand : la carte de démonstration se personnalise au nom de votre boutique."
    >
      <h1 className="text-[1.75rem] font-bold tracking-[-0.03em] text-foreground">Créer un compte</h1>
      <p className="mt-1 text-sm text-muted-foreground">Ouvrez votre espace marchand NovaPay.</p>

      <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
        <div>
          <Label htmlFor="shop">Nom de la boutique</Label>
          <IconInput id="shop" icon={Store} value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="Le Fournil de Paris" />
        </div>
        <div>
          <Label htmlFor="reg-login">Identifiant</Label>
          <IconInput id="reg-login" icon={User} value={loginName} onChange={(e) => setLoginName(e.target.value)} placeholder="fournil" autoComplete="username" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="reg-pwd">Mot de passe</Label>
            <IconInput id="reg-pwd" icon={Lock} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6 caractères min." autoComplete="new-password" />
          </div>
          <div>
            <Label htmlFor="reg-confirm">Confirmation</Label>
            <IconInput
              id="reg-confirm"
              icon={Lock}
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••"
              autoComplete="new-password"
              aria-invalid={confirm.length > 0 && confirm !== password}
            />
          </div>
        </div>
        <p className={"flex items-center gap-1.5 text-xs " + (strong ? "text-success" : "text-subtle-foreground")}>
          <ShieldCheck className="size-3.5" /> {strong ? "Longueur du mot de passe suffisante" : "Au moins 6 caractères"}
        </p>

        <FormError>{error}</FormError>

        <ShimmerButton type="submit" disabled={loading} className="h-12 w-full">
          {loading ? (
            <>
              <Loader2 className="animate-spin" /> Création…
            </>
          ) : (
            "Créer mon compte"
          )}
        </ShimmerButton>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Déjà inscrit ?{" "}
        <button type="button" onClick={onLogin} className="cursor-pointer font-semibold text-primary hover:underline">
          Se connecter
        </button>
      </p>
    </AuthLayout>
  );
}
