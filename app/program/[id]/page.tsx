'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

type Item = { title: string; speaker: string; note: string };
type P = { _id: string; title: string; items: Item[]; currentIndex: number; isLive: boolean };

export default function Control({ params }: { params: { id: string } }) {
  const [p, setP] = useState<P | null>(null);
  const [t, setT] = useState('');
  const [s, setS] = useState('');

  const load = useCallback(async () => {
    const r = await fetch(`/api/programs/${params.id}`, { cache: 'no-store' });
    if (r.ok) setP(await r.json());
  }, [params.id]);
  useEffect(() => { load(); }, [load]);

  async function save(patch: Partial<P>) {
    const r = await fetch(`/api/programs/${params.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
    if (r.ok) setP(await r.json());
  }

  if (!p) return <main className="wrap">Loading…</main>;
  const last = p.items.length - 1;
  const go = (i: number) => save({ currentIndex: Math.max(0, Math.min(last, i)) });

  return (
    <main className="wrap">
      <p><Link href="/">← All programs</Link></p>
      <h1>{p.title}</h1>
      <p className="sub">{p.isLive ? 'Live now. Viewers see the current item.' : 'Not live yet.'}</p>

      <div className="row">
        <button className={p.isLive ? 'live' : ''} onClick={() => save({ isLive: !p.isLive })}>{p.isLive ? 'Stop live' : 'Go live'}</button>
        <Link className="btn ghost" href={`/live/${p._id}`} target="_blank">Open live screen</Link>
      </div>
      <div className="row">
        <button className="ghost" onClick={() => go(p.currentIndex - 1)} disabled={p.currentIndex <= 0}>Previous</button>
        <button onClick={() => go(p.currentIndex + 1)} disabled={p.currentIndex >= last}>Next item</button>
      </div>

      {p.items.length === 0 && <div className="empty">Add the first item of your program below.</div>}
      {p.items.map((it, i) => (
        <div className={`item ${i === p.currentIndex && p.isLive ? 'now' : ''}`} key={i}>
          <div>
            <strong>{i + 1}. {it.title}</strong>
            {it.speaker && <small>{it.speaker}</small>}
          </div>
          <div className="row" style={{ margin: 0 }}>
            <button className="ghost" onClick={() => go(i)}>Show</button>
            <button className="ghost" onClick={() => save({ items: p.items.filter((_, j) => j !== i), currentIndex: 0 })}>Remove</button>
          </div>
        </div>
      ))}

      <div className="row" style={{ marginTop: 16 }}>
        <input value={t} onChange={(e) => setT(e.target.value)} placeholder="Item title" />
        <input value={s} onChange={(e) => setS(e.target.value)} placeholder="Speaker (optional)" />
        <button onClick={() => { if (!t.trim()) return; save({ items: [...p.items, { title: t.trim(), speaker: s.trim(), note: '' }] }); setT(''); setS(''); }}>Add item</button>
      </div>
    </main>
  );
}
