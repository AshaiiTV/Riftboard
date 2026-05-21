# NXT5 — Déploiement Netlify sans Git

Tu n'as pas besoin de GitHub.

## Méthode Windows simple

1. Dézippe le dossier.
2. Ouvre le dossier `nxt5-netlify`.
3. Double-clique sur :

```txt
DEPLOY_NO_GIT_WINDOWS.bat
```

Le script va :

```txt
- vérifier Node.js
- installer les dépendances
- te connecter à Netlify
- lancer le build
- déployer le site + les Netlify Functions
```

Quand Netlify te pose une question :

```txt
Si ton site existe déjà : Link this directory to an existing site
Si tu veux en créer un nouveau : Create and configure a new site
```

## Variables obligatoires dans Netlify

Dans Netlify :

```txt
Site configuration → Environment variables
```

Ajoute :

```txt
DATABASE_URL=postgresql://...
RIOT_API_KEY=RGAPI-...
SESSION_SECRET=une_phrase_longue_random
APP_ENV=production
PUBLIC_SITE_URL=https://ton-site.netlify.app
RESEND_API_KEY=re_...
RESET_EMAIL_FROM=NXT5 <noreply@ton-domaine.fr>
```

Les trois variables `PUBLIC_SITE_URL`, `RESEND_API_KEY` et `RESET_EMAIL_FROM` servent aux e-mails de mot de passe oublié. Le domaine de l'adresse `RESET_EMAIL_FROM` doit être validé dans Resend.

## Neon

Dans Neon, ouvre l'éditeur SQL et exécute :

```txt
database/schema.sql
```

## Important

Le drag & drop Netlify n'est pas adapté pour cette version complète, parce que NXT5 utilise :

```txt
- React/Vite à build
- Netlify Functions
- Neon
- Auth serveur
- Riot API côté serveur
```

La méthode sans Git propre est donc :

```txt
Netlify CLI
```


## Correctif inclus

Cette version épingle Tailwind en `3.4.17` pour éviter l'erreur Netlify : `trying to use tailwindcss directly as a PostCSS plugin`.


## Invitations de team

Chaque team créée reçoit automatiquement un code d'invitation `RIFT-XXXXXX`.
Dans l'interface, le bouton **Copier le lien** génère un lien du type :

```txt
https://ton-site.netlify.app/creer-un-compte?invite=RIFT-XXXXXX
```

Un utilisateur peut ouvrir ce lien, créer/se connecter à son compte, puis rejoindre la team depuis l'onglet **Teams**.


## Si une erreur serveur apparaît à la création du compte

Vérifie dans Netlify que `DATABASE_URL` est bien présent dans **Site configuration → Environment variables**, puis exécute `database/schema.sql` dans Neon. Sans ça, l’authentification serveur ne peut pas écrire le compte en base.


## Erreur “base de données” sur inscription/connexion

Si le formulaire affiche que la création de compte n’est pas encore active, ce n’est pas un bug de page : Netlify ne voit pas encore la variable `DATABASE_URL`.

À faire dans Netlify :

1. Va dans **Site configuration**.
2. Ouvre **Environment variables**.
3. Ajoute `DATABASE_URL` avec l’URL de connexion Neon.
4. Relance un déploiement Netlify.
5. Dans Neon, exécute `database/schema.sql` une fois.

Sans `DATABASE_URL`, le site ne peut pas créer de compte, car NXT5 ne stocke rien en local.
