"use client";
import { useEffect, useRef, useState } from "react";
import {
  Room,
  LocalVideoTrack,
  LocalAudioTrack,
  createLocalVideoTrack,
  createLocalAudioTrack,
} from "livekit-client";

const RES: Record<string, any> = {
  "480": { width: 854, height: 480, aspectRatio: { exact: 16 / 9 } },
  "720": { width: 1280, height: 720, aspectRatio: { exact: 16 / 9 } },
  "1080": { width: 1920, height: 1080, aspectRatio: { exact: 16 / 9 } },
};

type Zoom = { min: number; max: number; step: number; val: number };

const Icon = ({ d, size = 22 }: { d: string; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={d} />
  </svg>
);

const I = {
  flip: "M20 7h-3l-2-2H9L7 7H4a1 1 0 00-1 1v10a1 1 0 001 1h16a1 1 0 001-1V8a1 1 0 00-1-1zM9 13a3 3 0 015.5-1.7M15 13a3 3 0 01-5.5 1.7M14.5 10.5V12h-1.5M9.5 15.5V14H11",
  mic: "M12 15a3 3 0 003-3V6a3 3 0 00-6 0v6a3 3 0 003 3zM19 11a7 7 0 01-14 0M12 18v3",
  micOff: "M3 3l18 18M9 9v3a3 3 0 005 2M15 10V6a3 3 0 00-5.6-1.5M19 11a7 7 0 01-1 3.6M5 11a7 7 0 009 6.6M12 18v3",
  stop: "M6 6h12v12H6z",
  play: "M8 5v14l11-7z",
  cam: "M15 10l5-3v10l-5-3M4 6h10a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 011-1z",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z",
  eyeOff: "M3 3l18 18M10.6 6.1A9.8 9.8 0 0112 6c6 0 10 6 10 6a17 17 0 01-3.2 3.9M6.6 7.6A17 17 0 002 12s4 7 10 7a9.7 9.7 0 004.4-1.1M9.9 9.9a3 3 0 004.2 4.2",
};

const two = (n: number) => String(n).padStart(2, "0");
const clock = (s: number) =>
  `${two(Math.floor(s / 3600))}:${two(Math.floor((s % 3600) / 60))}:${two(s % 60)}`;

export default function CameraPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const roomRef = useRef<Room | null>(null);
  const vTrack = useRef<LocalVideoTrack | null>(null);
  const aTrack = useRef<LocalAudioTrack | null>(null);
  const wakeRef = useRef<any>(null);

  const [passcode, setPasscode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [res, setRes] = useState("720");
  const [zoom, setZoom] = useState<Zoom | null>(null);
  const [camOn, setCamOn] = useState(false);
  const [live, setLive] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [secs, setSecs] = useState(0);

  useEffect(() => {
    if (!live) {
      setSecs(0);
      return;
    }
    const h = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(h);
  }, [live]);

  function readZoom() {
    try {
      const track = vTrack.current?.mediaStreamTrack;
      const caps: any = track?.getCapabilities?.();
      if (caps && caps.zoom && caps.zoom.max > caps.zoom.min) {
        const st: any = track?.getSettings?.();
        setZoom({
          min: caps.zoom.min,
          max: caps.zoom.max,
          step: caps.zoom.step || 0.1,
          val: st?.zoom || caps.zoom.min,
        });
        return;
      }
    } catch {}
    setZoom(null);
  }

  async function applyZoom(v: number) {
    if (!zoom) return;
    const val = Math.min(zoom.max, Math.max(zoom.min, v));
    try {
      await vTrack.current?.mediaStreamTrack.applyConstraints({
        advanced: [{ zoom: val }],
      } as any);
      setZoom({ ...zoom, val });
    } catch {
      setMsg("জুম করা যায়নি");
    }
  }

  async function startCamera() {
    setBusy(true);
    try {
      setMsg("");
      vTrack.current = await createLocalVideoTrack({
        facingMode: facing,
        resolution: { ...RES[res], frameRate: 30 },
      });
      aTrack.current = await createLocalAudioTrack();
      if (videoRef.current) vTrack.current.attach(videoRef.current);
      setCamOn(true);
      readZoom();
    } catch (e: any) {
      setMsg(
        e?.name === "NotAllowedError"
          ? "ক্যামেরা ও মাইক্রোফোনের অনুমতি দিন (ব্রাউজারের সাইট সেটিংস থেকে Allow করুন)"
          : "ক্যামেরা চালু হয়নি: " + (e?.name || "") + " " + (e?.message || "")
      );
    }
    setBusy(false);
  }

  async function changeRes(r: string) {
    setRes(r);
    if (!vTrack.current) return;
    try {
      await vTrack.current.restartTrack({
        facingMode: facing,
        resolution: { ...RES[r], frameRate: 30 },
      });
      readZoom();
    } catch {
      setMsg("এই রেজোলিউশন ফোনে চলছে না");
    }
  }

  async function switchCamera() {
    const next = facing === "environment" ? "user" : "environment";
    try {
      await vTrack.current?.restartTrack({
        facingMode: next,
        resolution: { ...RES[res], frameRate: 30 },
      });
      setFacing(next);
      readZoom();
    } catch {
      setMsg("ক্যামেরা পরিবর্তন করা যায়নি");
    }
  }

  async function toggleMic() {
    if (!aTrack.current) return;
    if (micOn) await aTrack.current.mute();
    else await aTrack.current.unmute();
    setMicOn(!micOn);
  }

  async function goLive() {
    if (!vTrack.current || !aTrack.current) return;
    setBusy(true);
    try {
      setMsg("");
      const r = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Error");

      const room = new Room();
      await room.connect(data.url, data.token);
      await room.localParticipant.publishTrack(vTrack.current, {
        simulcast: false,
        videoEncoding: { maxBitrate: 2_500_000, maxFramerate: 30 },
        degradationPreference: "maintain-framerate",
      });
      await room.localParticipant.publishTrack(aTrack.current);
      roomRef.current = room;

      try {
        wakeRef.current = await (navigator as any).wakeLock?.request("screen");
      } catch {}
      setLive(true);
    } catch (e: any) {
      setMsg("লাইভ শুরু হয়নি: " + (e?.message || ""));
    }
    setBusy(false);
  }

  async function stopLive() {
    roomRef.current?.disconnect(false);
    roomRef.current = null;
    try {
      await wakeRef.current?.release();
    } catch {}
    setLive(false);
  }

  const step = !camOn ? 1 : !live ? 2 : 3;
  const steps = ["ক্যামেরা চালু", "কোড দিন", "লাইভ"];

  return (
    <main className="cam">
      <style>{`
        .cam{min-height:100dvh;box-sizing:border-box;background:radial-gradient(120% 80% at 50% 0%,#1e2a4a 0%,#0b0f1a 55%,#05070d 100%);color:#fff;padding:16px;font-family:"Hind Siliguri","Noto Sans Bengali",system-ui,sans-serif}
        .wrap{max-width:480px;margin:0 auto;display:flex;flex-direction:column;gap:14px}
        .top{display:flex;align-items:center;justify-content:space-between}
        .brand{font-size:18px;font-weight:700;display:flex;align-items:center;gap:8px}
        .pill{display:flex;align-items:center;gap:8px;border-radius:999px;padding:6px 12px;font-size:13px;font-weight:700;background:#27272a;color:#d4d4d8}
        .pill.on{background:#dc2626;color:#fff}
        .dot{width:9px;height:9px;border-radius:50%;background:#fff}
        .pill.on .dot{animation:pulse 1.2s infinite}
        @keyframes pulse{0%{box-shadow:0 0 0 0 rgba(255,255,255,.7)}100%{box-shadow:0 0 0 9px rgba(255,255,255,0)}}
        .steps{display:flex;gap:6px}
        .stp{flex:1;text-align:center;font-size:12px;padding:8px 4px;border-radius:10px;background:#161b2b;color:#71717a;border:1px solid #1f2640}
        .stp.on{background:#1d3a8a;color:#fff;border-color:#3b82f6}
        .stp.done{color:#4ade80;border-color:#14532d}
        .video{position:relative;aspect-ratio:16/9;background:#000;border-radius:18px;overflow:hidden;border:1px solid #232a44;box-shadow:0 10px 30px rgba(0,0,0,.5)}
        .video video{transform:none !important;width:100%;height:100%;object-fit:contain;background:#000}
        .ph{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#71717a;font-size:14px}
        .badge{position:absolute;top:10px;left:10px;display:flex;align-items:center;gap:6px;border-radius:8px;padding:5px 10px;font-size:12px;font-weight:700;background:rgba(0,0,0,.6)}
        .badge.live{background:#dc2626}
        .time{position:absolute;top:10px;right:10px;border-radius:8px;padding:5px 10px;font-size:12px;font-weight:700;background:rgba(0,0,0,.6);font-variant-numeric:tabular-nums}
        .card{background:#11162a;border:1px solid #1f2640;border-radius:16px;padding:14px;display:flex;flex-direction:column;gap:12px}
        .lbl{font-size:13px;color:#a1a1aa;font-weight:600}
        .seg{display:flex;background:#0b0f1a;border-radius:12px;padding:4px;gap:4px}
        .seg button{flex:1;border:none;border-radius:9px;padding:10px 0;font-size:14px;font-weight:700;background:transparent;color:#a1a1aa}
        .seg button.on{background:#2563eb;color:#fff}
        .zrow{display:flex;align-items:center;gap:10px}
        .zbtn{width:42px;height:42px;border-radius:12px;border:none;background:#232a44;color:#fff;font-size:22px;font-weight:700}
        .zrow input[type=range]{flex:1;accent-color:#3b82f6;height:28px}
        .zval{width:44px;text-align:right;font-size:13px;font-variant-numeric:tabular-nums}
        .field{position:relative}
        .field input{width:100%;box-sizing:border-box;background:#0b0f1a;color:#fff;border:1px solid #232a44;border-radius:12px;padding:15px 52px 15px 14px;font-size:16px;outline:none}
        .field input:focus{border-color:#3b82f6}
        .eye{position:absolute;right:6px;top:50%;transform:translateY(-50%);background:none;border:none;color:#a1a1aa;padding:10px}
        .ctrls{display:flex;gap:10px;align-items:center}
        .round{width:56px;height:56px;border-radius:50%;border:none;background:#232a44;color:#fff;display:flex;align-items:center;justify-content:center;flex:none}
        .round.off{background:#7f1d1d}
        .main{flex:1;height:56px;border:none;border-radius:16px;font-size:17px;font-weight:700;color:#fff;display:flex;align-items:center;justify-content:center;gap:10px}
        .main:disabled{opacity:.45}
        .blue{background:linear-gradient(135deg,#2563eb,#1d4ed8)}
        .red{background:linear-gradient(135deg,#ef4444,#dc2626)}
        .grey{background:#3f3f46}
        .msg{border-radius:12px;padding:12px 14px;font-size:14px;background:#3a2e07;color:#fde68a;border:1px solid #6b5410}
        .hint{font-size:12px;color:#71717a;text-align:center;line-height:1.5}
      `}</style>

      <div className="wrap">
        <div className="top">
          <div className="brand">
            <Icon d={I.cam} /> লাইভ ক্যামেরা
          </div>
          <div className={`pill ${live ? "on" : ""}`}>
            <span className="dot" style={{ background: live ? "#fff" : "#71717a" }} />
            {live ? "লাইভ চলছে" : camOn ? "প্রস্তুত" : "বন্ধ"}
          </div>
        </div>

        <div className="steps">
          {steps.map((t, i) => (
            <div
              key={t}
              className={`stp ${step === i + 1 ? "on" : step > i + 1 ? "done" : ""}`}
            >
              {step > i + 1 ? "✓ " : `${i + 1}. `}
              {t}
            </div>
          ))}
        </div>

        <div className="video">
          <video ref={videoRef} autoPlay muted playsInline />
          {!camOn && (
            <div className="ph">
              <Icon d={I.cam} size={40} />
              ক্যামেরা বন্ধ আছে
            </div>
          )}
          {camOn && (
            <span className={`badge ${live ? "live" : ""}`}>
              {live ? "● LIVE" : "প্রিভিউ"}
            </span>
          )}
          {live && <span className="time">{clock(secs)}</span>}
        </div>

        {camOn && (
          <div className="card">
            <div className="lbl">ছবির মান</div>
            <div className="seg">
              {["480", "720", "1080"].map((r) => (
                <button key={r} className={res === r ? "on" : ""} onClick={() => changeRes(r)}>
                  {r}p
                </button>
              ))}
            </div>
            {zoom ? (
              <>
                <div className="lbl">জুম</div>
                <div className="zrow">
                  <button
                    className="zbtn"
                    onClick={() => applyZoom(zoom.val - Math.max(zoom.step, 0.2))}
                  >
                    −
                  </button>
                  <input
                    type="range"
                    min={zoom.min}
                    max={zoom.max}
                    step={zoom.step}
                    value={zoom.val}
                    onChange={(e) => applyZoom(parseFloat(e.target.value))}
                  />
                  <button
                    className="zbtn"
                    onClick={() => applyZoom(zoom.val + Math.max(zoom.step, 0.2))}
                  >
                    +
                  </button>
                  <span className="zval">{zoom.val.toFixed(1)}x</span>
                </div>
              </>
            ) : (
              <div className="hint">এই ক্যামেরায় জুম নেই (পেছনের ক্যামেরা ব্যবহার করে দেখুন)</div>
            )}
          </div>
        )}

        {camOn && !live && (
          <div className="card">
            <div className="lbl">ক্যামেরা কোড</div>
            <div className="field">
              <input
                type={showCode ? "text" : "password"}
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="কোডটি লিখুন"
                autoComplete="off"
              />
              <button className="eye" onClick={() => setShowCode(!showCode)} aria-label="দেখান">
                <Icon d={showCode ? I.eyeOff : I.eye} />
              </button>
            </div>
          </div>
        )}

        {msg && <div className="msg">{msg}</div>}

        <div className="ctrls">
          {camOn && (
            <button className="round" onClick={switchCamera} aria-label="ক্যামেরা পরিবর্তন">
              <Icon d={I.flip} />
            </button>
          )}

          {!camOn && (
            <button className="main blue" onClick={startCamera} disabled={busy}>
              <Icon d={I.cam} /> {busy ? "চালু হচ্ছে..." : "ক্যামেরা চালু করুন"}
            </button>
          )}
          {camOn && !live && (
            <button className="main red" onClick={goLive} disabled={!passcode || busy}>
              <Icon d={I.play} /> {busy ? "সংযোগ হচ্ছে..." : "লাইভ শুরু করুন"}
            </button>
          )}
          {live && (
            <button className="main grey" onClick={stopLive}>
              <Icon d={I.stop} /> লাইভ বন্ধ করুন
            </button>
          )}

          {camOn && (
            <button
              className={`round ${micOn ? "" : "off"}`}
              onClick={toggleMic}
              aria-label="মাইক"
            >
              <Icon d={micOn ? I.mic : I.micOff} />
            </button>
          )}
        </div>

        <div className="hint">
          {live
            ? "লাইভ চলাকালীন এই পেজ খোলা ও ফোনের স্ক্রিন চালু রাখুন। সবচেয়ে ভালো ছবির জন্য ফোন পাশ করে ধরুন।"
            : "সবচেয়ে ভালো ছবির জন্য ফোন পাশ করে (ল্যান্ডস্কেপ) ধরুন এবং Wi-Fi ব্যবহার করুন।"}
        </div>
      </div>
    </main>
  );
}
