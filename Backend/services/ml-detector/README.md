# ml-detector — Détection d'anomalies (pilier IA / Data)

Service qui surveille `payment-api` et crée automatiquement un incident quand il
repère une attaque. C'est la brique qui relie **l'attaque** à la **page
Cybersécurité**.

## Comment ça marche

Toutes les quelques secondes, le détecteur lit les métriques de l'API
(`/metrics`) et calcule :
- le **débit de requêtes** (req/s),
- le **taux d'erreurs 5xx**,
- la **disponibilité de la base** (`novapay_db_up`).

Il apprend une **référence glissante** du débit normal (moyenne + écart-type) et
signale une anomalie quand :
- le débit dépasse la référence de plusieurs écarts-types (**z-score**, pic de
  trafic / déni de service), ou
- le taux d'erreurs 5xx dépasse un seuil, ou
- l'API ou la base ne répond plus.

Ce n'est donc pas une simple règle fixe : la détection s'appuie sur un modèle
statistique (référence apprise) complété de seuils métier.

Quand une anomalie est détectée, il crée un incident via `POST /incidents`
(endpoint interne, protégé par `INTERNAL_TOKEN`). Il **ne répare rien** : la
remédiation est un composant distinct.

## Réglages (variables d'environnement)

| Variable | Défaut | Rôle |
|---|---|---|
| `DETECTOR_POLL_SECONDS` | 5 | fréquence d'analyse |
| `DETECTOR_WINDOW` | 20 | taille de la référence glissante |
| `DETECTOR_Z` | 3.0 | sensibilité du pic (écarts-types) |
| `DETECTOR_MIN_RATE` | 15 | débit min. pour parler de pic (req/s) |
| `DETECTOR_ERR_RATIO` | 0.30 | seuil de taux d'erreurs 5xx |
| `DETECTOR_COOLDOWN` | 45 | délai anti-spam entre incidents (s) |

Pour une démo, tu peux baisser `DETECTOR_MIN_RATE` et `DETECTOR_Z` pour déclencher
plus facilement.

## Suivre son activité

```bash
docker compose logs -f ml-detector
```

Tu verras à chaque cycle le débit mesuré, le taux d'erreur, et « ANOMALIE » quand
il détecte quelque chose.
