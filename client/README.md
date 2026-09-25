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

Backend handlers can use `@supabase/server` with `SUPABASE_URL`,
`SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, and `SUPABASE_JWKS_URL`.
Keep `SUPABASE_SECRET_KEY` server-only and paste the real value into local or
hosting-provider environment settings, not into browser-exposed `VITE_*` values.

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
npm run test:schedule
npm run supabase:check
```

The Supabase check makes read-only requests to Auth settings and a nonexistent
Data API table. The expected missing-table response confirms that the public key
reaches the API; it does not verify access to application tables, table policies,
or a complete sign-in flow. Pass `-- production` to check production env files.

## Daily station schedules

Apply all files in `supabase/migrations` in order before running this client
against a real workspace. The daily station assignment migration renames existing
locations to `stations` while preserving IDs, employee accounts, manager access,
and attendance evidence. Deploy the migration together with this client update;
the previous client uses the previous table names.

Managers use **Daily schedule** to choose a date and assign each employee a
station and one role: Cook, Barista, Cashier (OTD), or Trainee. Staffing summaries
show missing core roles and the usual 3–4 staff pattern without enforcing a hard
capacity. Nothing automatically rotates or copies assignments to another day.

An employee's home station controls manager access; it does not determine their
daily station or role. A manager must have access to both the employee's home
station and the destination station. Administrators maintain this access in
`manager_stations`. Staff can view their own assignments in **My schedule**.

Dates use Asia/Manila time. Past assignments and any assignment with attendance
are locked; other dates can be edited or removed. Changes are audited. Clock-in
requires today's assignment and records its station and role. Clock-out keeps
the clock-in assignment. Existing attendance keeps its original station and
shows “Role not recorded” when no historical role is known. No historical
schedules or work roles are invented during migration.

The schedule tests run both migrations in an isolated PGlite PostgreSQL database
with Auth/Storage schema stubs, then verify permissions, date independence,
duplicate prevention, capture validation, audit history, and clock-in/out. This
does not replace a hosted Supabase Auth/Storage integration test.

References: [shadcn Vite setup](https://ui.shadcn.com/docs/installation/vite),
[Supabase React setup](https://supabase.com/docs/guides/getting-started/quickstarts/reactjs).
