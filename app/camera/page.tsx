"use client";
import { useRef, useState } from "react";
import {
  Room,
  LocalVideoTrack,
  LocalAudioTrack,
  createLocalVideoTrack,
  createLocalAudioTrack,
} from "livekit-client";

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
      setMsg("");
      vTrack.current = await createLocalVideoTrack({
        facingMode: facing,
        resolution: { width: 1280, height: 720 },
      });
      aTrack.current = await createLocalAudioTrack();
      if (videoRef.current) vTrack.current.attach(videoRef.current);
      setCamOn(true);
    } catch {
      setMsg("ক্যামেরা/মাইক্রোফোনের অনুমতি দিন");
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
      await room.localParticipant.publishTrack(vTrack.current);
      await room.localParticipant.publishTrack(aTrack.current);
      roomRef.current = room;

      try {
        wakeRef.current = await (navigator as any).wakeLock?.request("screen");
      } catch {}
      setLive(true);
      setMsg("");
    } catch (e: any) {
      setMsg(e.message || "লাইভ শুরু করা যায়নি");
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

  const btn = "rounded-xl px-4 py-3 text-sm font-semibold text-white";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-3 bg-black p-4 text-white">
      <h1 className="text-lg font-bold">Live Camera</h1>

      <div className="relative overflow-hidden rounded-xl bg-zinc-900">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="aspect-video w-full object-cover"
        />
        <span
          className={`absolute left-2 top-2 rounded px-2 py-1 text-xs font-bold ${
            live ? "bg-red-600" : "bg-zinc-700"
          }`}
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
          className="rounded-xl bg-zinc-800 px-4 py-3 text-sm outline-none"
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        {!camOn && (
          <button onClick={startCamera} className={`${btn} col-span-2 bg-blue-600`}>
            Start Camera
          </button>
        )}
        {camOn && !live && (
          <button
            onClick={goLive}
            disabled={!passcode}
            className={`${btn} col-span-2 bg-red-600 disabled:opacity-40`}
          >
            Go Live
          </button>
        )}
        {live && (
          <button onClick={stopLive} className={`${btn} col-span-2 bg-zinc-700`}>
            Stop Live
          </button>
        )}
        {camOn && (
          <>
            <button onClick={switchCamera} className={`${btn} bg-zinc-700`}>
              Switch Camera
            </button>
            <button onClick={toggleMic} className={`${btn} bg-zinc-700`}>
              {micOn ? "Mic: On" : "Mic: Off"}
            </button>
          </>
        )}
      </div>

      {msg && <p className="text-sm text-yellow-400">{msg}</p>}
      {live && (
        <p className="text-xs text-zinc-400">
          লাইভ চলাকালীন এই পেজ খোলা ও স্ক্রিন চালু রাখুন।
        </p>
      )}
    </main>
  );
}