'use client';
import { useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';

export default function CameraView({ sound }: { sound: boolean }) {
  const vref = useRef<HTMLVideoElement>(null);
  const aref = useRef<HTMLAudioElement>(null);
  const [state, setState] = useState<'wait' | 'live' | 'error'>('wait');
  const [fit, setFit] = useState<'cover' | 'contain'>('contain');
  const fitIt = (e: any) => {
    const v = e.currentTarget as HTMLVideoElement;
    if (v.videoWidth && v.videoHeight) setFit(v.videoWidth / v.videoHeight > 1.5 ? 'cover' : 'contain');
  };

  useEffect(() => {
    const h: { room: Room | null; dead: boolean } = { room: null, dead: false };

    async function start() {
      try {
        const res = await fetch('/api/livekit/view-token', { method: 'POST' });
        const d = await res.json();
        if (!res.ok || h.dead) throw new Error('token');
        const room = new Room({ adaptiveStream: false, dynacast: false });
        h.room = room;
        const sync = () => {
          let hasVideo = false;
          room.remoteParticipants.forEach((p) => {
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
          setState(hasVideo ? 'live' : 'wait');
        };
        room.on(RoomEvent.TrackSubscribed, sync);
        room.on(RoomEvent.TrackUnsubscribed, sync);
        room.on(RoomEvent.ParticipantConnected, sync);
        room.on(RoomEvent.ParticipantDisconnected, sync);
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
  }, []);

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#000' }}>
      <video
        ref={vref}
        autoPlay
        muted
        playsInline
        onLoadedMetadata={fitIt}
        onResize={fitIt}
        style={{ width: '100%', height: '100%', objectFit: fit }}
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
            fontSize: '1.4rem',
          }}
        >
          {state === 'error' ? 'Camera unavailable' : 'Waiting for Camera…'}
        </div>
      )}
    </div>
  );
}
