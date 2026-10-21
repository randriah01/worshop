# IA-01 — Spécification de détection d'anomalies (V1)

**Responsable :** P1, Lead technique / IA. **Contributeurs :** P2 (Prometheus), P3 (contrôleur), P5 (SOC/WAF).

## Périmètre

Le service prend une **fenêtre agrégée de 60 secondes** pour `payment-api` et renvoie un score d'anomalie **informatif**, sans accès privilégié. L'API FastAPI `/v1/detect` peut être testée en local sans VM ni trafic offensif. Le couplage effectif avec Prometheus est une tâche ultérieure (IA-04).

## Features V1 (ordre contractuel)

| Nom JSON | Unité | Définition / provenance souhaitée |
| --- | --- | --- |
| `requests_per_second` | req/s | Somme des taux sur `http_requests_total` de `payment-api`, par fenêtre 60s |
| `error_rate` | ratio 0–1 | Taux de réponses **5xx** / taux de toutes les réponses ; conserver 4xx comme métrique additionnelle SOC |
| `latency_p95_ms` | ms | `histogram_quantile(0.95, ...)` sur les buckets de latence HTTP ; en millisecondes |
| `cpu_usage_percent` | % 0–100 | CPU alloué à `payment-api`, normalisé par vCPU ; choisir métrique cAdvisor ou processus et la documenter |

**Prérequis du backend et de l'infra :** exposer `/metrics` sur un réseau privé, utiliser des compteurs et histogrammes à labels cohérents. Valider les noms exacts au moment de l'instrumentation. Ne pas entraîner sur une métrique absente inventée.

Exemples PromQL **à adapter aux noms d'instrumentation réels** :

```promql
sum(rate(http_requests_total{job="payment-api"}[1m]))
```

```promql
sum(rate(http_requests_total{job="payment-api",status=~"5.."}[1m]))
/
clamp_min(sum(rate(http_requests_total{job="payment-api"}[1m])), 0.001)
```

```promql
histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket{job="payment-api"}[1m]))) * 1000
```

Pour le CPU, le choix cAdvisor versus métrique processus dépendra de l'instrumentation. Si `process_cpu_seconds_total` est présent : `100 * rate(process_cpu_seconds_total{job="payment-api"}[1m]) / <nombre_de_vcpu_alloues>` ; **remplacer `<nombre_de_vcpu_alloues>`** par une valeur justifiée (ce n'est pas une requête prête à copier).

## Stratégie d'apprentissage

- **Type :** détection non supervisée, Isolation Forest sur trafic **normal**.
- **Prétraitement :** valeurs numériques et ordre des features figés ; validation des plages ; scaling dans une pipeline versionnée.
- **Prototype :** jeux synthétiques, exclusivement pour tester les interfaces, le modèle et les scripts.
- **Validation finale requise :** recueillir des fenêtres réelles de trafic normal de l'application puis de trafic dégradé **dans un laboratoire autorisé** ; séparer le train et le test, compter les faux positifs et les anomalies détectées ; documenter les limites.
- **Précaution :** score `decision_function` négatif = anomalie (avec seuil zéro défini par le modèle) ; **ce score n'est pas une probabilité**.
- **Risque :** l'absence ou le retard des métriques rend le système non prêt. Le contrôleur n'exécute jamais une action à partir du score seul.

## Interfaces entre équipes

`POST /v1/detect` : réponse `incident_id`, `timestamp`, `service`, `anomaly_detected`, `anomaly_score`, `model_version`, `evidence`, `recommendation`. Seul le contrôleur VM3 pourra corréler l'alerte avec les signaux WAF/SOC, la dégradation métier et une liste blanche d'actions. **Le détecteur n'infère pas une IP attaquante à partir de métriques agrégées ;** elle doit provenir de logs WAF vérifiés. Aucun appel vers Ansible ni ESXi dans ce service.

**Contrat inter-service prévu pour IA-04** : appel interne authentifié `POST /internal/anomalies` de VM2 vers VM3. Des paramètres anti-rejeu, une expiration et des droits réseau minimaux doivent être définis avec P3/P5. Ce contrat doit être implémenté/testé avant toute action automatique.

## Definition of Done IA-01

- [ ] Choix de métriques approuvé par P2 et P3.
- [ ] Signification, unité et intervalle d'agrégation documentés.
- [ ] Contrat JSON d'alerte validé avec P3/P5.
- [ ] Train/test et mesure des faux positifs définis.
- [ ] Jeux de données réels planifiés (IA-02, dépendant d'OBS-01 et du laboratoire validé).
