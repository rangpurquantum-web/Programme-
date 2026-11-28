"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const KEY = "pf-live-id";

export default function GlobalLivePlayer() {
  const pathname = usePathname() || "";
  const router = useRouter();
  const [liveId, setLiveId] = useState<string | null>(null);
  const [embed, setEmbed] = useState(false);

  useEffect(() => {
    setEmbed(new URLSearchParams(window.location.search).get("embed") === "1");
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) setLiveId(saved);
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
  const onControl = pathname.startsWith("/program/");
  if (embed || onLivePage || onControl || !liveId) return null;

  const close = () => {
    try { localStorage.removeItem(KEY); } catch {}
    setLiveId(null);
  };

  const btn = { background: "none", border: 0, color: "#fff", fontSize: 12, padding: 0, cursor: "pointer" } as const;

  return (
    <div style={{ position: "fixed", right: 12, bottom: 12, zIndex: 50, width: "min(340px, 80vw)", overflow: "hidden", borderRadius: 12, border: "1px solid rgba(255,255,255,.25)", background: "#000", boxShadow: "0 10px 30px rgba(0,0,0,.5)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#171717", color: "#fff", fontSize: 12, padding: "6px 10px" }}>
        <span>● LIVE</span>
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
