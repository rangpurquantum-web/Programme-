'use client';
import { useEffect, useRef, useState, type SyntheticEvent } from 'react';

type Item = { title: string; speaker?: string; text?: string; image?: string; audio?: string; video?: string; countdown?: number; auto?: boolean };
type P = { title: string; items: Item[]; startAt: string | null; background: string; shownAt: string | null; serverNow: string; currentIndex: number; isLive: boolean };
type Star = { t: number; l: number; d: number };

const bn = (s: string) => s.replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[+d]);
const two = (n: number) => bn(String(n).padStart(2, '0'));

function embed(url: string, start: number, mute: boolean) {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|live\/|embed\/|shorts\/))([\w-]{11})/);
  const u = m ? `https://www.youtube.com/embed/${m[1]}` : url;
  const q = ['autoplay=1', 'controls=0', 'disablekb=1', 'playsinline=1', 'rel=0', 'modestbranding=1'];
  if (mute) q.push('mute=1');
  if (start > 1) q.push(`start=${start}`);
  return u + (u.includes('?') ? '&' : '?') + q.join('&');
}

function left(ms: number) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d} days ${h} hours`;
  if (h > 0) return `${h} hours ${m} min`;
  return `${m} min ${s % 60} sec`;
}

const fill = { position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 } as const;
const noTouch = { ...fill, pointerEvents: 'none' } as const;

export default function Live({ params }: { params: { id: string } }) {
  const [p, setP] = useState<P | null>(null);
  const [now, setNow] = useState(Date.now());
  const [skew, setSkew] = useState(0);
  const [sound, setSound] = useState(false);
  const [host, setHost] = useState(false);
  const [mon, setMon] = useState(false);
  const [slide, setSlide] = useState<number | null>(null);
  const [stars, setStars] = useState<Star[]>([]);
  const box = useRef<HTMLDivElement>(null);
  const moved = useRef('');
  const t0 = useRef(Date.now());
  const yt = useRef({ k: '', s: 0 });

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setHost(q.get('host') === '1');
    setMon(q.get('mon') === '1');
    const sl = q.get('slide');
    setSlide(sl !== null && !isNaN(parseInt(sl)) ? parseInt(sl) : null);
    t0.current = Date.now();
    setStars(Array.from({ length: 90 }, () => ({ t: Math.random() * 100, l: Math.random() * 100, d: Math.random() * 3 })));
    let on = true;
    async function tick() {
      try {
        const r = await fetch(`/api/programs/${params.id}`, { cache: 'no-store' });
        if (r.ok && on) {
          const d = await r.json();
          setP(d);
          setSkew(new Date(d.serverNow).getTime() - Date.now());
        }
      } catch {}
    }
    tick();
    const h = setInterval(tick, 2000);
    const c = setInterval(() => setNow(Date.now()), 1000);
    return () => { on = false; clearInterval(h); clearInterval(c); };
  }, [params.id]);

  function advance() {
    if (!host || !p || !p.items[p.currentIndex]?.auto) return;
    const key = `${p.currentIndex}:${p.shownAt}`;
    if (moved.current === key) return;
    moved.current = key;
    if (p.items[p.currentIndex]?.countdown) {
      try { new Audio('/alert.mp3').play().catch(() => {}); } catch {}
    }
    if (p.currentIndex < p.items.length - 1) {
      fetch(`/api/programs/${params.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentIndex: p.currentIndex + 1 }) });
    }
  }

  const idx = slide !== null ? slide : p ? p.currentIndex : 0;
  const cur = p && (slide !== null || p.isLive) ? p.items[idx] : undefined;
  const baseMs = slide !== null ? t0.current : p?.shownAt ? new Date(p.shownAt).getTime() : 0;
  const nowMs = slide !== null ? now : now + skew;
  const secs = cur?.countdown && baseMs ? Math.max(0, Math.ceil((baseMs + cur.countdown * 1000 - nowMs) / 1000)) : -1;

  useEffect(() => { if (secs === 0) advance(); });

  function fullscreen() {
    const el = box.current as any;
    if (!el) return;
    (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
  }

  if (!p) return <main className="live"><p className="now">Loading…</p></main>;

  const elapsed = () => (baseMs ? (Date.now() + (slide !== null ? 0 : skew) - baseMs) / 1000 : 0);
  const seek = (e: SyntheticEvent<HTMLMediaElement>) => {
    const t = elapsed();
    if (t > 1.5) e.currentTarget.currentTime = t;
  };
  const yk = `${idx}:${p.shownAt}:${sound}:${slide}`;
  if (yt.current.k !== yk) yt.current = { k: yk, s: Math.floor(elapsed()) };

  const wait = p.startAt ? new Date(p.startAt).getTime() - (now + skew) : 0;
  const bg = p.background || '';
  const isCode = bg.startsWith('code:');
  const bgStyle = bg && bg !== 'night' && !isCode ? { backgroundImage: `url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined;
  const hasMedia = !!cur && !cur.countdown && !!(cur.video || cur.audio);

  return (
    <main className={`live ${mon ? 'monpage' : ''}`}>
      {!mon && wait > 0 && <div className="count"><span>The program will start in:</span><b>{left(wait)}</b></div>}
      <div className={`player ${bg === 'night' ? 'night' : ''}`} style={bgStyle} ref={box}>
        {isCode && <iframe srcDoc={`<style>html,body{margin:0;height:100%;overflow:hidden}</style>${bg.slice(5)}`} sandbox="allow-scripts" title="Background" style={noTouch} />}
        {bg === 'night' && (
          <>
            <div className="stars">{stars.map((s, i) => <i key={i} style={{ top: `${s.t}%`, left: `${s.l}%`, animationDelay: `${s.d}s` }} />)}</div>
            <div className="moon" />
          </>
        )}
        {!cur && <div className="slide"><h1>{p.title}</h1><p>Starting soon</p></div>}
        {cur && cur.countdown && (
          <div className="slide">
            <h1>{cur.text || cur.title}</h1>
            <p className="big">{two(Math.floor(Math.max(secs, 0) / 60))} মিনিট {two(Math.max(secs, 0) % 60)} সেকেন্ড</p>
          </div>
        )}
        {cur && !cur.countdown && cur.video && (
          isFile(cur.video)
            ? <video key={cur.video + sound} src={cur.video} muted={mon || !sound} playsInline autoPlay onLoadedMetadata={seek} onEnded={advance} style={noTouch} />
            : <iframe key={cur.video + sound} src={embed(cur.video, yt.current.s, mon || !sound)} title="Video" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" style={noTouch} />
        )}
        {cur && !cur.countdown && !cur.video && cur.image && (
          <>
            <img src={cur.image} alt="" style={{ ...fill, objectFit: 'contain' }} />
            {cur.text && <div className="cap">{cur.text}</div>}
          </>
        )}
        {cur && !cur.countdown && !cur.video && !cur.image && (
          <div className="slide"><h1>{cur.text || cur.title}</h1>{cur.speaker && <p>{cur.speaker}</p>}</div>
        )}
        {sound && !mon && cur && !cur.video && cur.audio && <audio key={cur.audio} src={cur.audio} autoPlay onLoadedMetadata={seek} onEnded={advance} />}
        {!mon && p.isLive && <span className="livetag">● LIVE</span>}
        {!mon && hasMedia && !sound && <button className="soundbtn" onClick={() => setSound(true)}>🔊 Tap for sound</button>}
        {!mon && <button className="fs" onClick={fullscreen}>Full screen</button>}
      </div>
      {!mon && <section className="now"><h1>{p.title}</h1></section>}
    </main>
  );
}