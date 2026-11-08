#!/usr/bin/env bash
# =====================================================================
#  10 ESSAIS DE RESILIENCE — mesure automatique MTTD / MTTR / RTO
#  NovaPay Resilience-Alpha — Partie Cybersecurite (P5)
#  A lancer depuis VM3.  /!\ uniquement sur ta VM1 autorisee.
#
#  Pour chaque essai :
#   1) lance un flood sur le paiement
#   2) mesure le temps avant impact (le service passe en 502)
#   3) arrete le flood
#   4) mesure le temps de reprise (le service revient a 200)
#  Puis ecrit un tableau + un fichier CSV pour le dossier.
#
#  Lancement :  bash essais_resilience.sh
# =====================================================================

CIBLE="http://192.168.150.11/api/transactions"   # on attaque le paiement
SONDE="http://192.168.150.11/api/health"          # on mesure l'etat ici (200/502)
N=10                 # nombre d'essais
FLOOD_MAX=40         # duree max d'un flood (secondes)
REPRISE_MAX=120      # temps max d'attente de la reprise (secondes)
PAUSE=15             # pause entre deux essais (secondes)

# Verif que wrk est installe
if ! command -v wrk >/dev/null 2>&1; then
  echo "wrk n'est pas installe. Installe-le :  sudo apt install wrk"
  exit 1
fi

ulimit -n 200000 2>/dev/null

CSV="resultats_resilience.csv"
echo "Essai;Temps avant impact (s);MTTR reprise (s);Resultat" > "$CSV"

echo "=============================================================="
echo "  10 ESSAIS DE RESILIENCE — NovaPay"
echo "  Cible : $CIBLE"
echo "=============================================================="
printf "%-6s %-22s %-18s %-12s\n" "Essai" "Impact (s)" "Reprise MTTR (s)" "Resultat"
echo "--------------------------------------------------------------"

sum_impact=0; sum_mttr=0; nb_ok=0

for i in $(seq 1 $N); do
  t0=$(date +%s)

  # --- lancer le flood en arriere-plan (4 process)
  for j in 1 2 3 4; do
    wrk -t8 -c2000 -d${FLOOD_MAX}s "$CIBLE" >/dev/null 2>&1 &
  done

  # --- attendre l'impact (le service passe en 502 / 5xx / timeout)
  t_impact=""
  for s in $(seq 1 $FLOOD_MAX); do
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "$SONDE")
    if [ "$code" = "000" ] || [ "${code:0:1}" = "5" ]; then
      t_impact=$(date +%s)
      break
    fi
    sleep 1
  done

  # --- arreter le flood
  pkill wrk >/dev/null 2>&1
  sleep 1

  if [ -z "$t_impact" ]; then
    # le service a RESISTE (pas d'impact) -> c'est une bonne nouvelle !
    printf "%-6s %-22s %-18s %-12s\n" "$i" "aucun" "-" "RESISTANT"
    echo "$i;aucun;-;RESISTANT (service tenu)" >> "$CSV"
    sleep $PAUSE
    continue
  fi

  impact_delay=$(( t_impact - t0 ))

  # --- attendre la reprise (retour a 200)
  t_reprise=""
  for s in $(seq 1 $REPRISE_MAX); do
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "$SONDE")
    if [ "$code" = "200" ]; then
      t_reprise=$(date +%s)
      break
    fi
    sleep 1
  done

  if [ -z "$t_reprise" ]; then
    printf "%-6s %-22s %-18s %-12s\n" "$i" "$impact_delay" ">${REPRISE_MAX}" "PAS DE REPRISE"
    echo "$i;$impact_delay;>$REPRISE_MAX;PAS DE REPRISE AUTO" >> "$CSV"
  else
    mttr=$(( t_reprise - t_impact ))
    printf "%-6s %-22s %-18s %-12s\n" "$i" "$impact_delay" "$mttr" "OK reprise auto"
    echo "$i;$impact_delay;$mttr;OK reprise auto" >> "$CSV"
    sum_impact=$(( sum_impact + impact_delay ))
    sum_mttr=$(( sum_mttr + mttr ))
    nb_ok=$(( nb_ok + 1 ))
  fi

  sleep $PAUSE
done

echo "--------------------------------------------------------------"
if [ $nb_ok -gt 0 ]; then
  echo "  MOYENNE sur $nb_ok essais reussis :"
  echo "   - Temps avant impact moyen : $(( sum_impact / nb_ok )) s"
  echo "   - MTTR (reprise) moyen      : $(( sum_mttr / nb_ok )) s"
fi
echo "=============================================================="
echo "  Tableau enregistre dans : $CSV"
echo "  (ouvre-le dans un tableur pour le dossier)"
echo "=============================================================="
