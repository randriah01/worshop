# remediation-engine — Moteur de remédiation (pilier Développement)

Reprise automatique de NovaPay : lit les incidents ouverts (créés par la
détection), applique une action corrective, vérifie que le service remarche
vraiment, puis marque l'incident **résolu** — ou l'**escalade** si la reprise
échoue.

## Le cycle

1. Lit les incidents `open` (`GET /incidents`).
2. Décide une action **autorisée** (règle déterministe, pas d'IA).
3. Exécute l'action : relance proprement le conteneur `payment-api`.
4. **Vérifie la reprise** : interroge `/health` jusqu'à deux réponses OK
   consécutives. Un incident n'est jamais déclaré résolu juste parce qu'une
   commande a tourné.
5. **Résout** (`POST /incidents/{id}/resolve`) si la vérification réussit,
   sinon **escalade** (`POST /incidents/{id}/escalate`) après N tentatives.

## Sécurité (moindre privilège)

- Le moteur ne peut faire QUE les actions d'une **liste blanche** : relancer un
  conteneur précis (`TARGET_CONTAINER`). Rien d'autre, aucune commande libre.
- Il a besoin du **socket Docker** (`/var/run/docker.sock`) pour relancer un
  service — c'est le composant « à privilèges élevés » du projet, volontairement
  restreint. À présenter au jury comme tel.
- Il est distinct de l'assistant IA, qui lui n'a **aucun** droit d'action.

## Réglages (variables d'environnement)

| Variable | Défaut | Rôle |
|---|---|---|
| `TARGET_CONTAINER` | novapay-payment-api | conteneur autorisé à la relance |
| `REMEDIATION_POLL_SECONDS` | 5 | fréquence de lecture des incidents |
| `REMEDIATION_MAX_ATTEMPTS` | 2 | nombre de tentatives avant escalade |
| `REMEDIATION_HEALTH_TIMEOUT` | 40 | fenêtre de vérification de la reprise (s) |

## Suivre son activité

```bash
docker compose logs -f remediation-engine
```

## Limite connue

Le moteur passe par `payment-api` pour lire et mettre à jour les incidents. Si
`payment-api` est **totalement** hors service, il ne peut plus communiquer : la
remédiation vise donc les dégradations (déni de service, pic d'erreurs) où le
service répond encore partiellement, pas une panne matérielle totale.
