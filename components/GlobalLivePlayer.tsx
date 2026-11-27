"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function GlobalLivePlayer() {
  const pathname = usePathname() || "";
  const router = useRouter();
  const [liveId, setLiveId] = useState<string | null>(null);
  const [embed, setEmbed] = useState(false);

  useEffect(() => {
    setEmbed(new URLSearchParams(window.location.search).get("embed") === "1");
    const saved = sessionStorage.getItem("pf-live-id");
    if (saved) setLiveId(saved);
  }, []);

  useEffect(() => {
    const m = pathname.match(/^\/live\/([^/]+)/);
    if (m) {
      setLiveId(m[1]);
      sessionStorage.setItem("pf-live-id", m[1]);
    }
  }, [pathname]);

  const onLivePage = pathname.startsWith("/live/");
  if (embed || onLivePage || !liveId) return null;

  const close = () => {
    sessionStorage.removeItem("pf-live-id");
    setLiveId(null);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[300px] overflow-hidden rounded-xl border border-white/20 bg-black shadow-2xl sm:w-[380px]">
      <div className="flex items-center justify-between bg-neutral-900 px-3 py-1.5 text-xs text-white">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
          LIVE
        </span>
        <span className="flex gap-3">
          <button onClick={() => router.push(`/live/${liveId}`)} aria-label="বড় করুন">
            ⤢ বড় করুন
          </button>
          <button onClick={close} aria-label="বন্ধ করুন">
            ✕
          </button>
        </span>
      </div>
      <iframe
        src={`/live/${liveId}?embed=1`}
        className="aspect-video w-full border-0"
        allow="autoplay; fullscreen"
        title="Live"
      />
    </div>
  );
}