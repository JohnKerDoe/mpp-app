#!/bin/sh
# Relance tous les tests JKD+ avant un envoi sur GitHub.
# Usage : sh tests/run.sh <sauvegarde.json>   (une sauvegarde JKD-SAVE exportée depuis Réglages)
# La sauvegarde n'est jamais mise dans le dépôt.
[ -f "$1" ] || { echo "Donne le chemin d'une sauvegarde JKD-SAVE .json"; exit 2; }
cd "$(dirname "$0")/.." || exit 2
st=0
for t in tests/*.cjs; do echo "== $t"; node "$t" "$1" || st=1; done
[ $st = 0 ] && echo "== Tous les tests sont bons" || echo "== AU MOINS UN TEST A ÉCHOUÉ : ne pas envoyer"
exit $st
