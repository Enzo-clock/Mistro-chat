# 1er jour (27-10-2025)

- 10h30 : Figma terminé avec validation
- 10h30-11h : Syndrome de la page blanche, hésitation sur comment incorporer le html/css dans svelte.
- 12h : HTML et CSS quasi-terminés, reste à gérer le responsive mobile et quelques ajustements.
- Après-midi : Responsive mobile en colonne et peaufinage de l'alignement des divs

## 2eme jour (28-10-2025)

- Peaufinage aspect bouton Ask
- Tentative de parallèle avec le challenge localstorage (échec vu qu'on code en svelte)
- Echanges avec Mistral pour m'aider avec le fetch et la clé.
- Mise en place du bouton de validation du token
- Réponse en markdown

### 3eme jour (29-10-2025)

- Mise en place de pocketbase
- Gestion de l'envoi des messages et réponse et vérification du stockage dans pocketbase
- Historique au refresh
- Gestion du scroll to bot auto + à l'envoi d'une question.
- Test couleurs
- Peaufinage bouton token
- Spellcheck false sur les input textuels
  
#### 4eme jour (30-10-2025)

- Gestion du token pris en charge dans le localstorage pour éviter de relog à chaque refresh
- Mise en place des conversations et de la relation avec les messages
- Problèmes d'affichage quand je sélectionne des conversation, beaucoup d'ajouts de console.log pour comprendre le problème finalement résolu à cause d'un .objet.sort qui ne devait être qu'un .sort