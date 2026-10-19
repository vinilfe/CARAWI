# CARAWI — serveur en ligne

Serveur Node.js + WebSocket. Il garde toutes les mains : aucun joueur ne peut voir les cartes des autres.
Pas de compte nécessaire : les joueurs ouvrent l’adresse du serveur et entrent le code de la partie.

## Tester sur ton ordinateur
    npm install
    npm start
Ouvre http://localhost:3000 dans deux onglets (créer une partie dans l’un, rejoindre avec le code dans l’autre).

## Mettre en ligne (gratuit possible)
Il faut un hébergeur qui accepte les WebSocket et donne une adresse HTTPS : Render, Railway, Fly.io.
Exemple Render : nouveau « Web Service » depuis ce dossier (déposé sur GitHub), Build `npm install`, Start `npm start`.
(Un Dockerfile est aussi fourni.) Variable `PORT` : gérée par l’hébergeur.
Sur l’offre gratuite de Render, le serveur s’endort après un moment : le premier chargement peut prendre ~30 s.

## Android
1. Simple : ouvrir l’adresse HTTPS dans Chrome → menu ⋮ → « Ajouter à l’écran d’accueil ».
2. Vrai fichier APK : aller sur pwabuilder.com, entrer l’adresse HTTPS du serveur, choisir « Android » et télécharger le paquet.
   (Le Play Store demande un compte développeur payant ; l’APK peut aussi s’installer directement.)

## Remarques
- Un joueur qui se déconnecte reprend sa place en rouvrant la page (identifiant gardé sur le téléphone).
- Si le joueur dont c’est le tour est hors ligne, les autres peuvent passer son tour.
- Les parties vides sont supprimées après 2 h ; tout est en mémoire (un redémarrage efface les parties en cours).
