'use client';
import { useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';

export default function CameraView({ cam = 1, sound }: { cam?: number; sound: boolean }) {
  const vref = useRef<HTMLVideoElement>(null);
  const aref = useRef<HTMLAudioElement>(null);
  const [state, setState] = useState<'wait' | 'live' | 'error'>('wait');
  const [fit, setFit] = useState<'cover' | 'contain'>('contain');
  const [mirror, setMirror] = useState(false);
  const [flip, setFlip] = useState(false);

  useEffect(() => {
    setFlip(new URLSearchParams(window.location.search).get('flip') === '1');
  }, []);

  const fitIt = () => {
    const v = vref.current;
    const box = v?.parentElement;
    if (!v || !box || !v.videoWidth || !v.videoHeight) return;
    const vr = v.videoWidth / v.videoHeight;
    const br = box.clientWidth / Math.max(box.clientHeight, 1);
    setFit(Math.abs(vr - br) / br < 0.2 ? 'cover' : 'contain');
  };

  useEffect(() => {
    window.addEventListener('resize', fitIt);
    document.addEventListener('fullscreenchange', fitIt);
    return () => {
      window.removeEventListener('resize', fitIt);
      document.removeEventListener('fullscreenchange', fitIt);
    };
  }, []);

  useEffect(() => {
    const h: { room: Room | null; dead: boolean } = { room: null, dead: false };
    const want = 'cam' + cam;
    setState('wait');

    async function start() {
      try {
        const res = await fetch('/api/livekit/view-token', { method: 'POST' });
        const d = await res.json();
        if (!res.ok || h.dead) throw new Error('token');
        const room = new Room({ adaptiveStream: false, dynacast: false });
        h.room = room;
        const sync = () => {
          let hasVideo = false;
          let front = false;
          room.remoteParticipants.forEach((p) => {
            if (p.identity !== want) return;
            if (p.attributes?.facing === 'user') front = true;
            p.trackPublications.forEach((pub) => {
              const t = pub.track;
              if (!t) return;
              if (t.kind === Track.Kind.Video && vref.current) {
                t.attach(vref.current);
                hasVideo = true;
              }
              if (t.kind === Track.Kind.Audio && aref.current) t.attach(aref.current);
            });
          });
          setMirror(front);
          setState(hasVideo ? 'live' : 'wait');
        };
        room.on(RoomEvent.TrackSubscribed, sync);
        room.on(RoomEvent.TrackUnsubscribed, sync);
        room.on(RoomEvent.ParticipantConnected, sync);
        room.on(RoomEvent.ParticipantDisconnected, sync);
        room.on(RoomEvent.ParticipantAttributesChanged, sync);
        await room.connect(d.url, d.token);
        if (h.dead) {
          room.disconnect();
          return;
        }
        sync();
      } catch {
        if (!h.dead) {
          setState('error');
          setTimeout(() => {
            if (!h.dead) start();
          }, 4000);
        }
      }
    }

    start();
    return () => {
      h.dead = true;
      h.room?.disconnect();
    };
  }, [cam]);

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#000' }}>
      <video
        ref={vref}
        autoPlay
        muted
        playsInline
        onLoadedMetadata={fitIt}
        onResize={fitIt}
        style={{
          width: '100%',
          height: '100%',
          objectFit: fit,
          transform: flip || mirror ? 'scaleX(-1)' : 'none',
        }}
      />
      <audio ref={aref} autoPlay muted={!sound} />
      {state !== 'live' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#000',
            color: '#fff',
            fontSize: '1.2rem',
            textAlign: 'center',
            padding: 12,
          }}
        >
          {state === 'error' ? 'Camera unavailable' : 'Waiting for Camera ' + cam + '…'}
        </div>
      )}
    </div>
  );
}
