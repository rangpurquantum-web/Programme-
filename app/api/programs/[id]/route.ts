import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Program from '@/models/Program';

export const dynamic = 'force-dynamic';
type Ctx = { params: { id: string } };

export async function GET(_: Request, { params }: Ctx) {
  await connectDB();
  const p = await Program.findById(params.id).lean();
  return p ? NextResponse.json(p) : NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const b = await req.json();
  const patch: Record<string, unknown> = {};
  for (const k of ['title', 'items', 'currentIndex', 'isLive']) if (k in b) patch[k] = b[k];
  await connectDB();
  const p = await Program.findByIdAndUpdate(params.id, patch, { new: true }).lean();
  return p ? NextResponse.json(p) : NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function DELETE(_: Request, { params }: Ctx) {
  await connectDB();
  await Program.findByIdAndDelete(params.id);
  return NextResponse.json({ ok: true });
}
