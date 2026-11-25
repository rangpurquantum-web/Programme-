'use client';
import { useEffect, useState } from 'react';

type P = { title: string; items: { title: string; speaker: string }[]; currentIndex: number; isLive: boolean };

export default function Live({ params }: { params: { id: string } }) {
  const [p, setP] = useState<P | null>(null);

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
    return () => { on = false; clearInterval(h); };
  }, [params.id]);

  if (!p) return <main className="stage"><p className="who">Loading…</p></main>;
  if (!p.isLive) return <main className="stage"><h1 className="big">{p.title}</h1><p className="who">Starting soon</p></main>;

  const cur = p.items[p.currentIndex];
  const next = p.items[p.currentIndex + 1];
  return (
    <main className="stage">
      <p className="who"><span className="dot" />{p.title}</p>
      <h1 className="big">{cur ? cur.title : 'Program complete'}</h1>
      {cur?.speaker && <p className="who">{cur.speaker}</p>}
      {next && <p className="next">Up next: {next.title}</p>}
    </main>
  );
}
