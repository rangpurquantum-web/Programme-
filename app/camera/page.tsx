"use client";
import { useRef, useState } from "react";
import {
  Room,
  LocalVideoTrack,
  LocalAudioTrack,
  createLocalVideoTrack,
  createLocalAudioTrack,
} from "livekit-client";

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
  const [camOn, setCamOn] = useState(false);
  const [live, setLive] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [msg, setMsg] = useState("");

  async function startCamera() {
    try {
      setMsg("ক্যামেরা চালু হচ্ছে...");
      vTrack.current = await createLocalVideoTrack({ facingMode: facing, resolution: { width: 1280, height: 720, frameRate: 30 } });
      aTrack.current = await createLocalAudioTrack();
      if (videoRef.current) vTrack.current.attach(videoRef.current);
      setCamOn(true);
      setMsg("");
    } catch (e: any) {
      setMsg("ক্যামেরা চালু হয়নি: " + (e?.name || "") + " " + (e?.message || ""));
    }
  }

  async function switchCamera() {
    const next = facing === "environment" ? "user" : "environment";
    try {
      await vTrack.current?.restartTrack({ facingMode: next });
      setFacing(next);
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
      const res = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");

      const room = new Room();
      await room.connect(data.url, data.token);
      await room.localParticipant.publishTrack(vTrack.current, {
        simulcast: false,
        videoEncoding: { maxBitrate: 1_800_000, maxFramerate: 30 },
        degradationPreference: 'maintain-framerate',
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
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
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
