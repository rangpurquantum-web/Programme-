'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  program: string;
  title?: string;
  text?: string;
  sub?: string;
  secs?: number; // 0 or more = a break countdown is running
  bg?: string;
  image?: string;
  media?: 'video' | 'audio' | '';
  banner?: string;
};

const W = 640;
const H = 360;
const FONT = '"Hind Siliguri","Noto Sans Bengali",sans-serif';
const bnDigits = (s: string) => s.replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[+d]);
const two = (n: number) => bnDigits(String(n).padStart(2, '0'));

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  const lines: string[] = [];
  let line = '';
  for (const w of text.split(/\s+/)) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

function cover(ctx: CanvasRenderingContext2D, im: HTMLImageElement) {
  const s = Math.max(W / im.naturalWidth, H / im.naturalHeight);
  const w = im.naturalWidth * s;
  const h = im.naturalHeight * s;
  ctx.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
}

function contain(ctx: CanvasRenderingContext2D, im: HTMLImageElement) {
  const s = Math.min(W / im.naturalWidth, H / im.naturalHeight);
  const w = im.naturalWidth * s;
  const h = im.naturalHeight * s;
  ctx.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
}

function draw(ctx: CanvasRenderingContext2D, p: Props, img: (u?: string) => HTMLImageElement | null) {
  const bg = p.bg || '';
  const bgIm = bg && bg !== 'night' && !bg.startsWith('code:') ? img(bg) : null;
  if (bg === 'night') {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#02050f');
    g.addColorStop(1, '#032a1d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else {
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, W, H);
    if (bgIm) cover(ctx, bgIm);
  }

  const slideIm = img(p.image);
  if (slideIm) contain(ctx, slideIm);

  let main = p.text || p.title || p.program;
  let sub = p.sub || '';
  if (p.secs !== undefined && p.secs >= 0) {
    sub = `${two(Math.floor(p.secs / 60))} মিনিট ${two(p.secs % 60)} সেকেন্ড`;
  } else if (p.media === 'video') {
    sub = 'ভিডিও চলছে';
  } else if (p.media === 'audio') {
    sub = 'অডিও চলছে';
  }
  if (slideIm) main = p.text || '';

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.shadowColor = 'rgba(0,0,0,.7)';
  ctx.shadowBlur = 8;
  if (main) {
    ctx.font = `700 40px ${FONT}`;
    const lines = wrap(ctx, main, W - 60).slice(0, 4);
    const lh = 50;
    const y0 = H / 2 - ((lines.length - 1) * lh) / 2 - (sub ? 18 : 0);
    lines.forEach((l, i) => ctx.fillText(l, W / 2, y0 + i * lh));
  }
  if (sub) {
    ctx.font = `400 28px ${FONT}`;
    ctx.fillStyle = '#d1d5db';
    ctx.fillText(sub, W / 2, H - 80);
  }
  ctx.shadowBlur = 0;

  if (p.banner) {
    ctx.fillStyle = 'rgba(220,38,38,.9)';
    ctx.fillRect(0, H - 44, W, 44);
    ctx.fillStyle = '#fff';
    ctx.font = `700 24px ${FONT}`;
    ctx.fillText(p.banner.slice(0, 60), W / 2, H - 22);
  }
}

export default function MiniWindow(props: Props) {
  const latest = useRef(props);
  latest.current = props;
  const [ok, setOk] = useState(false);
  const [on, setOn] = useState(false);
  const [err, setErr] = useState('');
  const stop = useRef<(() => void) | null>(null);
  const imgs = useRef<Map<string, HTMLImageElement>>(new Map());

  useEffect(() => {
    const embed = new URLSearchParams(window.location.search).get('embed') === '1';
    setOk(!embed && !!(document as any).pictureInPictureEnabled);
    return () => {
      if (stop.current) stop.current();
    };
  }, []);

  // Lets the phone show the program name in the notification while audio plays.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: props.title || props.program, artist: props.program });
    } catch {}
  }, [props.title, props.program]);

  const getImg = (url?: string) => {
    if (!url) return null;
    let im = imgs.current.get(url);
    if (!im) {
      im = new Image();
      im.crossOrigin = 'anonymous';
      im.src = url;
      imgs.current.set(url, im);
    }
    return im.complete && im.naturalWidth > 0 ? im : null;
  };

  async function toggle() {
    setErr('');
    const doc = document as any;
    if (doc.pictureInPictureElement) {
      try { await doc.exitPictureInPicture(); } catch {}
      return;
    }
    let timer: ReturnType<typeof setInterval> | undefined;
    let video: HTMLVideoElement | null = null;
    const end = () => {
      if (timer) clearInterval(timer);
      if (video) {
        const s = video.srcObject as MediaStream | null;
        if (s) s.getTracks().forEach((t) => t.stop());
        video.remove();
      }
      video = null;
      stop.current = null;
      setOn(false);
    };
    try {
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas not available');
      const paint = () => draw(ctx, latest.current, getImg);
      paint();
      video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.style.cssText = 'position:fixed;left:-9999px;top:0;width:2px;height:2px';
      document.body.appendChild(video);
      video.srcObject = canvas.captureStream(5);
      await video.play();
      timer = setInterval(paint, 250);
      video.addEventListener('leavepictureinpicture', end, { once: true });
      stop.current = end;
      await video.requestPictureInPicture();
      setOn(true);
    } catch (e) {
      end();
      setErr('Mini window could not start: ' + (e as Error).message);
    }
  }

  if (!ok) return null;
  return (
    <>
      <button className="soundbtn" style={{ left: 'auto', right: 8, bottom: 64 }} onClick={toggle}>
        {on ? 'Close mini window' : '📌 Mini window'}
      </button>
      {err && <div style={{ position: 'absolute', left: 8, right: 8, bottom: 112, zIndex: 100, color: '#fecaca', fontSize: 12 }}>{err}</div>}
    </>
  );
}
