import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Program from '@/models/Program';

export const dynamic = 'force-dynamic';

export async function GET() {
  await connectDB();
  return NextResponse.json(await Program.find().sort({ createdAt: -1 }).lean());
}

export async function POST(req: Request) {
  const { title } = await req.json();
  if (!title || !String(title).trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  await connectDB();
  return NextResponse.json(await Program.create({ title: String(title).trim() }), { status: 201 });
}
