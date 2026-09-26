# BrewTrack Project Context

Use this file as the first-stop map for the BrewTrack codebase. For routine tasks, read this before scanning the repository. Re-scan directories only when the task needs exact current contents, line references, or confirmation that this map has drifted.

## Project Summary

BrewTrack is a React + Vite attendance and workforce verification app for BigBrew-style station operations. Staff members use it to view today's station assignment, clock in/out with a camera selfie, and review attendance history. Managers use it to monitor attendance, manage staff/stations, build station schedules, inspect audit logs, and adjust operational settings.

The frontend lives in `client/`. Supabase configuration and reproducible database changes live in `supabase/`.

## Current Architecture

- Frontend: React 19, Vite 8, JavaScript modules, Ant Design 6, React Router 7, Supabase JS SDK.
- Backend: Supabase Auth, Postgres tables, RLS policies, storage bucket policies, and RPC functions defined through SQL migrations.
- Authentication model: Supabase Auth session plus a `profiles` row. The profile contains app role and account status.
- Roles: `manager` and `staff`.
- Main timezone assumption: `Asia/Manila`.
- Attendance evidence: private Supabase Storage bucket named `attendance-selfies`, using deterministic JPEG paths.

## Repository Tree

```text
BrewTrack/
  context.md
  PLAN.md
  client/
    index.html
    package.json
    package-lock.json
    README.md
    eslint.config.js
    vite.config.js
    public/
      favicon.svg
      icons.svg
    src/
      main.jsx
      App.jsx
      index.css
      app/
        App.jsx
        theme.js
      assets/
        BigBrew_Brown.png
        BigBrew_Dark.png
        BigBrew_icon-only.png
      components/
        EmptyState.jsx
        NotFoundPage.jsx
        PageHeader.jsx
        UnauthorizedPage.jsx
      config/
        env.js
      constants/
        brand.js
        roles.js
        routes.js
        settings.js
      features/
        attendance/
          AttendanceCamera.jsx
          AttendanceFlowModal.jsx
        auth/
          authContext.js
          AuthProvider.jsx
          LoginPage.jsx
          ResetPasswordPage.jsx
        manager/
          ManagerAttendancePage.jsx
          ManagerAuditPage.jsx
          ManagerBranchesPage.jsx
          ManagerDashboardPage.jsx
          ManagerEmployeesPage.jsx
          ManagerReportsPage.jsx
          ManagerSchedulesPage.jsx
          ManagerSettingsPage.jsx
        staff/
          StaffHistoryPage.jsx
          StaffHomePage.jsx
          StaffProfilePage.jsx
      hooks/
        useAuth.js
      layouts/
        AppLayout.jsx
        AuthLayout.jsx
      lib/
        supabaseClient.js
      router/
        AppRouter.jsx
        ProtectedRoute.jsx
        RoleRedirect.jsx
      services/
        attendanceService.js
        authService.js
        profileService.js
        query.js
        manager/
          attendanceRecordsService.js
          auditService.js
          branchService.js
          dashboardService.js
          employeeService.js
          index.js
          stationScheduleService.js
      utils/
        date.js
        image.js
  supabase/
    config.toml
    migrations/
      20260926010000_initial_schema.sql
      20260926013000_clock_in_from_station_schedule.sql
      20260926014000_allow_staff_station_reads_for_attendance.sql
```

## Folder Responsibilities

- `client/`: Complete frontend app. Run app, build, lint, dependency, and preview commands from this folder.
- `client/public/`: Static Vite assets.
- `client/src/main.jsx`: Browser mount point.
- `client/src/app/`: Root app composition and Ant Design theme setup.
- `client/src/assets/`: BigBrew brand images used in layouts and auth screens.
- `client/src/config/`: Environment variable reads. Supabase needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- `client/src/constants/`: Shared route, role, brand, and settings constants.
- `client/src/components/`: Shared UI blocks used across route pages.
- `client/src/features/attendance/`: Camera capture, watermarking, selfie review, clock-in/clock-out modal flow.
- `client/src/features/auth/`: Login, password reset, auth context, profile restoration.
- `client/src/features/manager/`: Manager pages for dashboard, attendance, schedules, employees, stations, reports, audit, and settings.
- `client/src/features/staff/`: Staff pages for today, history, and profile.
- `client/src/hooks/`: Shared hooks, currently auth context access.
- `client/src/layouts/`: Authenticated app shell and auth shell.
- `client/src/lib/`: Third-party clients, currently Supabase browser client.
- `client/src/router/`: Route table, role guard, and default role redirect.
- `client/src/services/`: Supabase-facing service layer for auth, profiles, attendance, and shared query helpers.
- `client/src/services/manager/`: Manager-facing data access split by domain.
- `client/src/utils/`: Shared formatting and image helpers.
- `supabase/`: Supabase local config and migrations.
- `supabase/migrations/`: Database schema, RLS, storage, and RPC function migrations.

