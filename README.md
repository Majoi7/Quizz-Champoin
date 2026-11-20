# QUIZ CHAMPION LIVE

Plateforme de jeu télévisé de culture générale en temps réel (inscription publique, régie administrateur, écran Live et classement synchronisé avec effets sonores Web Audio API).

## Démarrage en local

```bash
npm install
npm run dev
```

L'application démarre sur `http://localhost:3000` avec Express + WebSockets (`/ws`) + SQLite (`./data/quiz.sqlite`).

## Variables d'environnement

Copier `.env.example` vers `.env` pour personnaliser les accès régie :

- `ADMIN_EMAIL` : e-mail de connexion à la régie
- `ADMIN_NAME` : nom affiché dans l'historique des opérations
- `ADMIN_PASSCODE` : mot de passe / code d'accès de la régie
- `SQLITE_PATH` *(optionnel)* : chemin personnalisé du fichier SQLite

## Déploiement sur Vercel

Le dépôt inclut `vercel.json` et la fonction serverless `api/index.ts` :

1. Importer le dépôt Git sur **Vercel** (Framework Preset : *Vite*, Build Command : `npm run build`, Output Directory : `dist`).
2. Configurer les variables d'environnement dans **Settings → Environment Variables** (`ADMIN_EMAIL`, `ADMIN_PASSCODE`, `ADMIN_NAME`).
3. Déployer :
   - Les routes `/api/*` sont servies par `api/index.ts`.
   - Les routes publiques et régie (`/`, `/live`, `/inscription`, `/classement`, `/admin/*`) sont routées vers la SPA.
   - En environnement serverless (sans WebSocket persistant), la synchronisation temps réel bascule automatiquement sur un rafraîchissement HTTP haute fréquence (`/api/state`).
