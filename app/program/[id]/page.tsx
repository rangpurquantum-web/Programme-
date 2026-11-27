'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { locate } from '@/lib/timeline';

type Item = { title: string; speaker?: string; text?: string; image?: string; audio?: string; video?: string; countdown?: number; duration?: number; auto?: boolean };
type P = { _id: string; title: string; items: Item[]; startAt: string | null; background: string; shownAt: string | null; serverNow: string; currentIndex: number; isLive: boolean };
type Tab = 'slides' | 'add' | 'look' | 'live';
type MediaKey = 'image' | 'audio' | 'video';

const D = {
  slides: 'M3 6a2 2 0 012-2h14a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V6zM8 21h8M12 17v4',
  add: 'M12 5v14M5 12h14',
  look: 'M4 7h9M17 7h3M15 5v4M4 17h3M11 17h9M9 15v4',
  live: 'M12 12h.01M16.2 7.8a6 6 0 010 8.4M7.8 16.2a6 6 0 010-8.4M19 5a10 10 0 010 14M5 19A10 10 0 015 5',
  edit: 'M4 20h4L19 9l-4-4L4 16v4z',
  del: 'M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
};
const Ic = ({ d }: { d: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);

const toLocal = (s: string | null) => {
  if (!s) return '';
  const d = new Date(s);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const empty = { title: '', text: '', image: '', audio: '', video: '', countdown: '' };
const fill = { position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 } as const;

function uploadToCloudinary(file: File, onProgress: (n: number) => void): Promise<string> {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  if (!cloud || !preset) return Promise.reject(new Error('Cloudinary environment variables are missing'));
  const url = `https://api.cloudinary.com/v1_1/${cloud}/auto/upload`;
  const CHUNK = 6 * 1024 * 1024;
  const total = file.size;
  const chunked = total > CHUNK;
  const uid = Date.now() + '-' + Math.random().toString(36).slice(2);

  const send = (start: number): Promise<{ secure_url?: string }> =>
    new Promise((resolve, reject) => {
      const end = chunked ? Math.min(start + CHUNK, total) : total;
      const fd = new FormData();
      fd.append('file', chunked ? file.slice(start, end) : file, file.name);
      fd.append('upload_preset', preset);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      if (chunked) {
        xhr.setRequestHeader('X-Unique-Upload-Id', uid);
        xhr.setRequestHeader('Content-Range', `bytes ${start}-${end - 1}/${total}`);
      }
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.min(99, Math.round(((start + e.loaded) / total) * 100)));
      };
      xhr.onload = () => {
        let res: any = null;
        try { res = JSON.parse(xhr.responseText); } catch {}
        if (xhr.status >= 200 && xhr.status < 300 && res) resolve(res);
        else reject(new Error(res?.error?.message || 'Upload failed'));
      };
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(fd);
    });

  const sendRetry = async (start: number) => {
    let last: unknown;
    for (let i = 0; i < 3; i++) {
      try { return await send(start); } catch (e) { last = e; await new Promise((r) => setTimeout(r, 1500)); }
    }
    throw last;
  };

  return (async () => {
    let res: { secure_url?: string } = {};
    for (let start = 0; start < total; start += chunked ? CHUNK : total) res = await sendRetry(start);
    if (!res.secure_url) throw new Error('Upload did not finish');
    onProgress(100);
    return res.secure_url;
  })();
}

// Length (seconds) of an uploaded audio/video file. 0 = could not read it.
function probeMedia(url: string, kind: 'video' | 'audio'): Promise<number> {
  return new Promise((resolve) => {
    const el = document.createElement(kind);
    let done = false;
    let tm: ReturnType<typeof setTimeout> | undefined;
    const end = (n: number) => {
      if (done) return;
      done = true;
      if (tm) clearTimeout(tm);
      el.removeAttribute('src');
      el.load();
      resolve(n);
    };
    tm = setTimeout(() => end(0), 12000);
    el.preload = 'metadata';
    el.onloadedmetadata = () => end(isFinite(el.duration) ? el.duration : 0);
    el.onerror = () => end(0);
    el.src = url;
  });
}