## Important Entry Points

- `client/src/app/App.jsx`: Wraps the app with Ant Design `App`, `AuthProvider`, and `AppRouter`.
- `client/src/router/AppRouter.jsx`: Defines public auth routes, staff routes, manager routes, unauthorized page, redirects, and 404 fallback.
- `client/src/features/auth/AuthProvider.jsx`: Restores the Supabase session, listens for auth changes, loads `profiles`, and exposes auth state.
- `client/src/layouts/AppLayout.jsx`: Main authenticated shell with role-specific navigation, responsive staff mobile header, sign-out, and Manila clock.
- `client/src/lib/supabaseClient.js`: Creates the Supabase client when env vars are present. Returns `null` when not configured.
- `client/src/services/attendanceService.js`: Staff attendance RPC calls, selfie storage paths/uploads, selfie attachment RPC, signed URL helpers, history loading, and user-facing attendance error normalization.
- `client/src/services/manager/stationScheduleService.js`: Station schedule CRUD, role labels, station labels, time formatting, and today's station assignment RPC.
- `client/src/index.css`: Global styling for layouts, feature pages, camera flow, schedules, and responsive behavior.

## Routes

Routes are centralized in `client/src/constants/routes.js`.

- Public: `/login`, `/reset-password`, `/unauthorized`.
- Staff: `/staff`, `/staff/schedule`, `/staff/history`, `/staff/profile`.
- Manager: `/manager`, `/manager/attendance`, `/manager/schedules`, `/manager/employees`, `/manager/branches`, `/manager/reports`, `/manager/audit`, `/manager/settings`.
- `/` redirects by role through `RoleRedirect`.
- Unknown `/staff/*` and `/manager/*` paths redirect to the section home.
- All other unmatched routes render `NotFoundPage`.

## Core Data Flow

1. `AuthProvider` restores the Supabase Auth session.
2. `profileService.getCurrentProfile()` loads the matching `profiles` row.
3. `ProtectedRoute` gates route groups by `profile.role`.
4. Staff pages call attendance and schedule services to load today's state.
5. Manager pages call manager service modules for domain-specific data.
6. SQL RPC functions enforce sensitive attendance behavior server-side.

## Attendance Flow

Staff clock-in/out is deliberately split into two steps:

1. `clock_in` or `clock_out` RPC creates or updates the attendance record.
2. The captured selfie is uploaded to `attendance-selfies`.
3. `attach_attendance_selfie` validates the official path and attaches it to the record.

The app keeps track of pending evidence so a processed attendance time can still receive its selfie if upload/attachment fails and the user retries.

Selfie path format:

```text
attendance/{employeeId}/{YYYY}/{MM}/{DD}/{attendanceId}/clock-in.jpg
attendance/{employeeId}/{YYYY}/{MM}/{DD}/{attendanceId}/clock-out.jpg
```

## Scheduling Model

Managers schedule staff by date and station through `ManagerSchedulesPage`.

- Stations are stored in `branches`; the UI labels them as stations.
- Station assignments are stored in `station_schedule_assignments`.
- Supported station roles: `cook`, `barista`, `otd_cashier`, `trainee`.
- Trainees require a trainer assigned to the same station and date.
- Each employee can only have one assignment per date.
- Each station/date is capped at four assigned staff.
- The UI treats three to four staff as ready staffing and highlights empty or understaffed stations.
- Staff clock-in requires a station schedule assignment for the current Manila/station attendance date.

## Supabase Schema Overview

Main tables:

- `profiles`: Auth-linked app user profile, role, status, employee number, avatar path, and contact details.
- `branches`: Stations/branches, codes, address, geofence fields, timezone, active flag.
- `employee_branches`: Staff-to-branch assignments with a single primary branch per employee.
- `work_schedules`: Legacy/general weekly schedules by employee, branch, and day of week.
- `station_schedule_assignments`: Daily station staffing schedule used by current clock-in rules.
- `attendance_records`: Clock-in/out records, photo paths, location, scheduled times, late/worked minutes, status, notes.
- `attendance_events`: Event stream for attendance changes.
- `audit_logs`: Manager/audited operational changes.
- `app_settings`: JSON settings such as organization name, default timezone, grace period, location/geofence toggles, and selfie quality.

