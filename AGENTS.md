# Agent Guidelines

## Scope and references

- Treat this repository as an MVP foundation, not a complete chat application. Only health endpoints exist; authentication, chat, and AI integration are not implemented.
- Use [README.md](README.md) for environment setup, container operations, smoke checks, and security requirements; keep it current when changing those workflows.
- Keep HTTP/runtime changes in [apps/server/src/index.ts](apps/server/src/index.ts), schema changes in [database/migrations](database/migrations), and migration execution logic in [scripts/migrate.ts](scripts/migrate.ts).

## Development and validation

- Run npm commands from the repository root; the server workspace has no scripts of its own. Use `npm install` when dependencies are needed; no lockfile is currently committed for `npm ci`.
- After TypeScript changes, run `npm run typecheck` and `npm run build`. No test or lint scripts currently exist; do not present compilation as test coverage.
- `npm run dev:server` runs source in watch mode. `npm run start:server` and `npm run db:migrate` require a prior build. Run migrations from the root because SQL paths resolve from the working directory.
- Match existing TypeScript style: two-space indentation, single quotes, and semicolons. Preserve strict compilation in [tsconfig.json](tsconfig.json); NodeNext does not imply this is an ESM package.

## Database changes

- Add new zero-padded, lexically ordered SQL migration files rather than editing already-applied migrations. The runner records filenames only and wraps each pending file in a transaction.
- Do not run concurrent migrations: the runner has no concurrency lock. Confirm the target database before applying schema changes.
- Preserve the schema's workspace-scoped composite foreign keys. These enforce relational consistency, not authorization; implement access checks explicitly when adding routes.

## Runtime pitfalls

- For host-side development, supply a reachable `DATABASE_URL`: [.env.example](.env.example) targets the Compose-only hostname `postgres`, whose port is not published. Do not expose PostgreSQL just to bypass this setup.
- Keep server listening ports and [Compose](docker-compose.yml) mappings aligned; changing `PORT` alone does not change the fixed `127.0.0.1:4000:4000` mapping.
- Treat `/health/ready` as a database connectivity check only (`SELECT 1`), not proof that migrations have run. Use the README schema verification workflow when validating database changes.
- Preserve localhost-only API exposure and log redaction. Follow the [security notes](README.md#security-notes) before introducing public endpoints or AI data flows; never include credentials in logs or committed files.