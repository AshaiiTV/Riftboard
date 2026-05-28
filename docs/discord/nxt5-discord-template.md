# Template Discord NXT5

Ce document sert de blueprint pour creer un serveur Discord officiel NXT5 propre, premium et exploitable.

Important : Discord ne permet pas d'importer un fichier `.json` comme un template officiel depuis l'interface. Pour obtenir un vrai lien Discord Template, il faut creer un serveur, y appliquer cette structure, puis utiliser `Parametres du serveur > Template de serveur > Creer un template`.

Le fichier `nxt5-discord-template.json` contient la structure machine-readable pour une creation via bot/script.

## Import via bot Discord

Un script d'import est disponible ici :

```bash
DISCORD_BOT_TOKEN="token_du_bot" DISCORD_GUILD_ID="id_du_serveur" node tools/import-discord-template.mjs
```

Pre-requis :
- creer une application Discord Developer Portal ;
- creer un bot ;
- inviter le bot sur ton serveur avec les permissions de gestion des roles et salons ;
- copier l'ID du serveur Discord ;
- lancer la commande ci-dessus.

Le script cree les roles, categories, salons, forums et premiers messages de bienvenue/regles.

## Identite

Nom serveur : `NXT5 - Draft. Strategize. Win.`

Positionnement :
NXT5 est l'espace support et communaute pour les equipes League of Legends qui utilisent l'outil de draft, d'import, de stats, de rapports et de preparation.

Ton :
Premium, clair, esport, efficace. Pas de spam, pas de blabla inutile.

## Roles

- `NXT5 Staff` : administration complete.
- `Support` : support utilisateur, tri des bugs, moderation.
- `Coach` : coachs utilisateurs de NXT5.
- `Capitaine` : capitaines d'equipe.
- `Joueur` : joueurs.
- `Beta Tester` : utilisateurs qui testent les nouvelles features.
- `Membre` : acces standard.
- `Non verifie` : arrivee, acces limite.

## Categories et salons

### START

`#bienvenue`

Message :
```text
Bienvenue sur NXT5.

NXT5 est un outil pour les equipes League of Legends qui veulent importer leurs games, lire leurs statistiques, preparer leurs compos et mieux structurer leurs reviews.

Commence par lire #regles, puis ouvre #guide-demarrage si tu veux configurer ton equipe.
```

`#regles`

Message :
```text
Regles NXT5

1. Reste respectueux avec les joueurs, coachs et membres du staff.
2. Ne publie pas de donnees privees, de tokens, de cles API ou d'informations sensibles.
3. Les reports de bugs doivent etre precis et exploitables.
4. Le serveur sert a ameliorer NXT5, pas a regler des conflits d'equipe.
5. Tout abus, spam ou comportement malveillant peut mener a une exclusion.
```

`#annonces`

Pour les annonces importantes : nouvelles versions, changement critique, maintenance.

`#changelog`

Format conseille :
```text
Version :
Date :

Ajoute :
- ...

Corrige :
- ...

Ameliore :
- ...
```

`#statut-nxt5`

Pour les incidents, maintenances, lenteurs, soucis Netlify/DB/API.

### GUIDES

`#guide-demarrage`

Contenu :
```text
Demarrage rapide NXT5

1. Cree ton compte.
2. Cree ou rejoins une equipe.
3. Ajoute tes profils joueurs dans Gestion.
4. Lie les comptes aux profils.
5. Configure les champion pools.
6. Importe tes games via NXT5 Importer.
7. Lis les stats, cree des groupes de games et redige tes rapports.
```

`#guide-importer`

Contenu :
```text
Importer une game

Pre-requis :
- L'application NXT5 Importer doit etre lancee sur le PC ou le client League of Legends est installe.
- La game doit etre presente dans l'historique du client.

Etapes :
1. Ouvre NXT5 Importer.
2. Colle le Game ID.
3. Selectionne la region si necessaire.
4. Genere le JSON.
5. Retourne sur NXT5 > Integration.
6. Importe le JSON.
7. Choisis ton equipe, assigne les champions aux profils, puis confirme.
```

`#guide-statistiques`

Contenu :
```text
Statistiques

La page Statistiques permet de lire :
- les games importees ;
- les groupes de games ;
- les stats par profil ;
- les champions joues ;
- les matchups ;
- les items, sorts et donnees detaillees d'une game.

Pour analyser un scrim complet, cree un groupe de games et selectionne uniquement les games du bloc.
```

`#guide-rapports`

Contenu :
```text
Rapports

Un rapport sert a lier une ou plusieurs games a des notes staff.

Commandes utiles :
/TEAM KDA
/TEAM DAMAGE
/TEAM VISION
/TEAM GOLD
/TEAM KP
/KDA "ADC"
/DAMAGE "MID"
/VISION "SUP"
/GOLD "JGL"
/KP "TOP"

NXT5 affiche les donnees. L'interpretation reste au coach, capitaine et joueurs.
```

`#guide-compos-types`

Contenu :
```text
Compos Types

Cette page sert a preparer des compos par poste depuis les champion pools des joueurs.

Conseils :
- Cree des compos par side si besoin.
- Utilise les tags pour retrouver vite les identites de draft.
- Verifie les niveaux de maitrise avant de valider une compo.
```

### SUPPORT NXT5

`#support` en forum.

Tags :
- `Compte`
- `Equipe`
- `Import`
- `Stats`
- `Rapports`
- `Autre`

`#bug-report` en forum.

Template de post :
```text
Page concernee :
Action realisee :
Message d'erreur exact :
Ce qui etait attendu :
Screen ou video :
Compte / equipe concernee si utile :
```

Tags :
- `Critique`
- `Import`
- `UI`
- `Mobile`
- `Stats`
- `Compte`

`#suggestions` en forum.

Template :
```text
Probleme a resoudre :
Feature souhaitee :
Pourquoi c'est utile pour une equipe :
Priorite ressentie :
```

### COMMUNAUTE

`#discussion`

Discussion generale autour de NXT5.

`#screenshots`

Partage de screens, bugs visuels, retours de DA.

`#retours-utilisateurs`

Forum pour les retours d'experience.

### STAFF ONLY

Categorie privee pour `NXT5 Staff` et `Support`.

Salons :
- `#staff-chat`
- `#incidents`
- `#roadmap`
- `#moderation`

## Permissions conseillees

`Non verifie` :
- voir uniquement `#bienvenue` et `#regles`.

`Membre` :
- lire START, GUIDES, SUPPORT, COMMUNAUTE.
- ecrire dans support, bug-report, suggestions, discussion.

`Beta Tester` :
- acces identique membre + salons beta si ajoutes plus tard.

`Support` :
- gerer messages dans SUPPORT.
- creer threads publics/prives.
- voir STAFF ONLY.

`NXT5 Staff` :
- administration complete.

## Prochaine etape

1. Cree un serveur Discord vide.
2. Reproduis la structure ci-dessus ou applique le JSON via un bot.
3. Va dans `Parametres du serveur > Template de serveur`.
4. Cree le template officiel.
5. Donne-moi le lien Discord final pour que je l'ajoute dans la page Contact NXT5.
