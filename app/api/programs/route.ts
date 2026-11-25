import { NextResponse } from 'next/server';
import { db, COLS } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const pool = await db();
  const r = await pool.query(`SELECT ${COLS} FROM programs ORDER BY created_at DESC`);
  return NextResponse.json(r.rows);
}

export async function POST(req: Request) {
  const { title } = await req.json();
  if (!title || !String(title).trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  const pool = await db();
  const r = await pool.query(`INSERT INTO programs (title) VALUES ($1) RETURNING ${COLS}`, [String(title).trim()]);
  return NextResponse.json(r.rows[0], { status: 201 });
}
