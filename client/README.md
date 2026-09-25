# BrewTrack Attendance Client

React + Vite frontend for the selfie attendance and workforce verification system.

## Stack

- React
- Vite
- JavaScript
- Ant Design
- React Router
- Supabase JavaScript SDK

## Local Setup

1. Copy `.env.example` to `.env`.
2. Add the Supabase project URL and anon key.
3. Install dependencies with `npm install`.
4. Start the app with `npm run dev`.

## Project Structure

```text
src/
  app/          Ant Design theme and root app composition
  config/       Environment configuration
  constants/    Roles, routes, and app setting keys
  features/     Feature-owned flows such as authentication
  hooks/        Shared React hooks
  layouts/      Authenticated and unauthenticated page shells
  lib/          Third-party client setup
  pages/        Route pages split by staff, manager, and shared concerns
  router/       Route guards and route tree
  services/     Supabase-facing service functions
  utils/        Shared formatting helpers
```

## Current Milestone

Milestone 1 foundation is implemented:

- Supabase client boundary
- Auth provider with session restoration
- Protected routes
- Role-based staff and manager route groups
- Responsive application layouts
- Login and password reset screens
- Staff attendance, history, and profile pages
- Manager dashboard, attendance, employee, branch, report, and settings pages

## Next Milestones

The next backend milestone should add reproducible Supabase migrations for profiles, branches,
employee branch assignments, work schedules, attendance records, attendance events, audit logs,
app settings, RLS policies, storage buckets, and secure attendance RPC functions.
