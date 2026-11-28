'use client';

import { useCallback, useEffect, useState } from 'react';

export type MediaItem = { id: string; url: string; kind: 'image' | 'audio' | 'video' | 'pdf'; name: string; pages: number | null };
type Slideish = { image?: string; audio?: string; video?: string };

const ICON = { image: '🖼️', audio: '🎵', video: '🎬', pdf: '📄' };
const isCld = (u: string) => u.startsWith('https://res.cloudinary.com/') && !/\/upload\/[a-z]+_[^/]*\//i.test(u);

export default function MediaLibrary({ onUse, slides }: { onUse: (m: MediaItem) => void; slides: Slideish[] }) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/media', { cache: 'no-store' });
      if (r.ok) setItems(await r.json());
    } catch {}
  }, []);

  useEffect(() => {
    load();
    window.addEventListener('media-changed', load);
    return () => window.removeEventListener('media-changed', load);
  }, [load]);

  async function del(m: MediaItem) {
    if (!confirm(`Delete "${m.name || m.kind}"? Slides that use this file will stop showing it.`)) return;
    setMsg('');
    const r = await fetch(`/api/media/${m.id}`, { method: 'DELETE' });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) {
      setMsg(j.error || 'Delete failed');
      return;
    }
    if (j.cloudinary === false) setMsg('Removed from this list only. To delete the file from Cloudinary too, add CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in Vercel.');
    load();
  }

  // Adds files already used by your slides (uploaded before the library existed).
  async function pull() {
    setMsg('');
    const seen = new Set(items.map((i) => i.url));
    let added = 0;
    for (const s of slides) {
      for (const kind of ['image', 'audio', 'video'] as const) {
        const url = s[kind];
        if (!url || seen.has(url) || !isCld(url)) continue;
        seen.add(url);
        await fetch('/api/media', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, kind }) }).catch(() => {});
        added++;
      }
    }
    setMsg(added ? `${added} files added to the list` : 'No new Cloudinary files found in your slides');
    load();
  }

  const thumb = (m: MediaItem) => (m.kind === 'image' ? m.url.replace('/upload/', '/upload/w_96,h_64,c_fill,q_auto/') : '');

  return (
    <>
      <h2>Uploaded files</h2>
      <div className="row">
        <button className="ghost" onClick={() => setOpen(!open)}>{open ? 'Hide' : `Show (${items.length})`}</button>
        <button className="ghost" onClick={pull}>Add files from my slides</button>
      </div>
      {msg && <p className="sub">{msg}</p>}
      {open && (
        <div style={{ maxHeight: 320, overflowY: 'auto', display: 'grid', gap: 8 }}>
          {items.length === 0 && <p className="sub">Nothing here yet. New uploads appear here automatically.</p>}
          {items.map((m) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid rgba(255,255,255,.15)', borderRadius: 8, padding: 8 }}>
              {thumb(m) ? <img src={thumb(m)} alt="" width={64} height={43} style={{ objectFit: 'cover', borderRadius: 4 }} /> : <span style={{ fontSize: 28, width: 64, textAlign: 'center' }}>{ICON[m.kind]}</span>}
              <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>
                {m.name || m.kind}
                {m.kind === 'pdf' && m.pages ? ` (${m.pages} pages)` : ''}
              </div>
              <button className="ghost" onClick={() => onUse(m)}>{m.kind === 'pdf' ? 'Add pages' : 'Use'}</button>
              <button className="ghost" onClick={() => del(m)}>Delete</button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
