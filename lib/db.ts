import { Pool } from 'pg';

let _pool: Pool | null = null;

function getPool(): Pool {
        if (_pool) return _pool;
        const raw = process.env.POSTGRES_URL;
        if (!raw) {
                  throw new Error('POSTGRES_URL is not set.');
        }
        // Strip sslmode from the URL so the pg driver uses our ssl config below
  // (newer pg versions treat sslmode=require as verify-full, ignoring rejectUnauthorized)
  const connectionString = raw.replace(/[?&]sslmode=[^&]*/g, (m) =>
            m.startsWith('?') ? '?' : ''
                                         ).replace(/\?$/, '');

  _pool = new Pool({
            connectionString,
            ssl: { rejectUnauthorized: false },
            max: 1,
            min: 0,
  });
        return _pool;
}

let schemaReady: Promise<void> | null = null;

async function initSchema() {
        const pool = getPool();
        const statements = [
                  `create extension if not exists "uuid-ossp"`,
                  `create extension if not exists "pgcrypto"`,
                  `create table if not exists projects (
                        id uuid primary key default uuid_generate_v4(),
                              name text not null,
                                    client_name text,
                                          created_at timestamptz not null default now()
                                              )`,
                  `create table if not exists tasks (
                        id uuid primary key default uuid_generate_v4(),
                              project_id uuid not null references projects(id) on delete cascade,
                                    title text not null,
                                          role text not null,
                                                status text not null default 'Draft',
                                                      due_date date,
                                                            notes text,
                                                                  created_at timestamptz not null default now()
                                                                      )`,
                  `create table if not exists content_calendar (
                        id uuid primary key default uuid_generate_v4(),
                              project_id uuid not null references projects(id) on delete cascade,
                                    post_date date not null,
                                          platform text not null,
                                                content_type text,
                                                      title text,
                                                            status text not null default 'Draft',
                                                                  assigned_role text,
                                                                        created_at timestamptz not null default now()
                                                                            )`,
                  `alter table content_calendar add column if not exists caption text`,
                  `create table if not exists users (
                        id uuid primary key default uuid_generate_v4(),
                              username text not null unique,
                                    password_hash text not null,
                                          role text not null default 'viewer',
                                                created_at timestamptz not null default now()
                                                    )`,
                ];
        for (const sql of statements) {
                  await pool.query(sql);
        }
}

export async function ensureSchema() {
        if (!schemaReady) {
                  schemaReady = initSchema().catch((err) => {
                              schemaReady = null; // reset so next request retries
                                                         throw err;
                  });
        }
        await schemaReady;
}

export async function query<T = any>(text: string, params?: any[]): Promise<{ rows: T[] }> {
        await ensureSchema();
        const result = await getPool().query(text, params);
        return { rows: result.rows as T[] };
}

export async function closePool() {
        await getPool().end();
}
