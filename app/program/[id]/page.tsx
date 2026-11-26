'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

type Item = { title: string; speaker?: string; text?: string; image?: string; audio?: string; video?: string };
type P = { _id: string; title: string; items: Item[]; startAt: string | null; currentIndex: number; isLive: boolean };

const toLocal = (s: string | null) => {
  if (!s) return '';
  const d = new Date(s);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export default function Control({ params }: { params: { id: string } }) {
  const [p, setP] = useState<P | null>(null);
  const [f, setF] = useState({ title: '', speaker: '', text: '', image: '', audio: '', video: '' });
  const set = (k: string, v: string) => setF((o) => ({ ...o, [k]: v }));

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

  function addSlide() {
    if (!p) return;
    const title = f.title.trim() || f.text.trim().slice(0, 40);
    if (!title && !f.image.trim() && !f.video.trim()) return;
    save({ items: [...p.items, { title: title || 'Slide', speaker: f.speaker.trim(), text: f.text.trim(), image: f.image.trim(), audio: f.audio.trim(), video: f.video.trim() }] });
    setF({ title: '', speaker: '', text: '', image: '', audio: '', video: '' });
  }

  return (
    <main className="wrap">
      <p><Link href="/">← All programs</Link></p>
      <h1>{p.title}</h1>
      <p className="sub">{p.isLive ? 'Live now. Viewers see the selected slide.' : 'Not live yet.'}</p>

      <div className="row">
        <button className={p.isLive ? 'live' : ''} onClick={() => save({ isLive: !p.isLive })}>{p.isLive ? 'Stop live' : 'Go live'}</button>
        <Link className="btn ghost" href={`/live/${p._id}`} target="_blank">Open live screen</Link>
      </div>

      <h2>Start time</h2>
      <div className="row">
        <input type="datetime-local" value={toLocal(p.startAt)} onChange={(e) => save({ startAt: e.target.value ? new Date(e.target.value).toISOString() : null })} />
      </div>

      <h2>Slides</h2>
      <div className="row">
        <button className="ghost" onClick={() => go(p.currentIndex - 1)} disabled={p.currentIndex <= 0}>Previous</button>
        <button onClick={() => go(p.currentIndex + 1)} disabled={p.currentIndex >= last}>Next slide</button>
      </div>
      {p.items.length === 0 && <div className="empty">Add your first slide below.</div>}
      {p.items.map((it, i) => (
        <div className={`item ${i === p.currentIndex && p.isLive ? 'now' : ''}`} key={i}>
          <div>
            <strong>{i + 1}. {it.title}</strong>
            <small>{[it.text && 'Text', it.image && 'Image', it.audio && 'Audio', it.video && 'Video'].filter(Boolean).join(' + ') || ' '}</small>
          </div>
          <div className="row" style={{ margin: 0 }}>
            <button className="ghost" onClick={() => go(i)}>Show</button>
            <button className="ghost" onClick={() => save({ items: p.items.filter((_, j) => j !== i), currentIndex: 0 })}>Remove</button>
          </div>
        </div>
      ))}

      <h2>Add a slide</h2>
      <div className="row"><input value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Slide name (for your list)" /></div>
      <div className="row"><input value={f.text} onChange={(e) => set('text', e.target.value)} placeholder="Text on the slide" /></div>
      <div className="row"><input value={f.image} onChange={(e) => set('image', e.target.value)} placeholder="Image link (optional)" /></div>
      <div className="row"><input value={f.audio} onChange={(e) => set('audio', e.target.value)} placeholder="Audio link (optional)" /></div>
      <div className="row"><input value={f.video} onChange={(e) => set('video', e.target.value)} placeholder="Video link (optional)" /></div>
      <div className="row"><button onClick={addSlide}>Add slide</button></div>
    </main>
  );
}