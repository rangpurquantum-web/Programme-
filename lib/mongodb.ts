import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI as string;
const g = global as unknown as { _mongoose?: { conn: typeof mongoose | null; p: Promise<typeof mongoose> | null } };
const cache = g._mongoose || (g._mongoose = { conn: null, p: null });

export async function connectDB() {
  if (!uri) throw new Error('MONGODB_URI is not set');
  if (cache.conn) return cache.conn;
  if (!cache.p) cache.p = mongoose.connect(uri);
  cache.conn = await cache.p;
  return cache.conn;
}
