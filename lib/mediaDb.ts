import { db } from '@/lib/db';

const g = global as unknown as { _mediaReady?: Promise<unknown> };

// The list of files uploaded to Cloudinary (the "library").
export async function mediaDb() {
  const pool = await db();
  if (!g._mediaReady) {
    g._mediaReady = pool
      .query(
        `CREATE TABLE IF NOT EXISTS media (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          url text NOT NULL UNIQUE,
          kind text NOT NULL,
          name text NOT NULL DEFAULT '',
          pages int,
          created_at timestamptz NOT NULL DEFAULT now()
        )`
      )
      .catch((e) => {
        g._mediaReady = undefined;
        throw e;
      });
  }
  await g._mediaReady;
  return pool;
}
