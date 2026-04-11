import { Pool, types } from 'pg';

// Override the pg driver's default date parser.
// By default, pg converts `date` columns to JavaScript Date objects using
// the server's local timezone, which causes off-by-one day shifts when
// the server or client is in a non-UTC timezone.
// This override returns the raw YYYY-MM-DD string instead.
const DATE_OID = 1082;     // PostgreSQL 'date' type OID
const TIMESTAMP_OID = 1114; // PostgreSQL 'timestamp' type OID
types.setTypeParser(DATE_OID, (val: string) => val);   // return "2026-04-15" as-is
types.setTypeParser(TIMESTAMP_OID, (val: string) => val); // keep as string too

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
                  `alter table content_calendar add column if not exists client_approval_status text not null default 'pending_review'`,
                  `alter table content_calendar add column if not exists client_comments text`,
                  `alter table content_calendar add column if not exists mna_comments text`,
                  `alter table content_calendar add column if not exists approved_at timestamptz`,
                  // Google Drive link to the photo/video for this post. Rendered as preview + click through.
                  `alter table content_calendar add column if not exists photo_drive_url text`,
                  // Client tasks: MNA asks the client for things. client_id is the lib/clients.ts id (text, not FK to projects).
                  `create table if not exists client_requests (
                        id uuid primary key default uuid_generate_v4(),
                        client_id text not null,
                        title text not null,
                        description text,
                        status text not null default 'open',
                        created_at timestamptz not null default now(),
                        completed_at timestamptz
                  )`,
                  `alter table client_requests add column if not exists assigned_to text`,
                  // Per-client key/value blobs for things that don't justify their own
                  // schema: manual lead source splits, QA notes, override targets, etc.
                  // client_id = lib/clients.ts id, key = semantic name, value = jsonb.
                  `create table if not exists client_kv (
                        client_id text not null,
                        key text not null,
                        value jsonb not null,
                        updated_at timestamptz not null default now(),
                        primary key (client_id, key)
                  )`,
                  // STR (short-term rental) reservations synced from Hospitable via Make
                  `create table if not exists str_reservations (
                        id uuid primary key default uuid_generate_v4(),
                        client_id text not null,
                        platform text not null,
                        reservation_id text not null,
                        guest_name text,
                        check_in date not null,
                        check_out date not null,
                        nights integer not null,
                        nightly_rate numeric(10,2),
                        total_payout numeric(10,2),
                        status text not null default 'confirmed',
                        booked_at timestamptz,
                        synced_at timestamptz not null default now(),
                        unique (client_id, platform, reservation_id)
                  )`,
                  // STR daily metrics: occupancy, ADR, revenue rolled up daily
                  // Upserted by the Make webhook on each sync
                  `create table if not exists str_daily_metrics (
                        client_id text not null,
                        metric_date date not null,
                        occupancy_pct numeric(5,2),
                        adr numeric(10,2),
                        revpar numeric(10,2),
                        revenue numeric(10,2),
                        bookings_count integer default 0,
                        inquiries_count integer default 0,
                        synced_at timestamptz not null default now(),
                        primary key (client_id, metric_date)
                  )`,
                  // STR reviews synced from platforms
                  `create table if not exists str_reviews (
                        id uuid primary key default uuid_generate_v4(),
                        client_id text not null,
                        platform text not null,
                        review_id text,
                        guest_name text,
                        rating integer not null,
                        review_text text,
                        review_date date,
                        synced_at timestamptz not null default now(),
                        unique (client_id, platform, review_id)
                  )`,
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
