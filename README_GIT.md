# NXT5 - Passage a GitHub

Ce dossier peut etre suivi par Git sans ajouter les fichiers sensibles.

## Option simple avec GitHub Desktop

1. Installe GitHub Desktop : https://desktop.github.com/
2. Ouvre GitHub Desktop.
3. Choisis `File > Add local repository`.
4. Selectionne ce dossier :

```txt
C:\Users\sacha\Documents\Codex\NXT5
```

5. Si GitHub Desktop propose de creer un repository, accepte.
6. Fais le premier commit avec le message :

```txt
Initial NXT5 Netlify app
```

7. Clique sur `Publish repository`.
8. Garde le depot en prive au debut.

## Option terminal

Depuis ce dossier :

```bash
git init
git branch -M main
git add .
git commit -m "Initial NXT5 Netlify app"
git remote add origin https://github.com/TON_COMPTE/nxt5.git
git push -u origin main
```

Remplace `TON_COMPTE` par ton nom GitHub.

## A ne jamais mettre dans Git

Ces fichiers sont ignores par `.gitignore` :

```txt
.env
.env.local
.env.production
node_modules/
dist/
.netlify/
```

Les vraies variables doivent rester dans Netlify :

```txt
DATABASE_URL=postgresql://...
RIOT_API_KEY=RGAPI-...
SESSION_SECRET=une_phrase_longue_random_64_caracteres_minimum
APP_ENV=production
```

## Connexion Netlify a GitHub

Une fois le depot publie :

1. Va sur Netlify.
2. Ouvre ton site NXT5.
3. Va dans `Site configuration > Build & deploy`.
4. Connecte le site au repository GitHub.
5. Verifie les reglages :

```txt
Build command: npm run build
Publish directory: dist
Functions directory: netlify/functions
```

Le fichier `netlify.toml` contient deja ces reglages.

## Avant chaque envoi

```bash
npm install
npm run build
git status
```

Si `npm run build` passe, tu peux commit et push.
