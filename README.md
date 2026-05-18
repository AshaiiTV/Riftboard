# RiftBoard — Netlify + Neon

Dashboard premium d'analyse LoL pour équipes semi-pro.

## Stack

- React + Vite
- Tailwind CSS
- Netlify Hosting
- Netlify Functions
- Neon PostgreSQL
- Riot Match-V5 + Tournament-V5 API côté serveur
- Auth par cookie HttpOnly + sessions en DB

## Installation locale

```bash
npm install
npm run dev
```

## Passage à GitHub

Lis `README_GIT.md` si tu veux connecter RiftBoard à GitHub puis à Netlify.
Le dépôt est préparé pour éviter d'envoyer les secrets (`.env`, clés Riot, URL Neon).

## Déploiement Netlify

Tu peux uploader ce dossier sur Netlify ou le connecter à GitHub.

Netlify doit utiliser :

```txt
Build command: npm run build
Publish directory: dist
Functions directory: netlify/functions
```

Le fichier `netlify.toml` est déjà configuré.

## Variables d'environnement Netlify

Dans Netlify : Site configuration → Environment variables.

```txt
DATABASE_URL=postgresql://...
RIOT_API_KEY=RGAPI-...
SESSION_SECRET=une_phrase_longue_random_64_caracteres_minimum
APP_ENV=production
```

`DATABASE_URL` vient de Neon. Prends l'URL poolée si Neon la propose.

Pour générer des codes tournoi directement depuis RiftBoard, ajoute aussi au choix :

```txt
RIOT_TOURNAMENT_ID=...
```

ou :

```txt
RIOT_TOURNAMENT_CALLBACK_URL=https://ton-site.netlify.app/.netlify/functions/riot-tournament-callback
RIOT_TOURNAMENT_NAME=RiftBoard Scrims
```

Sans ces variables Tournament-V5, la page Codes Tournoi fonctionne quand même en ajout manuel de codes.

## Neon

Dans Neon, exécute le script :

```txt
database/schema.sql
```

Il crée toutes les tables nécessaires : users, sessions, teams, players, matches, match_participants, champion_pool, improvements, reports, composition_types, tournament_codes, audit_logs.

## Test rapide

1. Crée un compte.
2. Crée ou sélectionne une team.
3. Ajoute un joueur avec son Riot ID exact, exemple : `Ashaii#8942`.
4. Importe une game où ce joueur était présent, exemple : `EUW1_7123456789`.
5. Va dans Reviews, Champion Pool, Compos Types et Rapports.

## Important

Le front ne stocke aucune donnée métier en localStorage. Les données importantes passent par Neon. La clé Riot n'est jamais exposée côté navigateur.


## Connexion à la base de données

Pour créer un compte, Netlify doit avoir la variable d’environnement `DATABASE_URL`, et le fichier `database/schema.sql` doit avoir été exécuté dans Neon. Sans ça, RiftBoard ne stocke rien en local et l’inscription restera désactivée.
