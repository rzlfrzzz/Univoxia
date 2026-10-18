# Univoxia MVP Foundation

Starter foundation for the Univoxia web-chat MVP.

## Prerequisites

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

Expected output includes `APPLIED 001_initial_schema.sql` and `Migrations complete.`

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

The API binds to `127.0.0.1:4000` on the VPS host. It is not directly exposed publicly. Add Nginx or Caddy with HTTPS before allowing remote users.

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

`docker compose down` preserves the named database volume. `docker compose down -v` deletes the database volume and its data; avoid this unless you explicitly intend to reset the database.

## Security notes

- Do not publish PostgreSQL port 5432.
- Do not put AI API keys in frontend code.
- The API currently exposes only health endpoints; authentication and chat routes are not implemented yet.
- Do not route real company messages to an external AI provider until authorized.
- Set up off-server backups and test restores before pilot use.
