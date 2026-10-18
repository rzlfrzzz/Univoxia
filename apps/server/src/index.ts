import 'dotenv/config';
import Fastify from 'fastify';
import { Pool } from 'pg';

const host = process.env.HOST ?? '0.0.0.0';
const port = Number(process.env.PORT ?? 4000);
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 10,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000
});

const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    redact: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.password_hash',
      '*.apiKey',
      '*.api_key'
    ]
  }
});

app.get('/health/live', async () => ({
  status: 'ok',
  service: 'univoxia-api'
}));

app.get('/health/ready', async (_request, reply) => {
  try {
    await pool.query('SELECT 1');
    return { status: 'ok', database: 'connected' };
  } catch {
    return reply.code(503).send({
      status: 'error',
      database: 'unavailable'
    });
  }
});

app.addHook('onClose', async () => {
  await pool.end();
});

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'Shutting down');
  await app.close();
  process.exit(0);
};

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));

async function main() {
  try {
    await app.listen({ host, port });
  } catch (error) {
    app.log.error(error);
    await app.close();
    process.exit(1);
  }
}

void main();
