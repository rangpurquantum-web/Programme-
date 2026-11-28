import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { mediaDb } from '@/lib/mediaDb';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parse(url: string) {
  const m = url.match(/^https:\/\/res\.cloudinary\.com\/([^/]+)\/(image|video|raw)\/upload\/(?:v\d+\/)?(.+)$/i);
  if (!m) return null;
  const type = m[2].toLowerCase();
  let id = decodeURIComponent(m[3].split('?')[0]);
  if (type !== 'raw') id = id.replace(/\.[A-Za-z0-9]+$/, '');
  return { cloud: m[1], type, id };
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const pool = await mediaDb();
  const r = await pool.query(`SELECT url FROM media WHERE id = $1`, [params.id]);
  if (!r.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const info = parse(r.rows[0].url);
  const key = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;
  let removed: boolean | null = null; // null = Cloudinary was not asked (keys missing)
  if (info && key && secret) {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHash('sha1').update(`invalidate=true&public_id=${info.id}&timestamp=${timestamp}${secret}`).digest('hex');
    const body = new URLSearchParams({ public_id: info.id, timestamp: String(timestamp), api_key: key, signature, invalidate: 'true' });
    const res = await fetch(`https://api.cloudinary.com/v1_1/${info.cloud}/${info.type}/destroy`, { method: 'POST', body });
    const j: any = await res.json().catch(() => ({}));
    removed = j.result === 'ok' || j.result === 'not found';
    if (!removed) return NextResponse.json({ error: (j.error && j.error.message) || 'Cloudinary did not delete the file' }, { status: 502 });
  }
  await pool.query(`DELETE FROM media WHERE id = $1`, [params.id]);
  return NextResponse.json({ ok: true, cloudinary: removed === true });
}
