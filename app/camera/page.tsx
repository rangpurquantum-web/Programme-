"use client";
import { useRef, useState } from "react";
import {
  Room,
  LocalVideoTrack,
  LocalAudioTrack,
  createLocalVideoTrack,
  createLocalAudioTrack,
} from "livekit-client";

const RES: Record<string, { width: number; height: number }> = {
  "480": { width: 854, height: 480, aspectRatio: { exact: 16 / 9 } as any },
  "720": { width: 1280, height: 720, aspectRatio: { exact: 16 / 9 } as any },
  "1080": { width: 1920, height: 1080, aspectRatio: { exact: 16 / 9 } as any },
};

type Zoom = { min: number; max: number; step: number; val: number };

const btn = (bg: string, full = false): React.CSSProperties => ({
  background: bg,
  color: "#fff",
  border: "none",
  borderRadius: 12,
  padding: "14px 16px",
  fontSize: 15,
  fontWeight: 600,
  gridColumn: full ? "1 / 3" : undefined,
});

export default function CameraPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const roomRef = useRef<Room | null>(null);
  const vTrack = useRef<LocalVideoTrack | null>(null);
  const aTrack = useRef<LocalAudioTrack | null>(null);
  const wakeRef = useRef<any>(null);

  const [passcode, setPasscode] = useState("");
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [res, setRes] = useState("720");
  const [zoom, setZoom] = useState<Zoom | null>(null);
  const [camOn, setCamOn] = useState(false);
  const [live, setLive] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [msg, setMsg] = useState("");

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
    try {
      setMsg("ক্যামেরা চালু হচ্ছে...");
      vTrack.current = await createLocalVideoTrack({
        facingMode: facing,
        resolution: { ...RES[res], frameRate: 30 },
      });
      aTrack.current = await createLocalAudioTrack();
      if (videoRef.current) vTrack.current.attach(videoRef.current);
      setCamOn(true);
      setMsg("");
      readZoom();
    } catch (e: any) {
      setMsg("ক্যামেরা চালু হয়নি: " + (e?.name || "") + " " + (e?.message || ""));
    }
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
    try {
      setMsg("সংযোগ হচ্ছে...");
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
      setMsg("");
    } catch (e: any) {
      setMsg("লাইভ শুরু হয়নি: " + (e?.message || ""));
    }
  }

  async function stopLive() {
    roomRef.current?.disconnect(false);
    roomRef.current = null;
    try {
      await wakeRef.current?.release();
    } catch {}
    setLive(false);
  }

  const chip = (on: boolean): React.CSSProperties => ({
    flex: 1,
    background: on ? "#2563eb" : "#3f3f46",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "10px 0",
    fontSize: 14,
    fontWeight: 600,
  });

  return (
    <main
      style={{
        maxWidth: 420,
        margin: "0 auto",
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        boxSizing: "border-box",
      }}
    >
      <h1 style={{ fontSize: 20, margin: 0 }}>Live Camera</h1>

      <div
        style={{
          position: "relative",
          background: "#18181b",
          borderRadius: 12,
          overflow: "hidden",
          aspectRatio: "16 / 9",
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
        <span
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            background: live ? "#dc2626" : "#3f3f46",
            borderRadius: 6,
            padding: "4px 8px",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {live ? "● LIVE" : camOn ? "Preview" : "Camera Off"}
        </span>
      </div>

      {camOn && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 8 }}>
            {["480", "720", "1080"].map((r) => (
              <button key={r} onClick={() => changeRes(r)} style={chip(res === r)}>
                {r}p
              </button>
            ))}
          </div>

          {zoom ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                onClick={() => applyZoom(zoom.val - Math.max(zoom.step, 0.2))}
                style={{ ...chip(false), flex: "none", width: 44 }}
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
                style={{ flex: 1 }}
              />
              <button
                onClick={() => applyZoom(zoom.val + Math.max(zoom.step, 0.2))}
                style={{ ...chip(false), flex: "none", width: 44 }}
              >
                +
              </button>
              <span style={{ fontSize: 13, width: 40, textAlign: "right" }}>
                {zoom.val.toFixed(1)}x
              </span>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: "#a1a1aa", margin: 0 }}>
              এই ক্যামেরায় জুম সাপোর্ট নেই (পেছনের ক্যামেরা ব্যবহার করে দেখুন)।
            </p>
          )}
        </div>
      )}

      {!live && (
        <input
          type="password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder="ক্যামেরা কোড"
          style={{
            background: "#27272a",
            color: "#fff",
            border: "none",
            borderRadius: 12,
            padding: "14px 16px",
            fontSize: 15,
          }}
        />
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {!camOn && (
          <button onClick={startCamera} style={btn("#2563eb", true)}>
            Start Camera
          </button>
        )}
        {camOn && !live && (
          <button
            onClick={goLive}
            disabled={!passcode}
            style={{ ...btn("#dc2626", true), opacity: passcode ? 1 : 0.4 }}
          >
            Go Live
          </button>
        )}
        {live && (
          <button onClick={stopLive} style={btn("#3f3f46", true)}>
            Stop Live
          </button>
        )}
        {camOn && (
          <>
            <button onClick={switchCamera} style={btn("#3f3f46")}>
              Switch Camera
            </button>
            <button onClick={toggleMic} style={btn("#3f3f46")}>
              {micOn ? "Mic: On" : "Mic: Off"}
            </button>
          </>
        )}
      </div>

      {msg && <p style={{ color: "#facc15", fontSize: 14, margin: 0 }}>{msg}</p>}
      {live && (
        <p style={{ color: "#a1a1aa", fontSize: 12, margin: 0 }}>
          লাইভ চলাকালীন এই পেজ খোলা ও স্ক্রিন চালু রাখুন।
        </p>
      )}
    </main>
  );
}
