# nodejs-hello-world-app

Express + TypeScript app with PostgreSQL, demonstrating idempotent migrations via `zsc execOnce` on Zerops.

## Zerops service facts

- HTTP port: `3000`
- Siblings: `db` (PostgreSQL) — env: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`
- Runtime base: `nodejs@22`

## Zerops dev

`setup: dev` idles on `zsc noop --silent`; the agent starts the dev server.

- Dev command: `npm run dev` (runs `ts-node src/index.ts`)
- In-container rebuild without deploy: `npm run build`

**All platform operations (start/stop/status/logs of the dev server, deploy, env / scaling / storage / domains) go through the Zerops development workflow via `zcp` MCP tools. Don't shell out to `zcli`.**

## Notes

- Express must set `trust proxy: true` and bind `0.0.0.0` — Zerops L7 balancer terminates SSL and routes via VXLAN IP.
- Dev runtime overrides `os: ubuntu` for richer tooling (apt, curl, git, vim) on SSH.
- Migration runs once per deploy via `npx ts-node src/migrate.ts` in `initCommands`.
