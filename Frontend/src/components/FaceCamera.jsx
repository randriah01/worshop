import { useEffect, useRef, useState } from 'react';

/** Caméra locale. Les images ne quittent le navigateur qu'au clic explicite. */
export default function FaceCamera({ onCapture, disabled }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Caméra indisponible : ouvre NovaPay en HTTPS.');
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false, video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        });
        if (!active) { stream.getTracks().forEach((track) => track.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          if (active) setReady(true);
        }
      } catch (err) {
        if (active) setError(err.message || 'Autorisation de caméra refusée.');
      }
    }
    start();
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  async function capture() {
    if (!ready || busy || disabled || !videoRef.current) return;
    setBusy(true);
    setError('');
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 640 / video.videoWidth);
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const ctx = canvas.getContext('2d');
      const images = [];
      for (let i = 0; i < 3; i++) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        images.push(canvas.toDataURL('image/jpeg', 0.76));
        if (i < 2) await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      await onCapture(images);
    } catch (err) {
      setError(err.message || 'Impossible de vérifier la caméra.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-xl border border-[var(--border)] bg-black" />
      <p className="text-xs text-[var(--text-muted)]">
        Place ton visage dans le cadre, avec une bonne lumière. Trois images sont analysées
        pour la reconnaissance et l'anti-spoofing. Cela ne garantit pas l'absence de vidéo falsifiée.
      </p>
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      <button type="button" disabled={!ready || busy || disabled} onClick={capture}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white disabled:opacity-50">
        {busy || disabled ? 'Vérification en cours…' : 'Analyser mon visage'}
      </button>
    </div>
  );
}
