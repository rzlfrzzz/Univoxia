import 'dotenv/config';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import bcrypt from 'bcryptjs';
import { Pool, type PoolClient } from 'pg';

const host = process.env.HOST ?? '0.0.0.0';
const port = Number(process.env.PORT ?? 4000);
const databaseUrl = process.env.DATABASE_URL;
const isProduction = process.env.NODE_ENV === 'production';
const sessionCookieName = 'univoxia_session';
const sessionDurationMs = 7 * 24 * 60 * 60 * 1000;
const languages = ['id', 'zh-CN', 'en'] as const;
type Language = (typeof languages)[number];
const dummyPasswordHash = bcrypt.hashSync(
  randomBytes(24).toString('hex'),
  12
);

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be a valid TCP port');
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 10,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000
});

const app = Fastify({
  logger: {
    level: isProduction ? 'info' : 'debug',
    redact: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.password_hash',
      '*.token_hash',
      '*.apiKey',
      '*.api_key'
    ]
  },
  bodyLimit: 16 * 1024
});

type User = {
  id: string;
  workspace_id: string;
  display_name: string;
  username: string;
  preferred_language: Language;
  role: string;
};

declare module 'fastify' {
  interface FastifyRequest {
    user: User | null;
  }
}

app.decorateRequest('user', null);
app.register(cookie);
app.register(rateLimit, {
  global: false,
  errorResponseBuilder: (_request, context) => ({
    statusCode: 429,
    error: 'Too Many Requests',
    message: `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil(context.ttl / 1000)} detik.`
  })
});

app.addHook('onRequest', async (request, reply) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return;
  const origin = request.headers.origin;
  if (!origin) return;
  try {
    if (new URL(origin).host !== request.headers.host) {
      return reply.code(403).send({ error: 'Origin tidak diizinkan.' });
    }
  } catch {
    return reply.code(403).send({ error: 'Origin tidak valid.' });
  }
});

const webRoot = path.resolve(process.cwd(), 'apps/web/dist');
const webBuildExists = existsSync(path.join(webRoot, 'index.html'));
if (webBuildExists) {
  app.register(fastifyStatic, {
    root: path.join(webRoot, 'assets'),
    prefix: '/assets/'
  });
}

app.addHook('onRequest', async (request) => {
  if (
    request.url.startsWith('/api/') &&
    request.url !== '/api/auth/login' &&
    request.url !== '/api/auth/register'
  ) {
    request.user = await getUserFromSession(getSessionToken(request));
  }
});

const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

function getSessionToken(request: FastifyRequest) {
  const prefix = `${sessionCookieName}=`;
  const sessionCookie = request.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  return sessionCookie?.slice(prefix.length);
}

function setSessionCookie(reply: FastifyReply, token: string) {
  reply.setCookie(sessionCookieName, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(sessionDurationMs / 1000)
  });
}

function clearSessionCookie(reply: FastifyReply) {
  reply.clearCookie(sessionCookieName, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/'
  });
}

async function createSession(client: PoolClient, userId: string) {
  const token = randomBytes(32).toString('base64url');
  await client.query('DELETE FROM user_sessions WHERE expires_at <= now()');
  await client.query(
    `INSERT INTO user_sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + interval '7 days')`,
    [userId, hashToken(token)]
  );
  return token;
}

async function getUserFromSession(token: string | undefined) {
  if (!token) return null;
  const result = await pool.query<User>(
    `SELECT u.id, u.workspace_id, u.display_name, u.username,
            u.preferred_language, u.role
       FROM user_sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1
        AND s.expires_at > now()
        AND u.is_active = true`,
    [hashToken(token)]
  );
  return result.rows[0] ?? null;
}

async function requireUser(request: FastifyRequest, reply: FastifyReply) {
  if (request.user) return request.user;
  await reply.code(401).send({ error: 'Silakan masuk untuk melanjutkan.' });
  return null;
}

function getLanguage(value: unknown): Language | null {
  return languages.find((language) => language === value) ?? null;
}

function toPublicUser(user: User) {
  return {
    id: user.id,
    displayName: user.display_name,
    username: user.username,
    preferredLanguage: user.preferred_language,
    role: user.role
  };
}

