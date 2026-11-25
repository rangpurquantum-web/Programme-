import { Pool } from 'pg';

const g = global as unknown as { _pool?: Pool; _ready?: Promise<unknown> };

const pool =
  g._pool ||
  (g._pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 3,
  }));

export async function db() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  if (!g._ready) {
    g._ready = pool
      .query(
        `CREATE TABLE IF NOT EXISTS programs (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          title text NOT NULL,
          items jsonb NOT NULL DEFAULT '[]',
          current_index int NOT NULL DEFAULT 0,
          is_live boolean NOT NULL DEFAULT false,
          created_at timestamptz NOT NULL DEFAULT now()
        )`
      )
      .catch((e) => {
        g._ready = undefined;
        throw e;
      });
  }
  await g._ready;
  return pool;
}

export const COLS = `id AS "_id", title, items, current_index AS "currentIndex", is_live AS "isLive"`;
