'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

type Item = { title: string; speaker?: string; text?: string; image?: string; audio?: string; video?: string; countdown?: number; auto?: boolean };
type P = { _id: string; title: string; items: Item[]; startAt: string | null; background: string; currentIndex: number; isLive: boolean };
type Tab = 'slides' | 'add' | 'look' | 'live';

const D = {
  slides: 'M3 6a2 2 0 012-2h14a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V6zM8 21h8M12 17v4',
  add: 'M12 5v14M5 12h14',
  look: 'M4 7h9M17 7h3M15 5v4M4 17h3M11 17h9M9 15v4',
  live: 'M12 12h.01M16.2 7.8a6 6 0 010 8.4M7.8 16.2a6 6 0 010-8.4M19 5a10 10 0 010 14M5 19A10 10 0 015 5',
  edit: 'M4 20h4L19 9l-4-4L4 16v4z',
  del: 'M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  auto: 'M5 5l9 7-9 7V5zM18 5v14',
};
const Ic = ({ d }: { d: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);

const toLocal = (s: string | null) => {
  if (!s) return '';
  const d = new Date(s);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const empty = { title: '', text: '', image: '', audio: '', video: '', countdown: '' };
const fill = { position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 } as const;

function Mon({ label, tone, src, off }: { label: string; tone: string; src: string; off?: boolean }) {
  return (
    <div className={`opmon ${tone}`}>
      <div className="oplabel">{label}</div>
      <div className="player mon">
        <iframe key={src} src={src} title={label} style={fill} />
        {off && <div className="opoff">OFF AIR</div>}
      </div>
    </div>
  );
}

export default function Control({ params }: { params: { id: string } }) {
  const [p, setP] = useState<P | null>(null);
  const [tab, setTab] = useState<Tab>('slides');
  const [sel, setSel] = useState(0);
  const [editing, setEditing] = useState<number | null>(null);
  const [f, setF] = useState(empty);
  const [bg, setBg] = useState('');
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  const set = (k: string, v: string) => setF((o) => ({ ...o, [k]: v }));

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/programs/${params.id}`, { cache: 'no-store' });
      if (r.ok) setP(await r.json());
    } catch {}
  }, [params.id]);
  useEffect(() => {
    load();
    const h = setInterval(load, 2000);
    return () => clearInterval(h);
  }, [load]);

  async function save(patch: Partial<P>) {
    const r = await fetch(`/api/programs/${params.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
    if (r.ok) setP(await r.json());
  }

  if (!p) return <main className="op">Loading…</main>;

  const bgNow = p.background || '';
  const si = Math.min(sel, Math.max(p.items.length - 1, 0));
  const prev = p.items[si];
  const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/live/${p._id}`;

  function submit() {
    if (!p) return;
    const secs = f.countdown ? Math.round(parseFloat(f.countdown) * 60) : 0;
    const title = f.title.trim() || f.text.trim().slice(0, 40) || (secs ? 'Break' : '');
    if (!title && !f.image.trim() && !f.video.trim()) return;
    const base = { title: title || 'Slide', text: f.text.trim(), image: f.image.trim(), audio: f.audio.trim(), video: f.video.trim(), countdown: secs > 0 ? secs : undefined };
    if (editing !== null) save({ items: p.items.map((x, j) => (j === editing ? { ...x, ...base } : x)) });
    else save({ items: [...p.items, base] });
    setF(empty);
    setEditing(null);
    setTab('slides');
  }

  function startEdit(i: number) {
    if (!p) return;
    const it = p.items[i];
    setF({ title: it.title, text: it.text || '', image: it.image || '', audio: it.audio || '', video: it.video || '', countdown: it.countdown ? String(it.countdown / 60) : '' });
    setEditing(i);
    setTab('add');
  }

  function remove(i: number) {
    if (!p || !confirm('Delete this slide?')) return;
    const ci = Math.max(0, Math.min(p.currentIndex - (i < p.currentIndex ? 1 : 0), p.items.length - 2));
    save({ items: p.items.filter((_, j) => j !== i), currentIndex: ci });
  }

  const toggleAuto = (i: number) => save({ items: p.items.map((x, j) => (j === i ? { ...x, auto: !x.auto } : x)) });

  const tabs: { id: Tab; label: string }[] = [
    { id: 'slides', label: 'Slides' },
    { id: 'add', label: editing !== null ? 'Edit' : 'Add' },
    { id: 'look', label: 'Look' },
    { id: 'live', label: 'Live' },
  ];

  return (
    <main className="op">
      <div className="opbar">
        <div>
          <Link href="/" style={{ color: '#9ca3af' }}>← All programs</Link>
          <h1>{p.title}</h1>
        </div>
        <span className={`opbadge ${p.isLive ? 'on' : ''}`}>{p.isLive ? 'ON AIR' : 'OFF AIR'}</span>
      </div>

      {tab === 'slides' && (
        <>
          <div className="opmons">
            <Mon label="PREVIEW" tone="pv" src={`/live/${p._id}?mon=1&slide=${si}`} />
            <Mon label="LIVE" tone="lv" src={`/live/${p._id}?mon=1`} off={!p.isLive} />
          </div>
          <button className="oppush" disabled={!prev} onClick={() => save({ currentIndex: si })}>Push to live ▸</button>
          {p.items.length === 0 && <div className="empty">No slides yet. Open the Add tab.</div>}
          {p.items.map((it, i) => (
            <div className={`oprow ${i === si ? 'pv' : ''} ${i === p.currentIndex && p.isLive ? 'lv' : ''}`} key={i}>
              <button className="t" onClick={() => setSel(i)}>
                <strong>{i + 1}. {it.title}</strong>
                <small>{[i === p.currentIndex && p.isLive && 'LIVE', it.text && 'Text', it.image && 'Image', it.audio && 'Audio', it.video && 'Video', it.countdown && `Break ${Math.round(it.countdown / 60)} min`].filter(Boolean).join(' · ') || ' '}</small>
              </button>
              <button className={`ghost ic ${it.auto ? 'on' : ''}`} onClick={() => toggleAuto(i)} aria-pressed={!!it.auto} aria-label="Go to next slide automatically when this one ends" title="Auto next"><Ic d={D.auto} /></button>
              <button className="ghost ic" onClick={() => startEdit(i)} aria-label="Edit slide"><Ic d={D.edit} /></button>
              <button className="ghost ic" onClick={() => remove(i)} aria-label="Delete slide"><Ic d={D.del} /></button>
            </div>
          ))}
          <p className="sub">Green icon = moves to the next slide by itself when this slide ends (audio or video ends, or the break countdown reaches zero).</p>
        </>
      )}

      {tab === 'add' && (
        <>
          <h2>{editing !== null ? `Edit slide ${editing + 1}` : 'Add a slide'}</h2>
          <div className="row"><input value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Slide name (for your list)" /></div>
          <div className="row"><input value={f.text} onChange={(e) => set('text', e.target.value)} placeholder="Text on the slide" /></div>
          <div className="row"><input value={f.image} onChange={(e) => set('image', e.target.value)} placeholder="Image link (optional)" /></div>
          <div className="row"><input value={f.audio} onChange={(e) => set('audio', e.target.value)} placeholder="Audio link (optional)" /></div>
          <div className="row"><input value={f.video} onChange={(e) => set('video', e.target.value)} placeholder="Video link (optional)" /></div>
          <div className="row"><input type="number" min="0" step="0.5" value={f.countdown} onChange={(e) => set('countdown', e.target.value)} placeholder="Break countdown in minutes (optional)" /></div>
          <div className="row">
            <button onClick={submit}>{editing !== null ? 'Save changes' : 'Add slide'}</button>
            {editing !== null && <button className="ghost" onClick={() => { setEditing(null); setF(empty); setTab('slides'); }}>Cancel</button>}
          </div>
        </>
      )}

      {tab === 'look' && (
        <>
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
          <p className="sub">Now: {bgNow === 'night' ? 'Night sky' : bgNow.startsWith('code:') ? 'Custom code' : bgNow || 'Plain'}</p>
          <h2>Custom code background</h2>
          <p className="sub">Paste HTML, CSS or JavaScript. It runs behind your slides.</p>
          <div className="row"><textarea value={code} onChange={(e) => setCode(e.target.value)} placeholder="<style>...</style>" rows={8} /></div>
          <div className="row"><button onClick={() => { if (code.trim()) { save({ background: 'code:' + code }); setCode(''); } }}>Use code</button></div>
        </>
      )}

      {tab === 'live' && (
        <>
          <h2>Broadcast</h2>
          <div className="row">
            <button className={p.isLive ? 'ghost' : ''} style={{ flex: 1, padding: 16 }} onClick={() => save({ isLive: !p.isLive })}>{p.isLive ? 'Stop live' : 'Go live'}</button>
          </div>
          <h2>Main screen</h2>
          <p className="sub">Open this on the device that plays the program. It plays audio and moves to the next slide by itself. Tap ▶ once there.</p>
          <div className="row"><Link className="btn" href={`/live/${p._id}?host=1`} target="_blank">Open main screen</Link></div>
          <h2>Viewer link</h2>
          <p className="sub" style={{ wordBreak: 'break-all' }}>{url}</p>
          <div className="row">
            <button className="ghost" onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? 'Copied' : 'Copy link'}</button>
          </div>
        </>
      )}

      <nav className="opnav">
        {tabs.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            <Ic d={D[t.id]} />
            {t.label}
          </button>
        ))}
      </nav>
    </main>
  );
}