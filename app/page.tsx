'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

type P = { _id: string; title: string; items: unknown[]; isLive: boolean };

export default function Home() {
  const [list, setList] = useState<P[]>([]);
  const [title, setTitle] = useState('');
  const [err, setErr] = useState('');

  async function load() {
    const r = await fetch('/api/programs', { cache: 'no-store' });
    if (r.ok) setList(await r.json());
    else setErr('Could not load programs. Check MONGODB_URI.');
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!title.trim()) return;
    await fetch('/api/programs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) });
    setTitle('');
    load();
  }
  async function remove(id: string) {
    if (!confirm('Delete this program?')) return;
    await fetch(`/api/programs/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <main className="wrap">
      <h1>ProgramFlow</h1>
      <p className="sub">Plan your event program and show it live on any screen.</p>
      <div className="row">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Program name" onKeyDown={(e) => e.key === 'Enter' && create()} />
        <button onClick={create}>Create program</button>
      </div>
      {err && <p style={{ color: 'var(--live)' }}>{err}</p>}
      {list.length === 0 && !err && <div className="empty">No programs yet. Create your first one above.</div>}
      {list.map((p) => (
        <div className="item" key={p._id}>
          <div>
            <strong>{p.title}</strong>
            <small>{p.items.length} items</small>
          </div>
          <div className="row" style={{ margin: 0 }}>
            <Link className="btn" href={`/program/${p._id}`}>Open</Link>
            <button className="ghost" onClick={() => remove(p._id)}>Delete</button>
          </div>
        </div>
      ))}
    </main>
  );
}
