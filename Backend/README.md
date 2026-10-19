# NovaPay — Project Resilience-Alpha

Plateforme de paiement fictive pour le workshop EPSI. Objectif : encaisser une
attaque et retrouver un service utilisable **sans intervention humaine**
(détection → remédiation → preuve de reprise).

## Ce que démarre ce dépôt

La colonne vertébrale fonctionne : SI de paiement (auth + API + base) et
observabilité. Les composants IA, remédiation et cyber sont des emplacements
à remplir.

```
novapay/
├─ docker-compose.yml        orchestration de toute la stack
├─ .env.example              variables (copier en .env — jamais commité)
├─ db/init.sql               schéma + commerçants fictifs
├─ services/
│  ├─ web/                   front de test (à remplacer par le dashboard React/Tailwind)
│  ├─ payment-api/           API métier (FastAPI) — transactions, soldes, incidents, /metrics
│  ├─ auth-service/          connexion commerçant + JWT
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
- Plateforme (via le proxy) : http://localhost/ — le bouton se connecte puis encaisse une transaction test
- Grafana : http://localhost:3000 (ajouter Prometheus et Loki comme sources)
- Prometheus : http://localhost:9090

## Le backend (SI de paiement)

### auth-service
- `POST /login` `{ "login": "...", "password": "..." }` → renvoie un JWT.
- Comptes de démo créés automatiquement au démarrage :
  `fournil`, `cafe`, `epicerie` — tous avec le mot de passe `demo1234`.
- Mots de passe stockés hachés (PBKDF2), jamais en clair.

### payment-api
Toutes les routes de transaction exigent un en-tête `Authorization: Bearer <JWT>`.

| Méthode | Route | Rôle |
|---|---|---|
| POST | `/transactions` | encaisse un montant (crédite le solde + enregistre la transaction, de façon atomique) |
| GET | `/transactions` | 20 dernières transactions |
| GET | `/merchants` | soldes des commerçants (pour le dashboard) |
| POST | `/incidents` | dépôt d'incident — réservé aux composants internes (en-tête `X-Internal-Token`) |
| GET | `/incidents` | incidents récents |
| GET | `/health` | état du service + base |
| GET | `/metrics` | métriques Prometheus |
| GET | `/docs` | documentation interactive (Swagger, générée par FastAPI) |

Métriques exposées pour la détection ML : nombre et durée des requêtes HTTP,
transactions par statut, montants, et disponibilité de la base.

Exemple en ligne de commande :

```bash
TOKEN=$(curl -s localhost/auth/login -H 'Content-Type: application/json' \
  -d '{"login":"fournil","password":"demo1234"}' | python -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')

curl -s localhost/api/transactions -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" -d '{"amount_cents":480}'
```

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
- Le même `JWT_SECRET` doit être partagé entre `payment-api` et `auth-service`.