async function createAccount(
  client: PoolClient,
  input: {
    displayName: string;
    username: string;
    password: string;
    preferredLanguage: Language;
    workspaceName: string;
    inviteCode?: string;
  }
) {
  const passwordHash = await bcrypt.hash(input.password, 12);
  await client.query('BEGIN');
  try {
    let workspaceId: string;
    let workspaceName: string;
    let inviteCode: string;
    let role: 'admin' | 'member';

    if (input.inviteCode) {
      const workspace = await client.query<{
        id: string;
        name: string;
        invite_code: string;
      }>(
        `SELECT id, name, invite_code FROM workspaces
          WHERE invite_code = upper($1)`,
        [input.inviteCode]
      );
      const matchedWorkspace = workspace.rows[0];
      if (!matchedWorkspace) {
        await client.query('ROLLBACK');
        return { error: 'Kode workspace tidak ditemukan.' } as const;
      }
      workspaceId = matchedWorkspace.id;
      workspaceName = matchedWorkspace.name;
      inviteCode = matchedWorkspace.invite_code;
      role = 'member';
    } else {
      const workspace = await client.query<{
        id: string;
        name: string;
        invite_code: string;
      }>(
        `INSERT INTO workspaces (name) VALUES ($1)
         RETURNING id, name, invite_code`,
        [input.workspaceName]
      );
      workspaceId = workspace.rows[0].id;
      workspaceName = workspace.rows[0].name;
      inviteCode = workspace.rows[0].invite_code;
      role = 'admin';
    }

    const insertedUser = await client.query<User>(
      `INSERT INTO users
         (workspace_id, display_name, username, password_hash, preferred_language,
          role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, workspace_id, display_name, username, preferred_language, role`,
      [
        workspaceId,
        input.displayName,
        input.username.toLowerCase(),
        passwordHash,
        input.preferredLanguage,
        role
      ]
    );
    const user = insertedUser.rows[0];
    const token = await createSession(client, user.id);
    await client.query('COMMIT');
    return { user, workspaceName, inviteCode, token } as const;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

app.get('/health/live', async () => ({
  status: 'ok',
  service: 'univoxia-api'
}));

app.get('/health/ready', async (_request, reply) => {
  try {
    await pool.query('SELECT 1');
    return { status: 'ok', database: 'connected' };
  } catch (error) {
    app.log.error({ err: error }, 'Database readiness check failed');
    return reply.code(503).send({
      status: 'error',
      database: 'unavailable'
    });
  }
});

app.post<{
  Body: {
    displayName: string;
    username: string;
    password: string;
    workspaceName?: string;
    inviteCode?: string;
    preferredLanguage?: string;
  };
}>(
  '/api/auth/register',
  {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['displayName', 'username', 'password'],
        properties: {
          displayName: { type: 'string', minLength: 1, maxLength: 80 },
          username: {
            type: 'string',
            minLength: 3,
            maxLength: 32,
            pattern: '^[a-zA-Z0-9._-]+$'
          },
          password: { type: 'string', minLength: 10, maxLength: 72 },
          workspaceName: { type: 'string', minLength: 1, maxLength: 80 },
          inviteCode: { type: 'string', minLength: 16, maxLength: 16 },
          preferredLanguage: { type: 'string', enum: [...languages] }
        }
      }
    }
  },
  async (request, reply) => {
    const displayName = request.body.displayName.trim();
    const workspaceName =
      request.body.workspaceName?.trim() || `${displayName}'s workspace`;
    const preferredLanguage = getLanguage(request.body.preferredLanguage) ?? 'id';
    if (
      !displayName ||
      Buffer.byteLength(request.body.password, 'utf8') > 72 ||
      (request.body.inviteCode &&
        !/^[a-f\d]{16}$/i.test(request.body.inviteCode))
    ) {
      return reply.code(400).send({ error: 'Informasi pendaftaran tidak valid.' });
    }

    const client = await pool.connect();
    try {
      const result = await createAccount(client, {
        displayName,
        username: request.body.username,
        password: request.body.password,
        preferredLanguage,
        workspaceName,
        inviteCode: request.body.inviteCode
      });
      if ('error' in result) {
        return reply.code(400).send({ error: result.error });
      }
      setSessionCookie(reply, result.token);
      return reply.code(201).send({
        user: toPublicUser(result.user),
        workspace: {
          name: result.workspaceName,
          inviteCode: result.inviteCode
        }
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505'
      ) {
        return reply.code(409).send({ error: 'Username tersebut sudah digunakan.' });
      }
      throw error;
    } finally {
      client.release();
    }
  }
);

app.post<{
  Body: { username: string; password: string };
}>(
  '/api/auth/login',
  {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['username', 'password'],
        properties: {
          username: { type: 'string', minLength: 3, maxLength: 32 },
          password: { type: 'string', minLength: 1, maxLength: 72 }
        }
      }
    }
  },
  async (request, reply) => {
    if (Buffer.byteLength(request.body.password, 'utf8') > 72) {
      return reply.code(401).send({ error: 'Username atau kata sandi salah.' });
    }
    const result = await pool.query<User & { password_hash: string }>(
      `SELECT id, workspace_id, display_name, username, preferred_language,
              role, password_hash
         FROM users
        WHERE lower(username) = lower($1) AND is_active = true`,
      [request.body.username.trim()]
    );
    const user = result.rows[0];
    const passwordHash = user?.password_hash ?? dummyPasswordHash;
    const passwordMatches = await bcrypt.compare(request.body.password, passwordHash);
    if (!user || !passwordMatches) {
      return reply.code(401).send({ error: 'Username atau kata sandi salah.' });
    }

    const client = await pool.connect();
    try {
      const token = await createSession(client, user.id);
      const workspace = await client.query<{ name: string; invite_code: string }>(
        'SELECT name, invite_code FROM workspaces WHERE id = $1',
        [user.workspace_id]
      );
      setSessionCookie(reply, token);
      return {
        user: toPublicUser(user),
        workspace: {
          name: workspace.rows[0].name,
          inviteCode: workspace.rows[0].invite_code
        }
      };
    } finally {
      client.release();
    }
  }
);

