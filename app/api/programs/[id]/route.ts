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
       title = COALESCE($2::text, title),
       items = COALESCE($3::jsonb, items),
       current_index = COALESCE($4::int, current_index),
       is_live = COALESCE($5::boolean, is_live),
       start_at = CASE WHEN $6::boolean THEN $7::timestamptz ELSE start_at END,
       background = COALESCE($8::text, background),
       ui = CASE WHEN $9::boolean THEN COALESCE(ui, '{}'::jsonb) || $10::jsonb ELSE ui END,
       shown_at = CASE WHEN $4::int IS NOT NULL OR $5::boolean IS TRUE THEN now() ELSE shown_at END
     WHERE id = $1 RETURNING ${COLS}`,
    [
      params.id,
      'title' in b ? b.title : null,
      'items' in b ? JSON.stringify(b.items) : null,
      'currentIndex' in b ? b.currentIndex : null,
      'isLive' in b ? b.isLive : null,
      'startAt' in b,
      b.startAt || null,
      'background' in b ? b.background : null,
      'ui' in b,
      JSON.stringify(b.ui ?? {}),
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