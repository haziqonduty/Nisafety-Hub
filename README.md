# Nisafety Hub

Internal records platform for **Nisafety Consultancy**: staff record client visits, attach service reports (CHRA, CEM, LEV, noise, DOE monitoring…), and track when each report expires and needs renewing.

Live at **https://nisafetyhub.com**. Staff only: every page requires an approved account.

## What it does

- **Workspace**: a staff homepage with activity, records waiting on you, and renewal alerts.
- **Directory**: one card per client with every service report, searched and paged in the database, so the whole archive is reachable.
- **Record a visit**: client details plus one or more services, each with its own report (PDF, DOC or DOCX, up to 4 MB; larger PDFs are compressed in the browser). Staff must key in the date of monitoring.
- **Expiry and renewals**: each report gets an expiry date from its service's validity period (`src/lib/validity.ts`, based on DOSH/DOE rules). The tracker shows what's overdue, due within 30 days and due within 90 days, plus a one-click Renew.
- **Admin**: approve or reject staff sign-ups, manage roles, edit clients and admin-only internal notes, export to Excel, and analytics.
- **Bilingual**: English and Bahasa Melayu for the staff pages. Admin pages are English only.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS 4 · Supabase (Postgres, Auth, Storage, row-level security) · next-intl · Vercel (region `sin1`).

> Next.js 16 differs from older versions; see `AGENTS.md` and `node_modules/next/dist/docs/` before changing framework code.

## Getting started

Requirements: Node 24, npm, and access to the Supabase project.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` (never commit it):

   | Variable | Used for |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (public) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (public; access is enforced by row-level security) |
   | `SUPABASE_URL` | Same URL, for the server-only admin client |
   | `SUPABASE_SERVICE_ROLE_KEY` | **Secret.** Bypasses row-level security. Server-only, used by admin routes. |
   | `NEXT_PUBLIC_SITE_URL` | Optional. Canonical URL for metadata; defaults to `https://nisafetyhub.com` |

3. Start the dev server:

   ```bash
   npm run dev
   ```

   Then open http://localhost:3000.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve it |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript (run after a build: Next generates route types) |
| `npm test` | Unit tests, no database needed |
| `npm run test:security` | Access-control tests against a running app (see [tests/README.md](tests/README.md)) |

GitHub Actions runs lint, the unit tests, the build, the type-check and the security tests on every push to `master`. It needs the two `NEXT_PUBLIC_SUPABASE_*` values as repository secrets.

## Database

The schema lives in `supabase/migrations/`. Migrations are **applied by hand** in the Supabase SQL Editor, in filename order.

- Run a new migration **before** pushing code that depends on it.
- Every table has row-level security. Approved staff (`is_approved_staff()`) can read and write records. Admins (`is_admin()`) manage accounts.
- `clients.internal_notes` is admin-only through column-level grants, so a **new column on `clients` must be granted** to `authenticated` before staff can use it.
- Report files live in the private `safety-documents` bucket and are served through short-lived signed URLs.

## Project layout

```
src/
  proxy.ts               Session refresh and page gating (login, approval, admin)
  app/[locale]/          Staff pages (EN/BM): workspace, submit, records, renewals
  app/admin/             Admin dashboard (English only)
  app/api/               Route handlers; each checks access itself
  app/_components/       UI components
  lib/auth/profile.ts    getVerifiedProfile / requireAdminProfile / requireApprovedProfile
  lib/supabase/          Supabase clients and queries
  lib/validity.ts        Expiry rules per service
  lib/document-upload.ts Upload validation (type, size, file signature)
messages/                en.json, ms.json
supabase/migrations/     SQL, applied in order
tests/                   Security tests (unit tests sit next to the code as *.test.ts)
```

## Security rules of thumb

- **Authorise from the Supabase session only.** Use `requireApprovedProfile()` / `requireAdminProfile()` in every API route. `getCurrentProfile()` is for display: it can read a request header, and request headers can be forged.
- `/api` routes don't go through `src/proxy.ts`. Each route must check access itself, and each new one belongs in `tests/security/access-control.test.ts`.
- Prefer `createSupabaseServerClient()`, which applies row-level security for the signed-in user. Use the service-role client only behind an admin check.
- Never commit `.env*` files.

## Deployment

Pushing to `master` deploys to Vercel automatically. Environment variables are set in the Vercel project settings.
