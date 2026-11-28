'use client';

import { useState } from 'react';
import { pdfSlides, type PdfSlide } from '@/lib/pdfSlides';

// Turns a PDF (exported from PowerPoint) into one image slide per page, using Cloudinary.
export default function PdfImport({ onDone }: { onDone: (slides: PdfSlide[]) => void }) {
  const [pct, setPct] = useState<number | null>(null);
  const [sec, setSec] = useState('');
  const [msg, setMsg] = useState('');

  function pick(file?: File) {
    if (!file) return;
    const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
    if (!cloud || !preset) {
      setMsg('Cloudinary environment variables are missing');
      return;
    }
    setMsg('');
    setPct(0);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', preset);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloud}/image/upload`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setPct(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onerror = () => {
      setPct(null);
      setMsg('Network error');
    };
    xhr.onload = () => {
      setPct(null);
      let res: any = null;
      try { res = JSON.parse(xhr.responseText); } catch {}
      if (xhr.status < 200 || xhr.status >= 300 || !res || !res.secure_url) {
        setMsg((res && res.error && res.error.message) || 'Upload failed');
        return;
      }
      const pages = Number(res.pages) || 1;
      const s = sec ? Math.round(parseFloat(sec)) : 0;
      const slides = pdfSlides(String(res.secure_url), pages, file.name, s);
      onDone(slides);
      setMsg(`${slides.length} slides added. Open the Slides tab.`);
      fetch('/api/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: res.secure_url, kind: 'pdf', name: file.name, pages }),
      })
        .then(() => window.dispatchEvent(new Event('media-changed')))
        .catch(() => {});
    };
    xhr.send(fd);
  }

  return (
    <>
      <h2>Import PowerPoint (as PDF)</h2>
      <div className="row">
        <input type="number" min="0" step="1" value={sec} onChange={(e) => setSec(e.target.value)} placeholder="Seconds per slide (optional)" />
        <label className="btn ghost" style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
          {pct !== null ? `${pct}%` : 'Choose PDF'}
          <input
            type="file"
            accept="application/pdf"
            hidden
            disabled={pct !== null}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              pick(f);
            }}
          />
        </label>
      </div>
      {msg && <p className="sub">{msg}</p>}
    </>
  );
}
