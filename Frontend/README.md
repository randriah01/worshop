# NovaPay — Dashboard (Frontend)

Interface web de la plateforme NovaPay : React 19 + Vite + Tailwind CSS v4.
Page de connexion + 4 pages (Tableau de bord, Transactions, Cybersécurité,
Cyber-résilience), branchées sur le backend `payment-api` / `auth-service`.

## Démarrage

```bash
npm install
npm run dev
```

Le dashboard s'ouvre sur http://localhost:5173.

## Connexion au backend

En développement, Vite proxifie `/api` et `/auth` vers le WAF du backend
(`http://localhost:80`, voir `vite.config.js`). Il faut donc que le backend
tourne :

```bash
cd ../Backend
cp .env.example .env   # puis adapter les valeurs
docker compose up --build
```

Comptes de démonstration : `fournil`, `cafe`, `epicerie` — mot de passe
`demo1234`.

Si le backend tourne sur une autre machine (la VM par exemple), change la
cible du proxy dans `vite.config.js` (`target: 'http://192.168.137.1:80'`).

## Pages

| Page | Contenu | Endpoints utilisés |
|---|---|---|
| Connexion | authentification commerçant | `POST /auth/login` |
| Tableau de bord | KPIs réels, graphiques, état des services, soldes | `/api/stats`, `/api/merchants`, `/api/health` |
| Transactions | liste, recherche, filtre, pagination, création, détail | `/api/transactions` (GET/POST) |
| Cybersécurité | incidents, gravité, chronologie | `/api/incidents` |
| Cyber-résilience | cycle de reprise, métriques, historique | `/api/incidents`, `/api/health` |

## Notes

- Toutes les données affichées viennent du backend (aucune donnée statique
  présentée comme réelle).
- Le JWT est stocké dans le navigateur (localStorage) et envoyé en
  `Authorization: Bearer`.
- Les composants qui dépendent du moteur de remédiation (temps de reprise,
  historique) affichent « non connecté » tant que ce service n'est pas branché,
  conformément au cahier des charges.
- Graphiques en SVG maison : aucune dépendance supplémentaire à installer.

## Build de production

```bash
npm run build      # génère dist/
npm run preview    # prévisualise le build
```

En production, sers `dist/` derrière le même proxy que l'API (même origine),
ou via le conteneur `web` du backend.