app.post('/api/auth/logout', async (request, reply) => {
  const token = getSessionToken(request);
  if (token) {
    await pool.query('DELETE FROM user_sessions WHERE token_hash = $1', [
      hashToken(token)
    ]);
  }
  clearSessionCookie(reply);
  return reply.code(204).send();
});

app.get('/api/auth/me', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const workspace = await pool.query<{ name: string; invite_code: string }>(
    'SELECT name, invite_code FROM workspaces WHERE id = $1',
    [user.workspace_id]
  );
  return {
    user: toPublicUser(user),
    workspace: {
      name: workspace.rows[0].name,
      inviteCode: workspace.rows[0].invite_code
    }
  };
});

app.patch<{
  Body: { preferredLanguage: string };
}>(
  '/api/auth/preferences',
  {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['preferredLanguage'],
        properties: {
          preferredLanguage: { type: 'string', enum: [...languages] }
        }
      }
    }
  },
  async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const language = getLanguage(request.body.preferredLanguage);
    if (!language) return reply.code(400).send({ error: 'Bahasa tidak valid.' });
    const result = await pool.query<User>(
      `UPDATE users SET preferred_language = $1
        WHERE id = $2
        RETURNING id, workspace_id, display_name, username, preferred_language, role`,
      [language, user.id]
    );
    request.user = result.rows[0];
    return { user: toPublicUser(result.rows[0]) };
  }
);

app.get('/api/conversations', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const result = await pool.query(
    `SELECT c.id, c.type, c.title, c.created_at,
            CASE WHEN c.type = 'direct' THEN other_user.display_name
                 ELSE COALESCE(c.title, 'Grup') END AS display_name,
            CASE WHEN c.type = 'direct' THEN other_user.username END AS other_username,
            other_user.preferred_language AS other_language,
            other_user.is_active AS other_is_active,
            latest.original_text AS last_message,
            latest.sender_id AS last_sender_id,
            latest.created_at AS last_message_at,
            (SELECT count(*)::int FROM conversation_members member_count
              WHERE member_count.conversation_id = c.id) AS member_count,
            (SELECT count(*)::int
               FROM messages unread
               JOIN conversation_members read_state
                 ON read_state.conversation_id = unread.conversation_id
                AND read_state.user_id = $2
              WHERE unread.conversation_id = c.id
                AND unread.sender_id <> $2
                AND (read_state.last_read_at IS NULL
                     OR unread.created_at > read_state.last_read_at)
                AND unread.deleted_at IS NULL) AS unread_count
       FROM conversations c
       JOIN conversation_members mine
         ON mine.conversation_id = c.id AND mine.user_id = $2
       LEFT JOIN LATERAL (
         SELECT m.original_text, m.sender_id, m.created_at
           FROM messages m
          WHERE m.conversation_id = c.id AND m.deleted_at IS NULL
          ORDER BY m.created_at DESC
          LIMIT 1
       ) latest ON true
       LEFT JOIN LATERAL (
         SELECT u.display_name, u.username, u.preferred_language, u.is_active
           FROM conversation_members other_member
           JOIN users u ON u.id = other_member.user_id
          WHERE other_member.conversation_id = c.id
            AND other_member.user_id <> $2
          ORDER BY other_member.joined_at
          LIMIT 1
       ) other_user ON true
      WHERE c.workspace_id = $1
      ORDER BY COALESCE(latest.created_at, c.created_at) DESC`,
    [user.workspace_id, user.id]
  );
  return { conversations: result.rows };
});

