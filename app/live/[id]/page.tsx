'use client';
import { useEffect, useState } from 'react';

type Stream = { name: string; url: string };
type P = { title: string; items: { title: string; speaker: string }[]; streams: Stream[]; startAt: string | null; currentIndex: number; isLive: boolean };

function embed(url: string) {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|live\/|embed\/|shorts\/))([\w-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : url;
}

function left(ms: number) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d} days ${h} hours`;
  if (h > 0) return `${h} hours ${m} min`;
  return `${m} min ${s % 60} sec`;
}

export default function Live({ params }: { params: { id: string } }) {
  const [p, setP] = useState<P | null>(null);
  const [tab, setTab] = useState(0);
  const [now, setNow] = useState(Date.now());

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

  if (!p) return <main className="live"><p className="now">Loading…</p></main>;

  const wait = p.startAt ? new Date(p.startAt).getTime() - now : 0;
  const stream = p.streams[tab] || p.streams[0];
  const cur = p.items[p.currentIndex];

  return (
    <main className="live">
      {wait > 0 && <div className="count"><span>The program will start in:</span><b>{left(wait)}</b></div>}
      {p.streams.length > 0 && (
        <>
          <div className="tabs">
            {p.streams.map((st, i) => (
              <button key={i} className={i === tab ? '' : 'ghost'} onClick={() => setTab(i)}>{st.name}</button>
            ))}
          </div>
          <div className="player">
            <iframe key={tab} src={embed(stream.url)} title={stream.name} allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen />
          </div>
        </>
      )}
      <section className="now">
        <h1>{p.title}</h1>
        {p.isLive && cur ? <p><strong>{cur.title}</strong>{cur.speaker ? ` · ${cur.speaker}` : ''}</p> : <p>Starting soon</p>}
      </section>
    </main>
  );
}