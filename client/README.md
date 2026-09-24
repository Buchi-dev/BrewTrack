# BrewTrack frontend

React 19 + Vite, Tailwind CSS 4, and shadcn/ui using Base UI and the Nova preset.

## Run locally

```powershell
npm install
npm run dev
```

Vite prints the local URL (normally http://localhost:5173).

## Supabase

Use the existing `.env`, or copy `.env.example` to `.env.local` and fill in
`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from your project's Connect
panel. `.env.local` takes precedence over `.env`. Restart Vite after changes.
Use a publishable key in the frontend, never a secret or service-role key.

```js
import { createClient } from '@/lib/client'

const supabase = createClient()
```

The browser helper reuses the Supabase browser client. It is ready for Auth,
database queries, Storage, and Realtime. Database access requires tables,
grants, and Row Level Security policies appropriate to your application.

The installed `@supabase/supabase-client-react-router` registry also supplies
`src/lib/server.js`. This is reserved for a future React Router server runtime;
do not import it into browser components. This project currently uses a Vite SPA,
so server rendering and React Router routes are not configured.

Before adding email or OAuth login, configure the site URL and allowed redirect
URLs in Supabase Authentication > URL Configuration for local and production use.

## Add UI components

```powershell
npx shadcn@latest add button
```

`components.json` generates JavaScript components. The `@/` alias points to `src/`
in both Vite and the editor. Tailwind 4 uses the Vite plugin and CSS configuration;
it does not need a `tailwind.config.js` file.

## Verify

```powershell
npm run lint
npm run build
npm run supabase:check
```

The Supabase check makes read-only requests to Auth settings and a nonexistent
Data API table. The expected missing-table response confirms that the public key
reaches the API; it does not verify access to application tables, table policies,
or a complete sign-in flow. Pass `-- production` to check production env files.

References: [shadcn Vite setup](https://ui.shadcn.com/docs/installation/vite),
[Supabase React setup](https://supabase.com/docs/guides/getting-started/quickstarts/reactjs).
