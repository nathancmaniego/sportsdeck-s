# SportsDeck

Next.js app with PostgreSQL (Prisma), Docker for local development, and [Vercel](https://vercel.com) for free hosting.

## Run locally with Docker (grading / TA)

From the `sportsdeck` directory:

1. Copy environment template and edit values (API keys, secrets):

   ```bash
   cp .env.example .env
   ```

2. Start Postgres and the app:

   ```bash
   docker compose up --build
   ```

3. Open [http://localhost:3000](http://localhost:3000).

The app container runs migrations, seeds the database, then starts the dev server (`startup.sh`). The compose file overrides `DATABASE_URL` so the app uses the `db` service; other variables are read from `.env`.

## Run locally without Docker

Requires Node 20+ and a PostgreSQL instance. Set `DATABASE_URL` in `.env`, then:

```bash
npm install
npx prisma migrate deploy
npm run seed
npm run dev
```

## Deploy to Vercel (free tier)

1. **Database** — Vercel does not run Postgres for you. Create a free PostgreSQL database (for example [Neon](https://neon.tech) or [Supabase](https://supabase.com)) and copy its connection string.

2. **Import the project** — In [Vercel](https://vercel.com/new), import this Git repository. If the repo root is above `sportsdeck`, set **Root Directory** to `sportsdeck`.

3. **Environment variables** — In the project **Settings → Environment Variables**, add (at least for **Production**; add **Preview** too if you use preview deployments):

   | Name | Notes |
   |------|--------|
   | `DATABASE_URL` | Postgres URL from Neon/Supabase (often needs `?sslmode=require`) |
   | `JWT_SECRET` | Long random string |
   | `FOOTBALL_DATA_API_KEY` | From [football-data.org](https://www.football-data.org/) |
   | `HUGGINGFACE_API_KEY` | If you use Hugging Face features |
   | `NEXT_PUBLIC_APP_URL` | Your live URL, e.g. `https://your-project.vercel.app` (no trailing slash) |
   | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional; if using Google sign-in, add the production redirect URI in Google Cloud: `https://YOUR_DOMAIN/api/auth/oauth/google/callback` |

4. **Deploy** — Push to the connected branch or click Deploy. The build runs `prisma migrate deploy` then `next build` (see `vercel.json`).

5. **Seed (once)** — After the first successful deploy, populate data from your machine (with production `DATABASE_URL` in the environment or a pulled `.env`):

   ```bash
   cd sportsdeck
   DATABASE_URL="postgresql://..." npm run seed
   ```

`postinstall` runs `prisma generate` so the Prisma client is generated on Vercel; `schema.prisma` includes binary targets for Docker (Alpine) and Vercel.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build (no migrate; use Vercel build or run `prisma migrate deploy` yourself) |
| `npm run start` | Start production server after `build` |
| `npm run seed` | Seed database |
