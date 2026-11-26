'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

type Item = { title: string; speaker?: string; text?: string; image?: string; audio?: string; video?: string; countdown?: number };
type P = { _id: string; title: string; items: Item[]; startAt: string | null; background: string; currentIndex: number; isLive: boolean };

const toLocal = (s: string | null) => {
  if (!s) return '';
  const d = new Date(s);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const empty = { title: '', text: '', image: '', audio: '', video: '', countdown: '' };

export default function Control({ params }: { params: { id: string } }) {
  const [p, setP] = useState<P | null>(null);
  const [f, setF] = useState(empty);
  const [bg, setBg] = useState('');
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
    const secs = f.countdown ? Math.round(parseFloat(f.countdown) * 60) : 0;
    const title = f.title.trim() || f.text.trim().slice(0, 40) || (secs ? 'Break' : '');
    if (!title && !f.image.trim() && !f.video.trim()) return;
    const item: Item = { title: title || 'Slide', text: f.text.trim(), image: f.image.trim(), audio: f.audio.trim(), video: f.video.trim() };
    if (secs > 0) item.countdown = secs;
    save({ items: [...p.items, item] });
    setF(empty);
  }

  return (
    <main className="wrap">
      <p><Link href="/">← All programs</Link></p>
      <h1>{p.title}</h1>
      <p className="sub">{p.isLive ? 'Live now. Viewers see the selected slide.' : 'Not live yet.'}</p>

      <div className="row">
        <button className={p.isLive ? 'live' : ''} onClick={() => save({ isLive: !p.isLive })}>{p.isLive ? 'Stop live' : 'Go live'}</button>
        <Link className="btn ghost" href={`/live/${p._id}?host=1`} target="_blank">Open main screen</Link>
      </div>
      <p className="sub">Open the main screen on the device that plays the program. It moves to the next slide by itself. Share /live/{p._id} with everyone else.</p>

      <h2>Start time</h2>
      <div className="row">
        <input type="datetime-local" value={toLocal(p.startAt)} onChange={(e) => save({ startAt: e.target.value ? new Date(e.target.value).toISOString() : null })} />
      </div>

      <h2>Background</h2>
      <div className="row">
        <button className="ghost" onClick={() => save({ background: '' })}>Plain</button>
        <button className="ghost" onClick={() => save({ background: 'night' })}>Night sky</button>
      </div>
      <div className="row">
        <input value={bg} onChange={(e) => setBg(e.target.value)} placeholder="Image link (e.g. /sky.jpg)" />
        <button onClick={() => { if (bg.trim()) { save({ background: bg.trim() }); setBg(''); } }}>Use image</button>
      </div>
      <p className="sub">Now: {p.background === 'night' ? 'Night sky' : p.background || 'Plain'}</p>

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
            <small>{[it.text && 'Text', it.image && 'Image', it.audio && 'Audio', it.video && 'Video', it.countdown && `Break ${Math.round(it.countdown / 60)} min`].filter(Boolean).join(' + ') || ' '}</small>
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
      <div className="row"><input type="number" min="0" step="0.5" value={f.countdown} onChange={(e) => set('countdown', e.target.value)} placeholder="Break countdown in minutes (optional)" /></div>
      <div className="row"><button onClick={addSlide}>Add slide</button></div>
    </main>
  );
}