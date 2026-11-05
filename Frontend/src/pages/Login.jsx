import { useState } from "react";
import { Eye, EyeOff, Lock, User, Loader2, ScanFace, ShieldCheck } from "lucide-react";
import { login } from "../api";
import { finishFaceLogin } from "../faceLogin";
import FaceCamera from "../components/FaceCamera";
import { AuthLayout, FormError } from "@/components/app/auth-layout";
import { IconInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShimmerButton } from "@/components/magicui/shimmer-button";

export default function Login({ onSuccess, onRegister, onBack, onNeedsSetup }) {
  const [loginName, setLoginName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [challengeId, setChallengeId] = useState(null);

  function changeCredentials(fn, value) {
    fn(value);
    setChallengeId(null);
    setError("");
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!loginName.trim() || !password.trim()) {
      setError("Identifiant et mot de passe requis.");
      return;
    }
    setLoading(true);
    try {
      const result = await login(loginName.trim(), password);
      if (result?.requires_enrollment) {
        if (!result.setup_token) throw new Error("Jeton d'activation manquant.");
        onNeedsSetup();
      } else if (result?.requires_face && result.challenge_id) {
        setChallengeId(result.challenge_id);
      } else {
        throw new Error("Réponse MFA inattendue : aucune connexion sans visage et passkey.");
      }
    } catch (err) {
      setError(err.message || "Connexion impossible.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyFace(images) {
    setError("");
    setLoading(true);
    try {
      if (!challengeId) throw new Error("Vérifie d'abord ton mot de passe.");
      await finishFaceLogin(challengeId, images);
      onSuccess();
    } catch (err) {
      setError(err.message || "Vérification faciale ou passkey refusée.");
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
      <h1 className="text-[1.75rem] font-bold tracking-[-0.03em] text-foreground">Connexion sécurisée</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Mot de passe, contrôle du visage, puis passkey.
      </p>

      {challengeId && (
        <div role="status" className="mt-5 flex items-start gap-3 rounded-control border border-primary/30 bg-primary/10 p-4 text-sm text-foreground">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
          <span>Mot de passe validé. Vérifie maintenant ton visage, puis confirme ta passkey pour accéder au dashboard.</span>
        </div>
      )}

      <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
        <div>
          <Label htmlFor="login">Identifiant</Label>
          <IconInput
            id="login" icon={User} value={loginName}
            onChange={(e) => changeCredentials(setLoginName, e.target.value)}
            placeholder="votre identifiant" autoComplete="username" disabled={loading}
          />
        </div>
        <div>
          <Label htmlFor="password">Mot de passe</Label>
          <IconInput
            id="password" icon={Lock} type={showPwd ? "text" : "password"} value={password}
            onChange={(e) => changeCredentials(setPassword, e.target.value)}
            placeholder="••••••••" autoComplete="current-password" disabled={loading}
            trailing={
              <button type="button" onClick={() => setShowPwd((v) => !v)}
                className="grid size-8 cursor-pointer place-items-center rounded-lg text-subtle-foreground transition hover:bg-muted hover:text-foreground"
                aria-label={showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
                {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            }
          />
        </div>

        <FormError>{error}</FormError>
        <ShimmerButton type="submit" disabled={loading} className="h-12 w-full">
          {loading ? <><Loader2 className="animate-spin" /> Vérification…</> : challengeId ? "Recommencer la vérification" : "Vérifier mes identifiants"}
        </ShimmerButton>
      </form>

      {challengeId && (
        <div className="mt-6 rounded-card border border-border bg-card p-4">
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
            <ScanFace className="size-5 text-primary" /> Reconnaissance faciale
          </h2>
          <FaceCamera key={challengeId} disabled={loading} onCapture={verifyFace} />
        </div>
      )}

      {!challengeId && (
        <button type="button" onClick={() => { setLoginName("fournil"); setPassword("demo1234"); setError(""); }}
          className="mt-4 w-full cursor-pointer rounded-control border border-dashed border-border px-3 py-2.5 text-left text-xs text-muted-foreground transition hover:border-input hover:text-foreground">
          Démo : remplir avec le compte <span className="font-mono font-semibold text-foreground">fournil</span>
        </button>
      )}

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Pas encore de compte ?{" "}
        <button type="button" onClick={onRegister} className="cursor-pointer font-semibold text-primary hover:underline">Créer un compte marchand</button>
      </p>
    </AuthLayout>
  );
}
