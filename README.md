# Univoxia MVP Foundation

Starter foundation for the Univoxia web-chat MVP.

## Prerequisites

- Node.js 22+ and npm for host-side development
- Docker Engine + Docker Compose plugin on the VPS
- A domain name for public access later (not needed for the database smoke test)
- SSH access to the VPS

## 1. Configure environment

```bash
cp .env.example .env
```

Generate a strong database password, then use the exact same password in `POSTGRES_PASSWORD` and `DATABASE_URL`. URL-encode special characters in the password if needed.

Do not commit `.env` to Git.

## 2. Build and start PostgreSQL

```bash
docker compose up -d postgres
docker compose ps
```

Wait until PostgreSQL reports healthy.

## 3. Apply migrations

```bash
docker compose --profile tools run --rm migrate
```

On a new database, output includes `APPLIED 001_initial_schema.sql`,
`APPLIED 002_auth_and_invites.sql`, and `Migrations complete.` Existing
databases apply only the pending migration.

Running it again should skip already-applied migrations. The Docker image builds TypeScript first and runs the compiled migration script.

## 4. Start API

```bash
docker compose up -d --build server
docker compose ps
curl http://127.0.0.1:4000/health/live
curl http://127.0.0.1:4000/health/ready
```

Expected readiness response:

```json
{"status":"ok","database":"connected"}
```

The web app and API are served together on port 4000. The service binds to
`127.0.0.1:4000` on the VPS host and is not directly exposed publicly. Add
Nginx or Caddy with HTTPS before allowing remote users; production login cookies
are marked `Secure`. Configure the reverse proxy to preserve the original
`Host` header for same-origin request validation.

Open `http://127.0.0.1:4000` from the VPS or visit the HTTPS URL configured on
your reverse proxy. Create the first account to create a workspace. Share the
workspace's 16-character invite code with teammates; they can join from the
registration screen. Start a direct conversation using another member's
username. Messages are stored in PostgreSQL and appear in other open clients
within a few seconds.

The MVP does not yet provide AI translation, WebSockets, attachments, or
password reset. Messages currently appear in their original language. The
language preference is stored with the account and labels messages you send.

## 5. Verify schema

```bash
docker compose exec postgres sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\dt"'
```

## 6. Useful commands

```bash
docker compose logs -f server
docker compose logs -f postgres
docker compose down
```

For local development, start PostgreSQL as above, apply migrations, then run
the containerized API and Vite frontend in separate terminals:

```bash
npm install
npm run build
docker compose --profile tools run --rm migrate
docker compose up -d --build server
npm run dev:web
```

Vite serves the frontend at `http://127.0.0.1:5173` and proxies API requests to
the containerized API on port 4000. `npm run build:web` checks and builds the
frontend; `npm run build` builds both the API and frontend. Running
`npm run dev:server` or `npm run db:migrate` directly on the
host requires a host-reachable `DATABASE_URL`; the sample `.env` uses the
Compose-only hostname `postgres` and the database port is intentionally not
published to the host.

`docker compose down` preserves the named database volume. `docker compose down -v` deletes the database volume and its data; avoid this unless you explicitly intend to reset the database.

## Security notes

- Do not publish PostgreSQL port 5432.
- Do not put AI API keys in frontend code.
- Authentication and direct messaging use HTTP-only session cookies; put the server behind HTTPS before allowing remote access.
- AI translation and real-time push are not implemented; clients refresh conversation state every few seconds.
- Do not route real company messages to an external AI provider until authorized.
- Set up off-server backups and test restores before pilot use.
