'use client';
import { useEffect, useRef, useState } from 'react';

type Item = { title: string; speaker?: string; text?: string; image?: string; audio?: string; video?: string; countdown?: number };
type P = { title: string; items: Item[]; startAt: string | null; background: string; shownAt: string | null; serverNow: string; currentIndex: number; isLive: boolean };
type Star = { t: number; l: number; d: number };

const bn = (s: string) => s.replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[+d]);
const two = (n: number) => bn(String(n).padStart(2, '0'));

function embed(url: string, auto: boolean) {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|live\/|embed\/|shorts\/))([\w-]{11})/);
  const u = m ? `https://www.youtube.com/embed/${m[1]}` : url;
  return auto ? u + (u.includes('?') ? '&' : '?') + 'autoplay=1' : u;
}

function left(ms: number) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d} days ${h} hours`;
  if (h > 0) return `${h} hours ${m} min`;
  return `${m} min ${s % 60} sec`;
}

const fill = { position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 } as const;
const isFile = (u: string) => /\.(m3u8|mp4|webm)(\?|$)/i.test(u);

export default function Live({ params }: { params: { id: string } }) {
  const [p, setP] = useState<P | null>(null);
  const [now, setNow] = useState(Date.now());
  const [skew, setSkew] = useState(0);
  const [ready, setReady] = useState(false);
  const [host, setHost] = useState(false);
  const [stars, setStars] = useState<Star[]>([]);
  const box = useRef<HTMLDivElement>(null);
  const moved = useRef('');

  useEffect(() => {
    setHost(new URLSearchParams(window.location.search).get('host') === '1');
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
    if (!host || !p) return;
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

  const cur = p && p.isLive ? p.items[p.currentIndex] : undefined;
  const secs = cur?.countdown && p?.shownAt ? Math.max(0, Math.ceil((new Date(p.shownAt).getTime() + cur.countdown * 1000 - (now + skew)) / 1000)) : -1;

  useEffect(() => { if (secs === 0) advance(); });

  function fullscreen() {
    const el = box.current as any;
    if (!el) return;
    (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
  }

  if (!p) return <main className="live"><p className="now">Loading…</p></main>;

  const wait = p.startAt ? new Date(p.startAt).getTime() - (now + skew) : 0;
  const bg = p.background;
  const bgStyle = bg && bg !== 'night' ? { backgroundImage: `url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined;

  return (
    <main className="live">
      {wait > 0 && <div className="count"><span>The program will start in:</span><b>{left(wait)}</b></div>}
      <div className={`player ${bg === 'night' ? 'night' : ''}`} style={bgStyle} ref={box}>
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
            ? <video key={cur.video + ready} src={cur.video} controls playsInline autoPlay={ready} onEnded={advance} style={fill} />
            : <iframe key={cur.video + ready} src={embed(cur.video, ready)} title="Video" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen style={fill} />
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
        {ready && cur && !cur.video && cur.audio && <audio key={cur.audio} src={cur.audio} autoPlay onEnded={advance} />}
        {cur && !ready && <button className="playbtn" onClick={() => setReady(true)} aria-label="Play">▶</button>}
        <button className="fs" onClick={fullscreen}>Full screen</button>
      </div>
      <section className="now"><h1>{p.title}</h1></section>
    </main>
  );
}