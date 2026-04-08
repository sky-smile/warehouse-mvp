# AGENTS.md

## Quick Start
- Runtime is a single CommonJS Node app. Main server entrypoint: `src/server.js`. Data layer and schema live in `src/db.js`. Frontend is a static SPA in `public/` served by Express.
- Install with `npm install`.
- Dev server: `npm run dev`
- Prod-style local run: `npm start`
- Test suite: `npm test`

## Verified Commands
- There is no lint, typecheck, or formatter script in `package.json`. Do not claim you ran them unless you added them.
- Tests run with Node's built-in runner, serially: `node --test --test-concurrency=1 test/**/*.test.js`
- For a focused test, run Node directly, for example: `node --test --test-concurrency=1 test/api.test.js`

## Runtime And Data Quirks
- `src/db.js` opens SQLite at `process.env.TEST_DB_PATH || data/warehouse.db`. The checked-in dev DB path is `data/warehouse.db`, but `data/*.db` is gitignored.
- `initDefaultAdmin()` is only called when `src/server.js` is run as the main module. If you import `app` directly in scripts/tests, call `initDefaultAdmin()` yourself before relying on the default admin account.
- Production startup fails unless `JWT_SECRET` is set. In non-production, the fallback secret is the hardcoded `dev-only-change-me`, so tokens remain valid across restarts unless you change the secret.
- Docker persists the database via the `warehouse-data` volume mounted at `/app/data`.

## Auth And API Gotchas
- Trust `src/server.js` over `README.md` for API behavior. The README still says some read APIs are public, but `/api/goods`, `/api/warehouses`, `/api/inventory`, and `/api/logs` are currently protected by `authMiddleware` and tests assert `401` without a token.
- Health check stays public at `/api/health`.
- Frontend auth is bearer-token based; the SPA stores the token client-side and sends `Authorization: Bearer <token>`.
- Default admin `admin / 123456` is still auto-created, but first login now requires a password change. Backend exposes this via `GET /api/me/security` (`mustChangePassword`), and the frontend forces the change-password modal until the default admin sets a non-default password.

## Testing Notes
- Tests use `process.env.TEST_DB_PATH = ":memory:"` before loading the app, so they do not touch `data/warehouse.db`.
- `test/api.test.js` manually cleans tables between tests; if you add integration tests, follow that pattern or isolate DB state another way.
- Tests create an ephemeral server with `app.listen(0)` instead of using the normal `npm start` boot path.

## Change Scope
- This is a small single-package repo. Most backend behavior is wired directly in `src/server.js`; most persistence rules, validation, and the only schema/migration logic are in `src/db.js`.
- Keep changes minimal and consistent with the existing style: CommonJS modules, direct Express route handlers, and `better-sqlite3` prepared statements/transactions in the DB layer.
- Future git commit messages and GitHub release notes should be written in Chinese.
- For every release, update both `package.json` `version` and the README `版本记录` section before tagging/publishing.
