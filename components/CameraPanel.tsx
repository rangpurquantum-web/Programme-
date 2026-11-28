'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Room,
  LocalVideoTrack,
  LocalAudioTrack,
  createLocalVideoTrack,
  createLocalAudioTrack,
} from 'livekit-client';

const RES: Record<string, any> = {
  '480': { width: 854, height: 480, aspectRatio: { exact: 16 / 9 } },
  '720': { width: 1280, height: 720, aspectRatio: { exact: 16 / 9 } },
  '1080': { width: 1920, height: 1080, aspectRatio: { exact: 16 / 9 } },
};

type Zoom = { min: number; max: number; step: number; val: number };

const two = (n: number) => String(n).padStart(2, '0');
const clock = (s: number) =>
  `${two(Math.floor(s / 3600))}:${two(Math.floor((s % 3600) / 60))}:${two(s % 60)}`;

export default function CameraPanel() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const roomRef = useRef<Room | null>(null);
  const vTrack = useRef<LocalVideoTrack | null>(null);
  const aTrack = useRef<LocalAudioTrack | null>(null);
  const wakeRef = useRef<any>(null);

  const [passcode, setPasscode] = useState('');
  const [facing, setFacing] = useState<'environment' | 'user'>('user');
  const [res, setRes] = useState('720');
  const [zoom, setZoom] = useState<Zoom | null>(null);
  const [camOn, setCamOn] = useState(false);
  const [live, setLive] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [secs, setSecs] = useState(0);

  useEffect(() => {
    if (!live) {
      setSecs(0);
      return;
    }
    const h = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(h);
  }, [live]);

  useEffect(() => {
    return () => {
      roomRef.current?.disconnect(false);
      vTrack.current?.stop();
      aTrack.current?.stop();
    };
  }, []);

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
      await vTrack.current?.mediaStreamTrack.applyConstraints({ advanced: [{ zoom: val }] } as any);
      setZoom({ ...zoom, val });
    } catch {
      setMsg('জুম করা যায়নি');
    }
  }

  async function startCamera() {
    setBusy(true);
    try {
      setMsg('');
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
        e?.name === 'NotAllowedError'
          ? 'ক্যামেরা ও মাইক্রোফোনের অনুমতি দিন (সাইট সেটিংস থেকে Allow করুন)'
          : 'ক্যামেরা চালু হয়নি: ' + (e?.name || '') + ' ' + (e?.message || '')
      );
    }
    setBusy(false);
  }

  async function changeRes(r: string) {
    setRes(r);
    if (!vTrack.current) return;
    try {
      await vTrack.current.restartTrack({ facingMode: facing, resolution: { ...RES[r], frameRate: 30 } });
      readZoom();
    } catch {
      setMsg('এই রেজোলিউশন চলছে না');
    }
  }

  async function switchCamera() {
    const next = facing === 'environment' ? 'user' : 'environment';
    try {
      await vTrack.current?.restartTrack({ facingMode: next, resolution: { ...RES[res], frameRate: 30 } });
      setFacing(next);
      roomRef.current?.localParticipant.setAttributes({ facing: next }).catch(() => {});
      readZoom();
    } catch {
      setMsg('ক্যামেরা পরিবর্তন করা যায়নি');
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
      setMsg('');
      const r = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Error');
      const room = new Room();
      await room.connect(data.url, data.token);
      await room.localParticipant.publishTrack(vTrack.current, {
        simulcast: false,
        videoEncoding: { maxBitrate: 2_500_000, maxFramerate: 30 },
        degradationPreference: 'maintain-framerate',
      });
      await room.localParticipant.publishTrack(aTrack.current);
      roomRef.current = room;
      room.localParticipant.setAttributes({ facing }).catch(() => {});
      try {
        wakeRef.current = await (navigator as any).wakeLock?.request('screen');
      } catch {}
      setLive(true);
    } catch (e: any) {
      setMsg('লাইভ শুরু হয়নি: ' + (e?.message || ''));
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

  return (
    <div className="cp">
      <style>{`
        .cp{display:flex;flex-direction:column;gap:12px}
        .cp .vid{position:relative;aspect-ratio:16/9;background:#000;border-radius:16px;overflow:hidden;border:1px solid #1f2640}
        .cp .vid video{transform:none !important;width:100%;height:100%;object-fit:contain;background:#000}
        .cp .ph{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#71717a;font-size:14px}
        .cp .bd{position:absolute;top:8px;left:8px;border-radius:8px;padding:4px 10px;font-size:12px;font-weight:700;background:rgba(0,0,0,.6);color:#fff}
        .cp .bd.live{background:#dc2626}
        .cp .tm{position:absolute;top:8px;right:8px;border-radius:8px;padding:4px 10px;font-size:12px;font-weight:700;background:rgba(0,0,0,.6);color:#fff}
        .cp .card{background:#11162a;border:1px solid #1f2640;border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:10px}
        .cp .lb{font-size:12px;color:#8da0c8;font-weight:600}
        .cp .seg{display:flex;gap:6px}
        .cp .seg button{flex:1;padding:10px 0;font-size:14px;font-weight:700;border-radius:10px;background:#161d36;border:1px solid #232c4d}
        .cp .seg button.on{background:#2563eb;border-color:#2563eb}
        .cp .z{display:flex;align-items:center;gap:8px}
        .cp .z input[type=range]{flex:1;min-width:0;accent-color:#3b82f6;padding:0;border:0;background:none}
        .cp .z button{width:42px;padding:0;font-size:20px;background:#161d36;border:1px solid #232c4d}
        .cp .row2{display:flex;gap:8px}
        .cp .row2 button{flex:1}
        .cp .msg{border-radius:10px;padding:10px 12px;font-size:14px;background:#3a2e07;color:#fde68a;border:1px solid #6b5410}
        .cp .go{background:linear-gradient(135deg,#ef4444,#dc2626)!important}
        .cp .st{background:#3f3f46!important}
        .cp .off{background:#7f1d1d!important}
      `}</style>

      <div className="vid">
        <video ref={videoRef} autoPlay muted playsInline />
        {!camOn && <div className="ph">ক্যামেরা বন্ধ আছে</div>}
        {camOn && <span className={`bd ${live ? 'live' : ''}`}>{live ? '● LIVE' : 'প্রিভিউ'}</span>}
        {live && <span className="tm">{clock(secs)}</span>}
      </div>

      {msg && <div className="msg">{msg}</div>}

      {!camOn && (
        <div className="row2">
          <button onClick={startCamera} disabled={busy}>{busy ? 'চালু হচ্ছে...' : 'ক্যামেরা চালু করুন'}</button>
        </div>
      )}

      {camOn && !live && (
        <div className="card">
          <div className="lb">ক্যামেরা কোড</div>
          <input type="password" value={passcode} onChange={(e) => setPasscode(e.target.value)} placeholder="কোডটি লিখুন" autoComplete="off" />
          <button className="go" onClick={goLive} disabled={!passcode || busy}>{busy ? 'সংযোগ হচ্ছে...' : 'লাইভ শুরু করুন'}</button>
        </div>
      )}

      {live && (
        <button className="st" onClick={stopLive}>লাইভ বন্ধ করুন</button>
      )}

      {camOn && (
        <div className="card">
          <div className="lb">ছবির মান</div>
          <div className="seg">
            {['480', '720', '1080'].map((r) => (
              <button key={r} className={res === r ? 'on' : ''} onClick={() => changeRes(r)}>{r}p</button>
            ))}
          </div>
          {zoom ? (
            <>
              <div className="lb">জুম</div>
              <div className="z">
                <button onClick={() => applyZoom(zoom.val - Math.max(zoom.step, 0.2))}>−</button>
                <input type="range" min={zoom.min} max={zoom.max} step={zoom.step} value={zoom.val} onChange={(e) => applyZoom(parseFloat(e.target.value))} />
                <button onClick={() => applyZoom(zoom.val + Math.max(zoom.step, 0.2))}>+</button>
                <span style={{ width: 40, textAlign: 'right', fontSize: 13 }}>{zoom.val.toFixed(1)}x</span>
              </div>
            </>
          ) : (
            <div className="lb">এই ক্যামেরায় জুম নেই</div>
          )}
          <div className="row2">
            <button className="ghost" onClick={switchCamera}>ক্যামেরা বদলান</button>
            <button className={micOn ? 'ghost' : 'off'} onClick={toggleMic}>{micOn ? 'মাইক: চালু' : 'মাইক: বন্ধ'}</button>
          </div>
        </div>
      )}

      <p className="sub">ক্যামেরা চালু থাকা অবস্থায় অন্য ট্যাবে গেলেও লাইভ চলবে। তবে ব্রাউজার বন্ধ করলে বা স্ক্রিন বন্ধ হলে থেমে যাবে।</p>
    </div>
  );
}