app.post<{
  Body: { username: string };
}>(
  '/api/conversations',
  {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['username'],
        properties: {
          username: {
            type: 'string',
            minLength: 3,
            maxLength: 32,
            pattern: '^[a-zA-Z0-9._-]+$'
          }
        }
      }
    }
  },
  async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const targetResult = await pool.query<{ id: string }>(
      `SELECT id FROM users
        WHERE workspace_id = $1 AND lower(username) = lower($2)
          AND is_active = true`,
      [user.workspace_id, request.body.username.trim()]
    );
    const target = targetResult.rows[0];
    if (!target || target.id === user.id) {
      return reply.code(404).send({
        error: 'Pengguna tidak ditemukan di workspace ini.'
      });
    }

    const existing = await pool.query<{ id: string }>(
      `SELECT c.id
         FROM conversations c
         JOIN conversation_members mine
           ON mine.conversation_id = c.id AND mine.user_id = $2
         JOIN conversation_members theirs
           ON theirs.conversation_id = c.id AND theirs.user_id = $3
        WHERE c.workspace_id = $1 AND c.type = 'direct'
          AND (SELECT count(*) FROM conversation_members member_count
                WHERE member_count.conversation_id = c.id) = 2
        LIMIT 1`,
      [user.workspace_id, user.id, target.id]
    );
    const found = existing.rows[0];
    if (found) return reply.code(200).send({ id: found.id });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const conversation = await client.query<{ id: string }>(
        `INSERT INTO conversations (workspace_id, type, created_by)
         VALUES ($1, 'direct', $2) RETURNING id`,
        [user.workspace_id, user.id]
      );
      const conversationId = conversation.rows[0].id;
      await client.query(
        `INSERT INTO conversation_members (conversation_id, user_id, workspace_id)
         VALUES ($1, $2, $3), ($1, $4, $3)`,
        [conversationId, user.id, user.workspace_id, target.id]
      );
      await client.query('COMMIT');
      return reply.code(201).send({ id: conversationId });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
);

app.get<{
  Params: { conversationId: string };
}>(
  '/api/conversations/:conversationId/messages',
  {
    schema: {
      params: {
        type: 'object',
        required: ['conversationId'],
        properties: { conversationId: { type: 'string', format: 'uuid' } }
      }
    }
  },
  async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const membership = await pool.query(
      `UPDATE conversation_members
          SET last_read_at = now()
        WHERE conversation_id = $1 AND user_id = $2 AND workspace_id = $3
        RETURNING conversation_id`,
      [request.params.conversationId, user.id, user.workspace_id]
    );
    if (!membership.rowCount) {
      return reply.code(404).send({ error: 'Percakapan tidak ditemukan.' });
    }
    const result = await pool.query(
      `SELECT m.id, m.sender_id, u.display_name AS sender_name,
              u.username AS sender_username, m.original_text,
              m.source_language, m.created_at
         FROM messages m
         JOIN users u ON u.id = m.sender_id
        WHERE m.conversation_id = $1 AND m.workspace_id = $2
          AND m.deleted_at IS NULL
        ORDER BY m.created_at DESC
        LIMIT 100`,
      [request.params.conversationId, user.workspace_id]
    );
    return { messages: result.rows.reverse() };
  }
);

app.post<{
  Params: { conversationId: string };
  Body: { text: string };
}>(
  '/api/conversations/:conversationId/messages',
  {
    schema: {
      params: {
        type: 'object',
        required: ['conversationId'],
        properties: { conversationId: { type: 'string', format: 'uuid' } }
      },
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['text'],
        properties: { text: { type: 'string', minLength: 1, maxLength: 8000 } }
      }
    }
  },
  async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const text = request.body.text.trim();
    if (!text) return reply.code(400).send({ error: 'Pesan tidak boleh kosong.' });
    const result = await pool.query(
      `INSERT INTO messages
         (workspace_id, conversation_id, sender_id, source_language, original_text)
       SELECT $1, member.conversation_id, $2, $3, $4
         FROM conversation_members member
        WHERE member.conversation_id = $5 AND member.user_id = $2
          AND member.workspace_id = $1
       RETURNING id, sender_id, original_text, source_language, created_at`,
      [
        user.workspace_id,
        user.id,
        user.preferred_language,
        text,
        request.params.conversationId
      ]
    );
    if (!result.rowCount) {
      return reply.code(404).send({ error: 'Percakapan tidak ditemukan.' });
    }
    await pool.query(
      `UPDATE conversation_members SET last_read_at = now()
        WHERE conversation_id = $1 AND user_id = $2`,
      [request.params.conversationId, user.id]
    );
    return reply.code(201).send({
      message: {
        ...result.rows[0],
        sender_name: user.display_name,
        sender_username: user.username
      }
    });
  }
);

app.get('/', async (_request, reply) => {
  if (!webBuildExists) {
    return reply.code(503).send({
      error: 'Frontend belum dibangun. Jalankan npm run build:web.'
    });
  }
  return reply.type('text/html').sendFile('index.html', webRoot);
});

app.setNotFoundHandler(async (request, reply) => {
  if (request.url.startsWith('/api/')) {
    return reply.code(404).send({ error: 'Endpoint tidak ditemukan.' });
  }
  return reply.code(404).send({ error: 'Halaman tidak ditemukan.' });
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
