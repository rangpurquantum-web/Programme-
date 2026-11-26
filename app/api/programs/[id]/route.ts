import { NextResponse } from 'next/server';
import { db, COLS } from '@/lib/db';

export const dynamic = 'force-dynamic';
type Ctx = { params: { id: string } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const notFound = () => NextResponse.json({ error: 'Not found' }, { status: 404 });

export async function GET(_: Request, { params }: Ctx) {
  if (!UUID.test(params.id)) return notFound();
  const pool = await db();
  const r = await pool.query(`SELECT ${COLS} FROM programs WHERE id = $1`, [params.id]);
  return r.rows[0] ? NextResponse.json(r.rows[0]) : notFound();
}

export async function PATCH(req: Request, { params }: Ctx) {
  if (!UUID.test(params.id)) return notFound();
  const b = await req.json();
  const pool = await db();
  const r = await pool.query(
    `UPDATE programs SET
       title = COALESCE($2, title),
       items = COALESCE($3::jsonb, items),
       current_index = COALESCE($4, current_index),
       is_live = COALESCE($5, is_live),
       streams = COALESCE($6::jsonb, streams),
       start_at = CASE WHEN $7::boolean THEN $8::timestamptz ELSE start_at END
     WHERE id = $1 RETURNING ${COLS}`,
    [
      params.id,
      'title' in b ? b.title : null,
      'items' in b ? JSON.stringify(b.items) : null,
      'currentIndex' in b ? b.currentIndex : null,
      'isLive' in b ? b.isLive : null,
      'streams' in b ? JSON.stringify(b.streams) : null,
      'startAt' in b,
      b.startAt || null,
    ]
  );
  return r.rows[0] ? NextResponse.json(r.rows[0]) : notFound();
}

export async function DELETE(_: Request, { params }: Ctx) {
  if (!UUID.test(params.id)) return notFound();
  const pool = await db();
  await pool.query('DELETE FROM programs WHERE id = $1', [params.id]);
  return NextResponse.json({ ok: true });
}