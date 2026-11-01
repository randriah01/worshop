import { useState } from "react";
import { Eye, EyeOff, Lock, User, Loader2 } from "lucide-react";
import { login } from "../api";
import { AuthLayout, FormError } from "@/components/app/auth-layout";
import { IconInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShimmerButton } from "@/components/magicui/shimmer-button";

export default function Login({ onSuccess, onRegister, onBack }) {
  const [loginName, setLoginName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!loginName.trim() || !password.trim()) {
      setError("Identifiant et mot de passe requis.");
      return;
    }
    setLoading(true);
    try {
      await login(loginName.trim(), password);
      onSuccess();
    } catch (err) {
      setError(err.message || "Connexion impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      onBack={onBack}
      cardName={loginName}
      headline="Encaissez, même quand on vous attaque."
      text="Votre espace marchand NovaPay : paiements, incidents de sécurité et reprise automatique au même endroit."
    >
      <h1 className="text-[1.75rem] font-bold tracking-[-0.03em] text-foreground">Connexion</h1>
      <p className="mt-1 text-sm text-muted-foreground">Accédez à votre espace marchand.</p>

      <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
        <div>
          <Label htmlFor="login">Identifiant</Label>
          <IconInput
            id="login"
            icon={User}
            value={loginName}
            onChange={(e) => setLoginName(e.target.value)}
            placeholder="votre identifiant"
            autoComplete="username"
            aria-invalid={Boolean(error) && !loginName.trim()}
          />
        </div>

        <div>
          <Label htmlFor="password">Mot de passe</Label>
          <IconInput
            id="password"
            icon={Lock}
            type={showPwd ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            aria-invalid={Boolean(error) && !password.trim()}
            trailing={
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="grid size-8 cursor-pointer place-items-center rounded-lg text-subtle-foreground transition hover:bg-muted hover:text-foreground"
                aria-label={showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              >
                {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            }
          />
        </div>

        <FormError>{error}</FormError>

        <ShimmerButton type="submit" disabled={loading} className="h-12 w-full">
          {loading ? (
            <>
              <Loader2 className="animate-spin" /> Connexion…
            </>
          ) : (
            "Se connecter"
          )}
        </ShimmerButton>
      </form>

      <button
        type="button"
        onClick={() => {
          setLoginName("fournil");
          setPassword("demo1234");
        }}
        className="mt-4 w-full cursor-pointer rounded-control border border-dashed border-border px-3 py-2.5 text-left text-xs text-muted-foreground transition hover:border-input hover:text-foreground"
      >
        Démo : remplir avec le compte <span className="font-mono font-semibold text-foreground">fournil</span>
      </button>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Pas encore de compte ?{" "}
        <button type="button" onClick={onRegister} className="cursor-pointer font-semibold text-primary hover:underline">
          Créer un compte marchand
        </button>
      </p>
    </AuthLayout>
  );
}
