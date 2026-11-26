'use client';
import { useEffect, useRef, useState } from 'react';

type Item = { title: string; speaker?: string; text?: string; image?: string; audio?: string; video?: string };
type P = { title: string; items: Item[]; startAt: string | null; currentIndex: number; isLive: boolean };

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

export default function Live({ params }: { params: { id: string } }) {
  const [p, setP] = useState<P | null>(null);
  const [now, setNow] = useState(Date.now());
  const [ready, setReady] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let on = true;
    async function tick() {
      try {
        const r = await fetch(`/api/programs/${params.id}`, { cache: 'no-store' });
        if (r.ok && on) setP(await r.json());
      } catch {}
    }
    tick();
    const h = setInterval(tick, 2000);
    const c = setInterval(() => setNow(Date.now()), 1000);
    return () => { on = false; clearInterval(h); clearInterval(c); };
  }, [params.id]);

  function fullscreen() {
    const el = box.current as any;
    if (!el) return;
    (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
  }

  if (!p) return <main className="live"><p className="now">Loading…</p></main>;

  const wait = p.startAt ? new Date(p.startAt).getTime() - now : 0;
  const cur = p.isLive ? p.items[p.currentIndex] : undefined;
  const isFile = (u: string) => /\.(m3u8|mp4|webm)(\?|$)/i.test(u);

  return (
    <main className="live">
      {wait > 0 && <div className="count"><span>The program will start in:</span><b>{left(wait)}</b></div>}
      <div className="player" ref={box}>
        {!cur && <div className="slide"><h1>{p.title}</h1><p>Starting soon</p></div>}
        {cur && cur.video && (
          isFile(cur.video)
            ? <video key={cur.video + ready} src={cur.video} controls playsInline autoPlay={ready} style={fill} />
            : <iframe key={cur.video + ready} src={embed(cur.video, ready)} title="Video" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen style={fill} />
        )}
        {cur && !cur.video && cur.image && (
          <>
            <img src={cur.image} alt="" style={{ ...fill, objectFit: 'contain' }} />
            {cur.text && <div className="cap">{cur.text}</div>}
          </>
        )}
        {cur && !cur.video && !cur.image && (
          <div className="slide"><h1>{cur.text || cur.title}</h1>{cur.speaker && <p>{cur.speaker}</p>}</div>
        )}
        {ready && cur && !cur.video && cur.audio && <audio key={cur.audio} src={cur.audio} autoPlay />}
        {cur && !ready && <button className="playbtn" onClick={() => setReady(true)} aria-label="Play">▶</button>}
        <button className="fs" onClick={fullscreen}>Full screen</button>
      </div>
      <section className="now"><h1>{p.title}</h1></section>
    </main>
  );
}