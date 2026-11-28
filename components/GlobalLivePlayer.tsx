"use client";

import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { usePathname, useRouter } from "next/navigation";

const KEY = "pf-live-id";
const POS = "pf-live-pos";

export default function GlobalLivePlayer() {
  const pathname = usePathname() || "";
  const router = useRouter();
  const [liveId, setLiveId] = useState<string | null>(null);
  const [embed, setEmbed] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    setEmbed(new URLSearchParams(window.location.search).get("embed") === "1");
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) setLiveId(saved);
      const p = localStorage.getItem(POS);
      if (p) setPos(JSON.parse(p));
    } catch {}
  }, []);

  useEffect(() => {
    const m = pathname.match(/^\/live\/([^/]+)/);
    if (m) {
      setLiveId(m[1]);
      try { localStorage.setItem(KEY, m[1]); } catch {}
    }
  }, [pathname]);

  const onLivePage = pathname.startsWith("/live/");
  if (embed || onLivePage || pathname.startsWith("/program/") || !liveId) return null;

  const close = () => {
    try { localStorage.removeItem(KEY); } catch {}
    setLiveId(null);
  };

  const down = (e: RPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button") || !box.current) return;
    const r = box.current.getBoundingClientRect();
    drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const move = (e: RPointerEvent<HTMLDivElement>) => {
    if (!drag.current || !box.current) return;
    const w = box.current.offsetWidth;
    const h = box.current.offsetHeight;
    const x = Math.min(Math.max(0, e.clientX - drag.current.dx), window.innerWidth - w);
    const y = Math.min(Math.max(0, e.clientY - drag.current.dy), window.innerHeight - h);
    setPos({ x, y });
  };

  const up = () => {
    if (!drag.current) return;
    drag.current = null;
    try { if (pos) localStorage.setItem(POS, JSON.stringify(pos)); } catch {}
  };

  const btn = { background: "none", border: 0, color: "#fff", fontSize: 12, padding: 0, cursor: "pointer" } as const;
  const place = pos
    ? { left: Math.max(0, Math.min(pos.x, window.innerWidth - 120)), top: Math.max(0, Math.min(pos.y, window.innerHeight - 80)) }
    : { right: 12, bottom: 12 };

  return (
    <div ref={box} style={{ position: "fixed", ...place, zIndex: 50, width: "min(340px, 80vw)", overflow: "hidden", borderRadius: 12, border: "1px solid rgba(255,255,255,.25)", background: "#000", boxShadow: "0 10px 30px rgba(0,0,0,.5)" }}>
      <div
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#171717", color: "#fff", fontSize: 12, padding: "8px 10px", cursor: "grab", touchAction: "none", userSelect: "none" }}
      >
        <span>● LIVE ⠿ টেনে সরান</span>
        <span style={{ display: "flex", gap: 12 }}>
          <button style={btn} onClick={() => router.push(`/live/${liveId}`)} aria-label="বড় করুন">⤢ বড় করুন</button>
          <button style={btn} onClick={close} aria-label="বন্ধ করুন">✕</button>
        </span>
      </div>
      <iframe
        src={`/live/${liveId}?embed=1`}
        style={{ display: "block", width: "100%", aspectRatio: "16 / 9", border: 0 }}
        allow="autoplay; fullscreen"
        title="Live"
      />
    </div>
  );
}