Key RPC/functions:

- `clock_in(...)`: Requires active staff and a station assignment for the attendance date, calculates lateness, creates attendance.
- `clock_out(...)`: Completes the current open attendance record and calculates worked minutes.
- `attach_attendance_selfie(...)`: Validates storage path and attaches clock-in/out evidence.
- `get_today_attendance()`: Returns the current staff user's attendance for today.
- `get_today_station_assignment()`: Returns today's station assignment and station team for the current staff user.
- `get_staff_station_schedule(start_date, end_date)`: Returns the current staff user's station assignments and companions for a week/month range.
- `get_manager_dashboard_summary()`: Aggregates manager dashboard metrics.
- `log_manager_action(...)`: Inserts manager audit logs.

Security highlights:

- RLS is enabled on app tables.
- Staff can generally read their own records; managers can read/manage operational records.
- Attendance selfie storage is private.
- Storage policies allow staff to upload only official selfie paths for their own attendance records.
- Updates/deletes to attendance selfie storage are denied.

## Migration History

- `20260926010000_initial_schema.sql`: Main schema, indexes, triggers, RLS policies, storage bucket/policies, attendance RPCs, dashboard RPC, and station assignment tables/functions.
- `20260926013000_clock_in_from_station_schedule.sql`: Replaces `clock_in` so clock-in depends on today's station schedule assignment instead of only branch assignment.
- `20260926014000_allow_staff_station_reads_for_attendance.sql`: Expands branch read policy so staff can read station/branch rows tied to their station schedule or attendance records.

## Common Commands

Run these from `client/`:

```text
npm install
npm run dev
npm run build
npm run lint
npm run preview
```

## Implementation Notes

- Prefer service modules for Supabase access; route components should stay mostly orchestration and UI.
- Keep role and route strings in `constants/roles.js` and `constants/routes.js`.
- Use the existing Ant Design patterns, icons, cards, tags, and page headers for new UI.
- When adding manager data access, place it under `client/src/services/manager/` and export it from `manager/index.js` if shared.
- When changing attendance rules, update SQL RPCs and then align `attendanceService.js` error handling if new database errors surface to users.
- When changing station schedules, check both `ManagerSchedulesPage.jsx` and `stationScheduleService.js`; database constraints may also need migration changes.
- When changing storage behavior, verify both `attendanceService.js` path generation and Supabase storage policies.
- `supabaseClient.js` intentionally permits an unconfigured frontend by returning `null`; services commonly return safe empty values in that state.

## Task Starting Points

- Auth/session changes: `features/auth/`, `hooks/useAuth.js`, `router/`, `services/authService.js`, `services/profileService.js`.
- Route/access changes: `router/AppRouter.jsx`, `router/ProtectedRoute.jsx`, `router/RoleRedirect.jsx`, `constants/routes.js`, `constants/roles.js`.
- Staff today page changes: `features/staff/StaffHomePage.jsx`, `features/attendance/`, `services/attendanceService.js`, `services/manager/stationScheduleService.js`.
- Attendance camera/selfie changes: `features/attendance/AttendanceCamera.jsx`, `features/attendance/AttendanceFlowModal.jsx`, `utils/image.js`, `services/attendanceService.js`.
- Staff history changes: `features/staff/StaffHistoryPage.jsx`, `services/attendanceService.js`.
- Manager dashboard changes: `features/manager/ManagerDashboardPage.jsx`, `services/manager/dashboardService.js`.
- Manager attendance/report changes: `features/manager/ManagerAttendancePage.jsx`, `features/manager/ManagerReportsPage.jsx`, `services/manager/attendanceRecordsService.js`.
- Manager schedule changes: `features/manager/ManagerSchedulesPage.jsx`, `services/manager/stationScheduleService.js`, `supabase/migrations/`.
- Employee management changes: `features/manager/ManagerEmployeesPage.jsx`, `services/manager/employeeService.js`.
- Station/branch changes: `features/manager/ManagerBranchesPage.jsx`, `services/manager/branchService.js`.
- Audit changes: `features/manager/ManagerAuditPage.jsx`, `services/manager/auditService.js`, audit triggers/functions in migrations.
- Settings changes: `features/manager/ManagerSettingsPage.jsx`, `constants/settings.js`, `app_settings` SQL.
- Database/security changes: `supabase/migrations/`, matching service modules, and any UI consuming affected fields.
