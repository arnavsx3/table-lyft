# Development

## Setup

Node.js 24 LTS and npm are required. Run `npm ci`; WXT prepares generated TypeScript configuration during installation. Build with `npm run build`, then load `.output/chrome-mv3` unpacked in Brave or Chrome. Reload the extension after rebuilding. Refresh source pages if an older picker was injected.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | WXT development mode (browser startup depends on local configuration) |
| `npm run build` | Production MV3 extension |
| `npm run zip` | Store/loadable release ZIP |
| `npm run typecheck` | Strict TypeScript checks |
| `npm test` | Unit suite |
| `npm run lint` | Biome checks |
| `npm run format` | Apply formatting |
| `npm run check` | Lint, types, unit tests |
| `npm run test:e2e` | Build and run installed Chromium tests |
| `npm run verify:bundle` | Production permission/code boundary checks |

Install Playwright Chromium once with `npx playwright install chromium`. The browser tests start a loopback-only fixture server and stop it at the end. No production backend is needed.

## Conventions

- Keep browser-independent logic in `src/core` with focused tests.
- Validate data crossing runtime/storage boundaries; bound DOM traversal and allocations.
- Avoid website-specific adapters, global state libraries, or new permissions without documenting the reason.
- Render external values only as text. Do not log captured data.
- Keep production/test manifests separate; never publish test host grants.
- Commit the lockfile. Bundle all executable assets locally.
- Before release run checks, installed-extension tests, a production build, and bundle verification. Record untested browsers and unsupported table kinds honestly.
