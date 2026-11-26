'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

type Item = { title: string; speaker: string; note: string; mediaUrl?: string; mediaType?: 'video' | 'audio' };
type P = { _id: string; title: string; items: Item[]; currentIndex: number; isLive: boolean };

function uploadToCloudinary(file: File, onProgress: (n: number) => void): Promise<string> {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  return new Promise((resolve, reject) => {
    if (!cloud || !preset) return reject(new Error('Cloudinary environment variables are missing'));
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', preset);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloud}/auto/upload`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const res = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && res.secure_url) resolve(res.secure_url);
        else reject(new Error(res.error?.message || 'Upload failed'));
      } catch {
        reject(new Error('Upload failed'));
      }
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(fd);
  });
}

export default function Control({ params }: { params: { id: string } }) {
  const [p, setP] = useState<P | null>(null);
  const [t, setT] = useState('');
  const [s, setS] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const r = await fetch(`/api/programs/${params.id}`, { cache: 'no-store' });
    if (r.ok) setP(await r.json());
  }, [params.id]);
  useEffect(() => { load(); }, [load]);

  async function save(patch: Partial<P>) {
    const r = await fetch(`/api/programs/${params.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
    if (r.ok) setP(await r.json());
  }

  async function addItem() {
    if (!p || !t.trim()) return;
    setErr('');
    const item: Item = { title: t.trim(), speaker: s.trim(), note: '' };
    try {
      if (file) {
        setProgress(0);
        item.mediaUrl = await uploadToCloudinary(file, setProgress);
        item.mediaType = file.type.startsWith('video') ? 'video' : 'audio';
      }
      await save({ items: [...p.items, item] });
      setT(''); setS(''); setFile(null);
    } catch (e) {
      setErr('Upload failed: ' + (e as Error).message);
    } finally {
      setProgress(null);
    }
  }

  if (!p) return <main className="wrap">Loading…</main>;
  const last = p.items.length - 1;
  const go = (i: number) => save({ currentIndex: Math.max(0, Math.min(last, i)) });
  const busy = progress !== null;

  return (
    <main className="wrap">
      <p><Link href="/">← All programs</Link></p>
      <h1>{p.title}</h1>
      <p className="sub">{p.isLive ? 'Live now. Viewers see the current item.' : 'Not live yet.'}</p>

      <div className="row">
        <button className={p.isLive ? 'live' : ''} onClick={() => save({ isLive: !p.isLive })}>{p.isLive ? 'Stop live' : 'Go live'}</button>
        <Link className="btn ghost" href={`/live/${p._id}`} target="_blank">Open live screen</Link>
      </div>
      <div className="row">
        <button className="ghost" onClick={() => go(p.currentIndex - 1)} disabled={p.currentIndex <= 0}>Previous</button>
        <button onClick={() => go(p.currentIndex + 1)} disabled={p.currentIndex >= last}>Next item</button>
      </div>

      {p.items.length === 0 && <div className="empty">Add the first item of your program below.</div>}
      {p.items.map((it, i) => (
        <div className={`item ${i === p.currentIndex && p.isLive ? 'now' : ''}`} key={i}>
          <div>
            <strong>{i + 1}. {it.title}</strong>
            {it.speaker && <small>{it.speaker}</small>}
            {it.mediaUrl && <small>{it.mediaType === 'video' ? '🎬 Video attached' : '🎵 Audio attached'}</small>}
          </div>
          <div className="row" style={{ margin: 0 }}>
            <button className="ghost" onClick={() => go(i)}>Show</button>
            <button className="ghost" onClick={() => save({ items: p.items.filter((_, j) => j !== i), currentIndex: 0 })}>Remove</button>
          </div>
        </div>
      ))}

      <div className="row" style={{ marginTop: 16 }}>
        <input value={t} onChange={(e) => setT(e.target.value)} placeholder="Item title" />
        <input value={s} onChange={(e) => setS(e.target.value)} placeholder="Speaker (optional)" />
      </div>
      <div className="row">
        <input type="file" accept="video/*,audio/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <button onClick={addItem} disabled={busy}>{busy ? `Uploading ${progress}%` : 'Add item'}</button>
      </div>
      {err && <p style={{ color: 'var(--live)' }}>{err}</p>}
    </main>
  );
}