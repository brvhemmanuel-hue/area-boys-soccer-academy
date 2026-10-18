# Club Manager – football team management

React (Vite) frontend · Vercel serverless API (`/api`) · Neon Postgres.

**Features:** admin login · member registration (position, jersey, status) · club activities with funding targets ·
contributions per member per activity (cash / mobile money / bank) · fixtures & results · expenses · dashboard with club balance,
monthly trend, top contributors, W/D/L record, next match · search, filters, CSV export, dark mode.

## Database
`database/schema.sql` contains all tables - paste it into Neon's **SQL Editor** and run it once (optional `database/seed.sql` adds sample data).
The app also creates the tables automatically on first sign-in, so this step is optional.

## Deploy
1. **Neon:** create a project at neon.tech and copy the connection string.
2. **Push** this folder to a GitHub repo and import it in Vercel (framework preset: Vite).
3. In Vercel > Settings > Environment Variables add: `DATABASE_URL`, `ADMIN_PASSWORD`, `AUTH_SECRET` (see `.env.example`).
4. Deploy. Tables are created automatically on the first sign-in.

## Local
```
npm i -g vercel && npm install
cp .env.example .env   # fill in values
vercel dev
```
Change the currency in `src/App.jsx` (`CUR`).

## Make it a mobile app (PWA Builder)
1. Deploy to Vercel (HTTPS is required).
2. Open https://www.pwabuilder.com, paste your Vercel URL and press Start.
3. The manifest, icons and service worker are already included, so the checks should pass.
4. Click **Package for stores** and choose Android (Google Play / APK) or iOS.
Users can also tap **Install app** in the side menu, or "Add to Home Screen" in the browser.
