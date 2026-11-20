# QUIZ CHAMPION LIVE

Plateforme de jeu télévisé de culture générale en temps réel (inscription publique, régie administrateur sécurisée via **Supabase Auth**, écran Live et classement synchronisé avec **Supabase PostgreSQL + Supabase Realtime** et effets sonores Web Audio API).

## Configuration Supabase (Base, Realtime & Connexion Admin)

1. Créez un projet sur [Supabase](https://supabase.com).
2. Dans **SQL Editor → New query**, exécutez le script [`supabase/schema.sql`](./supabase/schema.sql) pour créer les tables (`competitions`, `participants`, `score_events`, `users`), les règles RLS de lecture publique et activer **Supabase Realtime**.
3. Dans **Authentication → Users → Add user**, créez votre compte administrateur (adresse e-mail + mot de passe) pour accéder à `/admin/login`.
4. Récupérez vos clés dans **Project Settings → API** et renseignez les variables d'environnement (`.env` en local ou **Settings → Environment Variables** sur Vercel) :
   - `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (connexion admin **Supabase Auth** & **Supabase Realtime** côté navigateur)
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` (vérification JWT admin & écriture sécurisée côté serveur)
   - `ADMIN_EMAIL` (optionnel : adresse(s) e-mail autorisée(s) séparées par des virgules)

## Démarrage en local

```bash
npm install
npm run dev
```

L'application démarre sur `http://localhost:3000`.

## Déploiement sur Vercel

Le dépôt inclut `vercel.json` et la fonction serverless `api/index.ts` :

1. Importer le dépôt Git sur **Vercel** (Framework Preset : *Vite*, Build Command : `npm run build`, Output Directory : `dist`).
2. Configurer les variables Supabase (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, et optionnellement `ADMIN_EMAIL`).
3. Déployer : les inscriptions, l'authentification régie et les scores fonctionnent en temps réel avec **Supabase**.
