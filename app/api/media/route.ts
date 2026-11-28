import { NextResponse } from 'next/server';
import { mediaDb } from '@/lib/mediaDb';

export const dynamic = 'force-dynamic';

const KINDS = ['image', 'audio', 'video', 'pdf'];

export async function GET() {
  const pool = await mediaDb();
  const r = await pool.query(`SELECT id, url, kind, name, pages FROM media ORDER BY created_at DESC LIMIT 300`);
  return NextResponse.json(r.rows);
}

export async function POST(req: Request) {
  const b = await req.json();
  const url = String(b.url || '');
  const kind = String(b.kind || '');
  if (!url.startsWith('https://res.cloudinary.com/') || !KINDS.includes(kind)) {
    return NextResponse.json({ error: 'Not a Cloudinary file' }, { status: 400 });
  }
  const name = String(b.name || url.split('/').pop() || '').slice(0, 200);
  const pages = Number(b.pages) > 0 ? Math.round(Number(b.pages)) : null;
  const pool = await mediaDb();
  await pool.query(`INSERT INTO media (url, kind, name, pages) VALUES ($1, $2, $3, $4) ON CONFLICT (url) DO NOTHING`, [url, kind, name, pages]);
  return NextResponse.json({ ok: true }, { status: 201 });
}
