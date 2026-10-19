#!/usr/bin/env bash
set -euo pipefail

# Crée une branche Git par domaine du workshop, à partir de main.
# À lancer une fois, après le premier commit sur main.

BRANCHES=(
  "feature/dev"          # Développement : SI de paiement + moteur de remédiation
  "feature/infra"        # Infrastructure : Docker, Ansible, observabilité
  "feature/ia"           # IA / Data : détection ML + assistant RAG
  "feature/cyber"        # Cybersécurité : WAF, SIEM, Vault, scénarios d'attaque
  "feature/gouvernance"  # EBIOS, PCA/PRA, NIS2/DORA
)

git checkout main

for b in "${BRANCHES[@]}"; do
  if git show-ref --verify --quiet "refs/heads/$b"; then
    echo "déjà existante : $b"
  else
    git branch "$b"
    echo "créée        : $b"
  fi
done

echo
echo "Pour pousser toutes les branches sur GitHub :"
echo "  git push -u origin --all"
