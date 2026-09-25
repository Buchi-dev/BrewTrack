# BrewTrack Project Context

Use this file as the first-stop map for the BrewTrack codebase. For routine tasks, refer to this structure before scanning the repository. Only re-scan directories when the task specifically needs fresh file discovery, exact line references, or confirmation that this map is stale.

## Project Summary

BrewTrack is a React + Vite attendance and workforce verification app for staff and managers. The frontend lives in `client/` and talks to Supabase through service modules. Database schema changes and Supabase configuration live in `supabase/`.

## Repository Tree

```text
BrewTrack/
  context.md
  PLAN.md
  client/
    .env
    .env.example
    eslint.config.js
    index.html
    package.json
    package-lock.json
    README.md
    vite.config.js
    public/
      favicon.svg
      icons.svg
    src/
      App.jsx
      index.css
      main.jsx
      app/
        App.jsx
        theme.js
      assets/
        BigBrew_Brown.png
        BigBrew_Dark.png
        BigBrew_icon-only.png
      config/
        env.js
      constants/
        brand.js
        roles.js
        routes.js
        settings.js
      features/
        auth/
          authContext.js
          AuthProvider.jsx
          LoginPage.jsx
          ResetPasswordPage.jsx
      hooks/
        useAuth.js
      layouts/
        AppLayout.jsx
        AuthLayout.jsx
      lib/
        supabaseClient.js
      pages/
        manager/
          ManagerAttendancePage.jsx
          ManagerBranchesPage.jsx
          ManagerDashboardPage.jsx
          ManagerEmployeesPage.jsx
          ManagerReportsPage.jsx
          ManagerSettingsPage.jsx
        shared/
          EmptyState.jsx
          NotFoundPage.jsx
          PageHeader.jsx
          UnauthorizedPage.jsx
        staff/
          StaffAttendancePage.jsx
          StaffHistoryPage.jsx
          StaffHomePage.jsx
          StaffProfilePage.jsx
      router/
        AppRouter.jsx
        ProtectedRoute.jsx
        RoleRedirect.jsx
      services/
        attendanceService.js
        authService.js
        managerService.js
        profileService.js
      utils/
        date.js
  supabase/
    config.toml
    migrations/
      20260924095205_remote_baseline.sql
      20260925182000_milestone_2_database.sql
```

## Folder Responsibilities

- `client/`: The complete frontend app. Run app, build, lint, and dependency commands from here.
- `client/public/`: Static browser assets served by Vite.
- `client/src/`: Main React application source.
- `client/src/app/`: Root app composition and Ant Design theme setup.
- `client/src/assets/`: Brand image assets used by the UI.
- `client/src/config/`: Environment variable reading and app configuration helpers.
- `client/src/constants/`: Shared constants for brand text, roles, routes, and setting keys.
- `client/src/features/auth/`: Authentication context, provider, login page, and password reset page.
- `client/src/hooks/`: Shared React hooks.
- `client/src/layouts/`: Page shells for authenticated and unauthenticated sections.
- `client/src/lib/`: Third-party client setup, currently the Supabase browser client.
- `client/src/pages/manager/`: Manager-facing route pages.
- `client/src/pages/staff/`: Staff-facing route pages.
- `client/src/pages/shared/`: Reusable page-level UI and error/empty states.
- `client/src/router/`: Route tree, protected route guard, and role-based redirect logic.
- `client/src/services/`: Supabase-facing business/data access functions.
- `client/src/utils/`: Shared formatting and utility helpers.
- `supabase/`: Supabase local config and SQL migrations.
- `supabase/migrations/`: Reproducible database migration files.

## Important Entry Points

- `client/src/main.jsx`: Browser entry point that mounts React.
- `client/src/app/App.jsx`: Wraps the app in Ant Design and authentication providers.
- `client/src/router/AppRouter.jsx`: Main route table for auth, staff, manager, and fallback routes.
- `client/src/features/auth/AuthProvider.jsx`: Auth/session state boundary.
- `client/src/lib/supabaseClient.js`: Supabase client initialization.
- `client/src/services/*.js`: Data access layer for auth, profiles, attendance, and manager workflows.
- `client/src/index.css`: Global styling.

## Frontend Stack

- React 19
- Vite 8
- JavaScript modules
- Ant Design
- React Router
- Supabase JavaScript SDK
- ESLint

## Common Commands

Run these from `client/`:

```text
npm install
npm run dev
npm run build
npm run lint
npm run preview
```

## AI Usage Notes

When starting a new task, use this file as the project map:

```text
Refer to context.md for the codebase structure. Do not re-scan the whole repository unless the task requires fresh discovery or exact current file contents.
```

For implementation work, inspect only the files directly related to the requested change. For example:

- Auth changes usually involve `features/auth/`, `hooks/useAuth.js`, `router/`, `services/authService.js`, and `services/profileService.js`.
- Staff page changes usually involve `pages/staff/`, `services/attendanceService.js`, and shared layout/page components.
- Manager page changes usually involve `pages/manager/`, `services/managerService.js`, and shared layout/page components.
- Supabase/database changes usually involve `supabase/migrations/`, `client/src/lib/supabaseClient.js`, and the relevant service modules.