// Length (seconds) of a YouTube video, read with a hidden player. 0 = could not read it.
function ytDuration(link: string): Promise<number> {
  const m = link.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|live\/|embed\/|shorts\/))([\w-]{11})/);
  if (!m) return Promise.resolve(0);
  const id = m[1];
  return new Promise((resolve) => {
    const w = window as any;
    let player: any;
    let box: HTMLDivElement | null = null;
    let poll: any;
    let timer: any;
    let done = false;
    const finish = (n: number) => {
      if (done) return;
      done = true;
      clearInterval(poll);
      clearTimeout(timer);
      try { player?.destroy(); } catch {}
      box?.remove();
      resolve(n);
    };
    timer = setTimeout(() => finish(0), 12000);
    const make = () => {
      box = document.createElement('div');
      box.style.cssText = 'position:fixed;left:-9999px;top:0;width:200px;height:120px;opacity:0';
      const inner = document.createElement('div');
      box.appendChild(inner);
      document.body.appendChild(box);
      player = new w.YT.Player(inner, {
        videoId: id,
        playerVars: { controls: 0, playsinline: 1 },
        events: {
          onReady: () => {
            try { player.mute(); } catch {}
            let n = 0;
            poll = setInterval(() => {
              n++;
              const d = Number(player.getDuration?.());
              if (d > 0) finish(d);
              else if (n === 6) { try { player.playVideo(); } catch {} }
            }, 300);
          },
          onError: () => finish(0),
        },
      });
    };
    if (w.YT && w.YT.Player) make();
    else {
      const prev = w.onYouTubeIframeAPIReady;
      w.onYouTubeIframeAPIReady = () => { if (prev) prev(); make(); };
      if (!document.getElementById('yt-api')) {
        const s = document.createElement('script');
        s.id = 'yt-api';
        s.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(s);
      }
    }
  });
}

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
  const [up, setUp] = useState<{ k: MediaKey; pct: number } | null>(null);
  const [upErr, setUpErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [now, setNow] = useState(Date.now());
  const [skew, setSkew] = useState(0);
  const set = (k: string, v: string) => setF((o) => ({ ...o, [k]: v }));

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/programs/${params.id}`, { cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        setP(d);
        setSkew(new Date(d.serverNow).getTime() - Date.now());
      }
    } catch {}
  }, [params.id]);
  useEffect(() => {
    load();
    const h = setInterval(load, 2000);
    return () => clearInterval(h);
  }, [load]);
  useEffect(() => {
    const c = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(c);
  }, []);

  async function save(patch: Partial<P>) {
    const r = await fetch(`/api/programs/${params.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
    if (r.ok) setP(await r.json());
  }

  async function pick(k: MediaKey, file?: File) {
    if (!file) return;
    setUpErr('');
    setUp({ k, pct: 0 });
    try {
      const u = await uploadToCloudinary(file, (pct) => setUp({ k, pct }));
      set(k, u);
    } catch (e) {
      setUpErr('Upload failed: ' + (e as Error).message);
    } finally {
      setUp(null);
    }
  }

  if (!p) return <main className="op">Loading…</main>;

  const bgNow = p.background || '';
  const si = Math.min(sel, Math.max(p.items.length - 1, 0));
  const prev = p.items[si];
  const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/live/${p._id}`;
  const eff = p.isLive && p.shownAt ? locate(p.items, p.currentIndex, (now + skew - new Date(p.shownAt).getTime()) / 1000, true) : null;
  const liveIdx = eff ? eff.index : p.currentIndex;

  async function submit() {
    if (!p || up || busy) return;
    const secs = f.countdown ? Math.round(parseFloat(f.countdown) * 60) : 0;
    const title = f.title.trim() || f.text.trim().slice(0, 40) || (secs ? 'Break' : '');
    const vl = f.video.trim();
    const al = f.audio.trim();
    if (!title && !f.image.trim() && !vl) return;
    let duration: number | undefined;
    setNote('');
    if (!secs && (vl || al)) {
      setBusy(true);
      const isYt = /youtu\.be\/|youtube\.com\//i.test(vl);
      const d = vl ? (isYt ? await ytDuration(vl) : await probeMedia(vl, 'video')) : await probeMedia(al, 'audio');
      setBusy(false);
      if (d > 0) duration = Math.ceil(d) + (isYt ? 2 : 0);
      else setNote('Could not read the length of this media, so this slide will not move on by itself.');
    }
    const base = { title: title || 'Slide', text: f.text.trim(), image: f.image.trim(), audio: al, video: vl, countdown: secs > 0 ? secs : undefined, duration };
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

  const tabs: { id: Tab; label: string }[] = [
    { id: 'slides', label: 'Slides' },
    { id: 'add', label: editing !== null ? 'Edit' : 'Add' },
    { id: 'look', label: 'Look' },
    { id: 'live', label: 'Live' },
  ];

  const mediaRow = (k: MediaKey, placeholder: string) => (
    <div className="row">
      <input value={f[k]} onChange={(e) => set(k, e.target.value)} placeholder={placeholder} />
      <label className="btn ghost" style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
        {up?.k === k ? `${up.pct}%` : 'Upload'}
        <input
          type="file"
          accept={`${k}/*`}
          hidden
          disabled={!!up}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            pick(k, file);
          }}
        />
      </label>
    </div>
  );

  return (
    <main className="op">
      <div className="opbar">
        <div>
          <Link href="/" style={{ color: '#9ca3af' }}>← All programs</Link>
          <h1>{p.title}</h1>
        </div>
        <span className={`opbadge ${p.isLive ? 'on' : ''}`}>{p.isLive ? 'ON AIR' : 'OFF AIR'}</span>
      </div>
      {note && <p className="sub" style={{ color: 'var(--live)' }}>{note}</p>}

      {tab === 'slides' && (
        <>
          <div className="opmons">
            <Mon label="PREVIEW" tone="pv" src={`/live/${p._id}?mon=1&slide=${si}`} />
            <Mon label="LIVE" tone="lv" src={`/live/${p._id}?mon=1`} off={!p.isLive} />
          </div>
          <button className="oppush" disabled={!prev} onClick={() => save({ currentIndex: si })}>Push to live ▸</button>
          {p.items.length === 0 && <div className="empty">No slides yet. Open the Add tab.</div>}
          {p.items.map((it, i) => (
            <div className={`oprow ${i === si ? 'pv' : ''} ${i === liveIdx && p.isLive ? 'lv' : ''}`} key={i}>
              <button className="t" onClick={() => setSel(i)}>
                <strong>{i + 1}. {it.title}</strong>
                <small>{[i === liveIdx && p.isLive && 'LIVE', it.text && 'Text', it.image && 'Image', it.audio && 'Audio', it.video && 'Video', it.countdown && `Break ${Math.round(it.countdown / 60)} min`, !it.countdown && (it.audio || it.video) && (it.duration ? `Length ${mmss(it.duration)}` : 'Length unknown')].filter(Boolean).join(' · ') || ' '}</small>
              </button>
              <button className="ghost ic" onClick={() => startEdit(i)} aria-label="Edit slide"><Ic d={D.edit} /></button>
              <button className="ghost ic" onClick={() => remove(i)} aria-label="Delete slide"><Ic d={D.del} /></button>
            </div>
          ))}
          <p className="sub">Each slide moves to the next one by itself when its audio, video or break ends. After the last slide only the background stays. "Length unknown" slides cannot do this: open Edit and press Save changes to read the length again.</p>
        </>
      )}

      {tab === 'add' && (
        <>
          <h2>{editing !== null ? `Edit slide ${editing + 1}` : 'Add a slide'}</h2>
          <div className="row"><input value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Slide name (for your list)" /></div>
          <div className="row"><input value={f.text} onChange={(e) => set('text', e.target.value)} placeholder="Text on the slide" /></div>
          {mediaRow('image', 'Image link (optional)')}
          {mediaRow('audio', 'Audio link (optional)')}
          {mediaRow('video', 'Video link (optional)')}
          {upErr && <p style={{ color: 'var(--live)' }}>{upErr}</p>}
          <div className="row"><input type="number" min="0" step="0.5" value={f.countdown} onChange={(e) => set('countdown', e.target.value)} placeholder="Break countdown in minutes (optional)" /></div>
          <div className="row">
            <button onClick={submit} disabled={!!up || busy}>{up ? 'Uploading…' : busy ? 'Reading length…' : editing !== null ? 'Save changes' : 'Add slide'}</button>
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
          <p className="sub">Open this on the device that plays the program. It plays the break alert sound. Tap ▶ once there.</p>
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
