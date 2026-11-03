# Tests JKD+

Petits programmes qui ouvrent `index.html` dans un navigateur invisible (Playwright + Chromium),
chargent une vraie sauvegarde et vérifient que tout s'affiche bien. Ils ne sont jamais chargés par l'appli.

Lancer avant chaque envoi : `sh tests/run.sh <sauvegarde JKD-SAVE.json>`

- `socle.cjs` : ouverture sans erreur sur L1 / L2 / LdC, récap, fiche d'un match, bilans, jeton GitHub conservé.
- `rappel.cjs` : rappel « mets à jour les cotes » sur le prochain match serré (rouge, ou orange avec moins de 2 pts d'écart), à moins d'1 h, cotes de plus d'1 h.
- `favori.cjs` : ligne « face au favori » des bilans, recalculée à part et comparée à l'affichage.

Aucune sauvegarde ni clé n'est mise dans le dépôt.
