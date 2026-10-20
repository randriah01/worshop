# ml-detector — Détection d'anomalies (pilier IA / Data)

Composant à développer sur la branche `feature/ia`.

## Rôle
Consommer les métriques (Prometheus) et/ou les logs (Loki), apprendre
le comportement normal de la plateforme, et signaler une anomalie
(pic de requêtes, latence anormale, flux de transactions suspect).

Le sujet interdit une détection réduite à des `if` codés en dur :
il faut un vrai traitement de machine learning.

## À produire ici
- `Dockerfile`, `requirements.txt`, `app/`
- le modèle entraîné + le script d'entraînement
- l'endpoint qui émet une alerte vers le moteur de remédiation

## Activation
Décommenter le service `ml-detector` dans `docker-compose.yml`
quand le composant est prêt.
