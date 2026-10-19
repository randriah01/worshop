# remediation-engine — Moteur de remédiation (pilier Développement)

Composant à développer sur la branche `feature/dev`.

## Rôle
Recevoir l'alerte de détection, décider de l'action corrective, l'exécuter
automatiquement, puis vérifier le retour à un état utilisable (une nouvelle
transaction doit passer). C'est le cœur de la « reprise sans intervention ».

Exemples d'actions : bloquer une IP au niveau du WAF, relancer proprement
un service, isoler un composant compromis.

## Attention (sécurité)
Ce service peut avoir des droits élevés sur les conteneurs : c'est le composant
le plus sensible. Ne lui donner que les permissions strictement nécessaires,
pas un accès d'administration ouvert à tout.

## À produire ici
- `Dockerfile`, `requirements.txt`, `app/`
- la logique de décision et les playbooks / actions de reprise
- les vérifications post-reprise

## Activation
Décommenter le service `remediation-engine` dans `docker-compose.yml`
quand le composant est prêt.
