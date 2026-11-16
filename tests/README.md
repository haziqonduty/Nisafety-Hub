# Tests

| Command | What it checks | Needs |
|---|---|---|
| `npm test` | Expiry rules and date maths, date validation, file-type checks, category labels (`src/**/*.test.ts`) | Nothing — runs in seconds |
| `npm run test:security` | Every protected API route and page refuses anonymous callers **and** a forged admin header; sign-in pages stay public; security headers are sent (`tests/security/`) | The app running: `npm run build && npm start` (or set `TEST_BASE_URL` to a preview URL) |

GitHub Actions (`.github/workflows/ci.yml`) runs lint, `npm test`, the build, the type-check and `npm run test:security` on every push to `master` and every pull request.

Notes:

- Run tests through `npm test` / `npm run test:security`, not `npx vitest` — the wrapper (`scripts/run-vitest.mjs`) works around a Windows drive-letter quirk that otherwise makes every test file fail.
- The security tests only send anonymous requests with made-up ids, so they can't change real data, even against production.
- When adding a protected API route or page, add it to the lists in `tests/security/access-control.test.ts`.
