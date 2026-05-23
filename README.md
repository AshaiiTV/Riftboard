# NXT5 — Netlify + Neon

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

Lis `README_GIT.md` si tu veux connecter NXT5 à GitHub puis à Netlify.
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
RIOT_PROFILE_SYNC_MAX_MATCHES=300
PUBLIC_SITE_URL=https://ton-site.netlify.app
RESEND_API_KEY=re_...
RESET_EMAIL_FROM=NXT5 <noreply@ton-domaine.fr>
```

`DATABASE_URL` vient de Neon. Prends l'URL poolée si Neon la propose.
`RIOT_PROFILE_SYNC_MAX_MATCHES` est optionnel. Il limite le nombre de matchs scannés par profil quand le bouton "Analyser profils" recalcule les champions joués sur la saison courante.
`RESEND_API_KEY` et `RESET_EMAIL_FROM` servent à envoyer les e-mails de mot de passe oublié. Le domaine utilisé dans `RESET_EMAIL_FROM` doit être validé dans Resend.

Pour générer des codes tournoi directement depuis NXT5, ajoute aussi au choix :

```txt
RIOT_TOURNAMENT_ID=...
```

ou :

```txt
RIOT_TOURNAMENT_CALLBACK_URL=https://ton-site.netlify.app/.netlify/functions/riot-tournament-callback
RIOT_TOURNAMENT_NAME=NXT5 Scrims
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

## Import local NXT5

Si tu veux préparer un import sans coller de clé Riot dans un outil local, tu peux générer un JSON complet depuis un Game ID.

Colle un Game ID du type `EUW1_7123456789`. L'outil demande les données à NXT5 côté serveur et génère un fichier `nxt5-...json` contenant le match Riot complet. Il ne demande aucune clé Riot.

Dans NXT5 : Intégration → Importer un fichier NXT5 local → Choisir le JSON.

NXT5 importe ensuite ce JSON local sans avoir besoin de relire Riot. Un code tournoi seul ne suffit pas dans ce mode : il faut l'accès Riot `Match by tournament code`, ou le Game ID final.

## Application NXT5 Importer

Le dossier `importer-app` contient une vraie application desktop NXT5 Importer qui génère un JSON complet depuis un Game ID.

À chaque push qui modifie `importer-app`, GitHub Actions lance `Build NXT5 Importer` et génère les fichiers Windows et Mac :

```txt
NXT5-Importer-Windows-0.1.0.exe
NXT5-Importer-Mac-x64-0.1.0.zip
NXT5-Importer-Mac-arm64-0.1.0.zip
```

L'utilisation est simple :

1. Ouvre `NXT5 Importer`.
2. Colle le Game ID, exemple `7861632138`, puis choisis la région.
3. Ajoute un nom d'import ou un adversaire si besoin.
4. Clique sur `Générer le JSON complet`.
5. Dans NXT5, va dans `Intégration` puis `Importer un fichier NXT5 local`.

## Important

Le front ne stocke aucune donnée métier en localStorage. Les données importantes passent par Neon. La clé Riot n'est jamais exposée côté navigateur.


## Connexion à la base de données

Pour créer un compte, Netlify doit avoir la variable d’environnement `DATABASE_URL`, et le fichier `database/schema.sql` doit avoir été exécuté dans Neon. Sans ça, NXT5 ne stocke rien en local et l’inscription restera désactivée.
