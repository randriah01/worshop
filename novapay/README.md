# NovaPay — Project Resilience-Alpha

Plateforme de paiement fictive pour le workshop EPSI. Objectif : encaisser une
attaque et retrouver un service utilisable **sans intervention humaine**
(détection → remédiation → preuve de reprise).

## Ce que démarre ce dépôt de base

La colonne vertébrale fonctionne déjà : SI de paiement + observabilité.
Les composants IA, remédiation et cyber sont des emplacements à remplir.

```
novapay/
├─ docker-compose.yml        orchestration de toute la stack
├─ .env.example              variables (copier en .env — jamais commité)
├─ db/init.sql               schéma + commerçants fictifs
├─ services/
│  ├─ web/                   front de test (à remplacer par le dashboard React/Tailwind)
│  ├─ payment-api/           API métier (FastAPI) + /metrics Prometheus
│  ├─ auth-service/          authentification (JWT)
│  ├─ ml-detector/           [à faire] détection d'anomalies (IA)
│  └─ remediation-engine/    [à faire] reprise automatique
├─ infra/
│  ├─ waf/                   reverse proxy / futur WAF
│  ├─ observability/         Prometheus, Loki, Promtail
│  └─ ansible/               [à faire] playbooks de déploiement
├─ docs/                     [à faire] EBIOS, PCA/PRA, NIS2/DORA
└─ scripts/create-branches.sh
```

## Démarrage

1. `cp .env.example .env` puis adapter les valeurs (les vrais secrets passeront
   par Vault / SOPS, voir le pilier Cybersécurité).
2. Vérifier la configuration : `docker compose config`
3. Lancer : `docker compose up --build`

Accès :
- Plateforme (via le proxy) : http://localhost/ — bouton « encaisser » pour une transaction test
- API directe : `POST http://localhost/api/transactions`
- Grafana : http://localhost:3000 (ajouter Prometheus et Loki comme sources)
- Prometheus : http://localhost:9090

## Organisation Git — une branche par domaine

`main` reste toujours déployable. Chaque domaine travaille sur sa branche,
puis fusionne dans `main` via pull request.

| Branche | Domaine |
|---|---|
| `feature/dev` | SI de paiement + moteur de remédiation |
| `feature/infra` | Docker, Ansible, observabilité |
| `feature/ia` | détection ML + assistant RAG |
| `feature/cyber` | WAF, SIEM, Vault, scénarios d'attaque |
| `feature/gouvernance` | EBIOS, PCA/PRA, NIS2/DORA |

Initialisation :

```bash
git init
git add .
git commit -m "Base NovaPay"
git branch -M main
git remote add origin <url-du-dépôt-GitHub>
git push -u origin main
bash scripts/create-branches.sh
git push -u origin --all
```

## Sécurité — règles à tenir

- Aucun secret en clair dans le dépôt (`.gitignore` protège `.env`, clés, etc.).
- N'exposer au réseau que le front et l'API. La base de données et les secrets
  restent internes à la stack.
