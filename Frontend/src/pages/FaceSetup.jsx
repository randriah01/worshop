import { useEffect, useState } from 'react';
import FaceCamera from '../components/FaceCamera';
import {
  enrollFace, registerPasskey, faceStatus, deleteFaceEnrollment,
  listPasskeys, deletePasskey,
} from '../faceLogin';

export default function FaceSetup({ me, mode = 'manage', onContinue, onComplete, onLogout }) {
  const setup = mode === 'setup';
  const [passkeys, setPasskeys] = useState([]);
  const [passkeyReady, setPasskeyReady] = useState(false);
  const [faceEnrolled, setFaceEnrolled] = useState(false);
  const [consent, setConsent] = useState(false);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [status, registered] = await Promise.all([faceStatus(), listPasskeys()]);
    setPasskeyReady(status.passkey_registered);
    setFaceEnrolled(status.face_enrolled);
    setPasskeys(registered.passkeys || []);
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([faceStatus(), listPasskeys()])
      .then(([status, registered]) => {
        if (!cancelled) {
          setPasskeyReady(status.passkey_registered);
          setFaceEnrolled(status.face_enrolled);
          setPasskeys(registered.passkeys || []);
        }
      })
      .catch((err) => { if (!cancelled) setError(err.message || 'État biométrique indisponible.'); });
    return () => { cancelled = true; };
  }, []);

  async function activatePasskey() {
    setError(''); setMessage(''); setBusy(true);
    try {
      if (passkeyReady && !password) throw new Error('Confirme ton mot de passe pour ajouter une passkey.');
      await registerPasskey(passkeyReady ? password : null);
      await refresh();
      setPassword('');
      setMessage('Passkey enregistrée. Tu peux maintenant configurer ou utiliser ton visage.');
    } catch (err) {
      setError(err.message || 'Enregistrement de la passkey impossible.');
    } finally { setBusy(false); }
  }

  async function capture(images) {
    setError(''); setMessage(''); setBusy(true);
    try {
      if (faceEnrolled && !password) throw new Error('Confirme ton mot de passe avant de remplacer ton visage.');
      await enrollFace(images, consent, faceEnrolled ? password : null);
      await refresh();
      setPassword('');
      setMessage('Visage enregistré et associé à ton compte.');
    } catch (err) {
      setError(err.message || 'Enregistrement du visage refusé.');
    } finally { setBusy(false); }
  }

  async function removePasskey(id) {
    setError(''); setMessage('');
    if (!password) { setError('Saisis ton mot de passe avant de supprimer une passkey.'); return; }
    if (!window.confirm('Révoquer cette passkey dans NovaPay ?')) return;
    setBusy(true);
    try {
      await deletePasskey(id, password);
      await refresh();
      setPassword('');
      setMessage('Passkey révoquée dans NovaPay. Pense aussi à la supprimer du gestionnaire de passkeys de ton appareil.');
    } catch (err) {
      setError(err.message || 'Impossible de supprimer cette passkey.');
    } finally { setBusy(false); }
  }

  async function removeEnrollment() {
    setError(''); setMessage('');
    if (!password) { setError('Confirme ton mot de passe pour supprimer tes données biométriques.'); return; }
    if (!window.confirm('Supprimer le visage et TOUTES les passkeys NovaPay ? La connexion sera désactivée jusqu’à un nouvel enrôlement.')) return;
    setBusy(true);
    try {
      await deleteFaceEnrollment(password);
      setPassword('');
      onLogout?.();
    } catch (err) {
      setError(err.message || 'Suppression impossible.');
    } finally { setBusy(false); }
  }

  return (
    <section className="mx-auto max-w-xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold">{setup ? 'Activation obligatoire de la connexion faciale' : 'Sécurité du compte — visage et passkeys'}</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Compte <strong>{me?.login}</strong>. {setup
            ? "Avant l'accès au dashboard, enregistre une passkey et ton visage. À la fin, reconnecte-toi avec ton mot de passe puis ta caméra."
            : "Gère ici les passkeys autorisées et ta référence biométrique chiffrée."}
        </p>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5 space-y-3">
        <h2 className="font-medium">1. Passkeys {passkeyReady && '✓'}</h2>
        <p className="text-sm text-[var(--text-muted)]">
          La passkey prouve que tu utilises un authentificateur autorisé (Touch ID, PIN ou autre selon l'appareil).
          Elle n'est pas une preuve de reconnaissance faciale à elle seule.
        </p>
        {passkeys.length > 0 && <div className="space-y-2">
          {passkeys.map((p, index) => <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] p-3">
            <span className="text-sm">Passkey {index + 1} — {new Date(p.created_at).toLocaleDateString('fr-FR')}</span>
            {!setup && <button type="button" disabled={busy || passkeys.length === 1}
              onClick={() => removePasskey(p.id)} className="text-sm text-red-400 disabled:opacity-40">
              Supprimer
            </button>}
          </div>)}
          {passkeys.length === 1 && !setup && <p className="text-xs text-[var(--text-muted)]">La dernière passkey ne peut pas être supprimée individuellement. Ajoute-en une nouvelle, puis supprime l'ancienne.</p>}
        </div>}
        <label className="block text-sm text-[var(--text-muted)]">
          Mot de passe de confirmation {passkeyReady ? '(requis pour ajouter ou supprimer une passkey)' : '(requis pour supprimer des données)'}
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password" className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-[var(--text)]" />
        </label>
        <button type="button" onClick={activatePasskey} disabled={busy}
          className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
          {passkeyReady ? 'Ajouter une autre passkey' : 'Enregistrer ma première passkey'}
        </button>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5 space-y-3">
        <h2 className="font-medium">2. Enregistrer ton visage {faceEnrolled && '✓'}</h2>
        <p className="text-sm text-[var(--text-muted)]">
          Une signature biométrique chiffrée est conservée, pas les images JPEG. La détection de vivacité
          de ce pilote reste à éprouver contre les photos, vidéos et caméras virtuelles.
        </p>
        {passkeyReady ? <>
          <label className="flex gap-2 text-sm text-[var(--text-muted)]">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            Je consens au traitement de ma signature faciale par NovaPay pour l'authentification.
          </label>
          {consent ? <FaceCamera disabled={busy} onCapture={capture} /> :
            <p className="text-sm text-[var(--text-faint)]">Coche la case pour activer la caméra.</p>}
        </> : <p className="text-sm text-[var(--text-faint)]">Commence par enregistrer ta passkey.</p>}
      </div>
      {setup ? <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 space-y-2">
        <p className="text-sm">{passkeyReady && faceEnrolled
          ? 'Configuration terminée. La connexion suivante vérifiera obligatoirement le mot de passe, le visage et la passkey.'
          : 'Le dashboard reste verrouillé tant que les deux étapes ne sont pas terminées.'}</p>
        <button type="button" disabled={!passkeyReady || !faceEnrolled || busy} onClick={onComplete}
          className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
          Terminer et revenir à la connexion
        </button>
        <button type="button" onClick={onLogout} className="block text-sm text-[var(--text-muted)]">
          Se déconnecter et reprendre plus tard
        </button>
      </div> : <div className="space-y-3">
        {onContinue && <button type="button" onClick={onContinue} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm">Retour au tableau de bord</button>}
        <div><button type="button" onClick={removeEnrollment} disabled={busy}
          className="rounded-lg border border-red-500/40 px-4 py-2 text-sm text-red-400 disabled:opacity-50">
          Supprimer toutes mes données biométriques et passkeys
        </button></div>
      </div>}
      {message && <p role="status" className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-400">{message}</p>}
      {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{error}</p>}
    </section>
  );
}
