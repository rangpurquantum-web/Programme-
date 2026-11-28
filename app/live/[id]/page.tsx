'use client';

import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { locate } from '@/lib/timeline';
import MiniWindow from '@/components/MiniWindow';
import CameraView from '@/components/CameraView';

type Item = {
  title: string;
  speaker?: string;
  text?: string;
  image?: string;
  audio?: string;
  video?: string;
  countdown?: number;
  duration?: number;
  show?: number;
  size?: string;
  font?: string;
  color?: string;
  auto?: boolean;
  camera?: boolean;
};

type Ui = {
  blackout?: boolean;
  banner?: { text: string; on: boolean };
  ticker?: { text: string; on: boolean };
};

type P = {
  title: string;
  items: Item[];
  startAt: string | null;
  background: string;
  shownAt: string | null;
  serverNow: string;
  currentIndex: number;
  isLive: boolean;
  ui?: Ui;
};

type Star = { t: number; l: number; d: number };

const FONTS: Record<string, string> = {
  bn: '"Hind Siliguri","Noto Sans Bengali",sans-serif',
  bnserif: '"Noto Serif Bengali",serif',
  ar: '"Noto Naskh Arabic",serif',
};

const bn = (s: string) =>
  s.replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[+d]);

const two = (n: number) =>
  bn(String(n).padStart(2, '0'));

function embed(url: string, start: number, mute: boolean) {
  const m = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|live\/|embed\/|shorts\/))([\w-]{11})/
  );

  const u = m
    ? `https://www.youtube.com/embed/${m[1]}`
    : url;

  const q = [
    'autoplay=1',
    'controls=0',
    'disablekb=1',
    'playsinline=1',
    'rel=0',
    'iv_load_policy=3', 'cc_load_policy=0', 'enablejsapi=1', 'fs=0'
  ];

  if (mute) q.push('mute=1');
  if (start > 1) q.push(`start=${start}`);

  return u + (u.includes('?') ? '&' : '?') + q.join('&');
}

function left(ms: number) {
  const s = Math.floor(ms / 1000);

  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);

  if (d > 0) return `${d} days ${h} hours`;
  if (h > 0) return `${h} hours ${m} min`;

  return `${m} min ${s % 60} sec`;
}

const fill = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  border: 0
} as const;

const noTouch = {
  ...fill,
  pointerEvents: 'none'
} as const;

const isFile = (u: string) =>
  !/(?:youtu\.be\/|youtube\.com\/)/i.test(u);


// Hides YouTube captions (auto-generated or not) on the embedded player.
const killCaptions = (e: SyntheticEvent<HTMLIFrameElement>) => {
  const w = e.currentTarget.contentWindow;
  const send = () => ['captions', 'cc'].forEach((m) => w?.postMessage(JSON.stringify({ event: 'command', func: 'unloadModule', args: [m] }), '*'));
  [0, 800, 2500, 5000].forEach((ms) => setTimeout(send, ms));
};

export default function Live({ params }: { params: { id: string } }) {

  const [p, setP] = useState<P | null>(null);
  const [now, setNow] = useState(Date.now());
  const [skew, setSkew] = useState(0);

  const [sound, setSound] = useState(false);
  const [host, setHost] = useState(false);
  const [mon, setMon] = useState(false);
  const [slide, setSlide] = useState<number | null>(null);

  const [stars, setStars] = useState<Star[]>([]);

  // Picture-in-Picture state
  const [isPiP, setIsPiP] = useState(false);

  const box = useRef<HTMLDivElement>(null);
  const vid = useRef<HTMLVideoElement>(null);

  const prevIdx = useRef<number | null>(null);
  const t0 = useRef(Date.now());

  const yt = useRef({ k: '', s: 0 });


  // INITIAL LOAD

  useEffect(() => {

    const q = new URLSearchParams(window.location.search);

    setHost(q.get('host') === '1');
    setMon(q.get('mon') === '1');

    const sl = q.get('slide');

    setSlide(
      sl !== null && !isNaN(parseInt(sl))
        ? parseInt(sl)
        : null
    );

    t0.current = Date.now();

    setStars(
      Array.from(
        { length: 90 },
        () => ({
          t: Math.random() * 100,
          l: Math.random() * 100,
          d: Math.random() * 3
        })
      )
    );

    let on = true;

    async function tick() {
      try {
        const r = await fetch(
          `/api/programs/${params.id}`,
          { cache: 'no-store' }
        );

        if (r.ok && on) {
          const d = await r.json();

          setP(d);

          setSkew(
            new Date(d.serverNow).getTime() - Date.now()
          );
        }

      } catch {}
    }

    tick();

    const h = setInterval(tick, 1000);
    const c = setInterval(() => setNow(Date.now()), 1000);

    return () => {
      on = false;
      clearInterval(h);
      clearInterval(c);
    };

  }, [params.id]);


  // TIMELINE

  const items = p ? p.items : [];

  const baseMs =
    slide !== null
      ? t0.current
      : p?.shownAt
        ? new Date(p.shownAt).getTime()
        : 0;

  const nowMs =
    slide !== null
      ? now
      : now + skew;

  const eff = locate(
    items,
    slide !== null ? slide : p ? p.currentIndex : 0,
    baseMs ? (nowMs - baseMs) / 1000 : 0,
    slide === null
  );

  const idx = eff.index;

  const showing = !!p && (slide !== null || p.isLive);

  const dark = !!p?.ui?.blackout && slide === null;

  const cur = showing ? items[idx] : undefined;

  const c =
    cur && !eff.over && !dark
      ? cur
      : undefined;

  const secs = c?.countdown
    ? Math.max(0, Math.ceil(c.countdown - eff.t))
    : -1;

  const clock = () =>
    (Date.now() + (slide !== null ? 0 : skew) - baseMs) / 1000
    - eff.offset;


  // ALERT SOUND

  useEffect(() => {

    if (!p) return;

    const pi = prevIdx.current;

    prevIdx.current = idx;

    if (
      host &&
      slide === null &&
      pi !== null &&
      idx > pi &&
      p.items[pi]?.countdown
    ) {
      try {
        new Audio('/alert.mp3').play().catch(() => {});
      } catch {}
    }

  });


  // VIDEO SYNCHRONIZATION

  useEffect(() => {

    const h = setInterval(() => {

      const v = vid.current;

      if (!v || v.readyState < 2) return;

      const t = clock();

      if (!(t >= 0) || t >= (v.duration || Infinity)) return;

      if (Math.abs(v.currentTime - t) > 2.5) {
        v.currentTime = t;
      }

      if (v.paused) {
        v.play().catch(() => {});
      }

    }, 3000);

    return () => clearInterval(h);

  });


  // PICTURE IN PICTURE

  async function togglePiP() {

    const video = vid.current;

    if (!video) return;

    try {

      if (document.pictureInPictureElement) {

        await document.exitPictureInPicture();

      } else if (
        document.pictureInPictureEnabled &&
        video.readyState >= 1
      ) {

        await video.requestPictureInPicture();

      }

    } catch (error) {

      console.error(
        'Picture-in-Picture error:',
        error
      );

    }

  }


  // PIP EVENT LISTENERS

  useEffect(() => {

    const video = vid.current;

    if (!video) return;

    const enter = () => setIsPiP(true);
    const leave = () => setIsPiP(false);

    video.addEventListener(
      'enterpictureinpicture',
      enter
    );

    video.addEventListener(
      'leavepictureinpicture',
      leave
    );

    return () => {

      video.removeEventListener(
        'enterpictureinpicture',
        enter
      );

      video.removeEventListener(
        'leavepictureinpicture',
        leave
      );

    };

  }, [idx, c?.video]);


  // FULLSCREEN

  function fullscreen() {

    const el = box.current as any;

    if (!el) return;

    (
      el.requestFullscreen ||
      el.webkitRequestFullscreen
    )?.call(el);

  }


  if (!p) {
    return (
      <main className="live">
        <p className="now">Loading…</p>
      </main>
    );
  }


  // MEDIA SEEK

  const seek = (e: SyntheticEvent<HTMLMediaElement>) => {

    const t = clock();

    if (t > 1.5) {
      e.currentTarget.currentTime = t;
    }

  };


  const yk = `${idx}:${p.shownAt}:${sound}:${slide}`;

  if (yt.current.k !== yk) {

    yt.current = {
      k: yk,
      s: Math.max(0, Math.floor(clock()))
    };

  }


  // BACKGROUND

  const wait = p.startAt
    ? new Date(p.startAt).getTime() - (now + skew)
    : 0;

  const bg = p.background || '';

  const isCode = bg.startsWith('code:');

  const bgStyle =
    bg && bg !== 'night' && !isCode
      ? {
          backgroundImage: `url(${bg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }
      : undefined;

  const hasMedia =
    !!c &&
    !c.countdown &&
    !!(c.video || c.audio || c.camera);

  const ui: Ui = p.ui || {};

  const banner = ui.banner;
  const ticker = ui.ticker;

  const tickOn = !!(
    ticker &&
    ticker.on &&
    ticker.text
  );

  const sz = c?.size || 'md';

  const ts = c
    ? {
        color: c.color || undefined,
        fontFamily: FONTS[c.font || '']
      }
    : {};


  // RENDER

  return (

    <main className={`live ${mon ? 'monpage' : ''}`}>

      {!mon && wait > 0 && (

        <div className="count">

          <span>The program will start in:</span>

          <b>{left(wait)}</b>

        </div>

      )}


      <div
        className={`player ${bg === 'night' ? 'night' : ''} ${tickOn ? 'has-tick' : ''}`}
        style={bgStyle}
        ref={box}
      >


        {/* CUSTOM BACKGROUND */}

        {isCode && (

          <iframe
            srcDoc={`<style>html,body{margin:0;height:100%;overflow:hidden}</style>${bg.slice(5)}`}
            sandbox="allow-scripts"
            title="Background"
            style={noTouch}
          />

        )}


        {/* NIGHT BACKGROUND */}

        {bg === 'night' && (

          <>

            <div className="stars">

              {stars.map((s, i) => (

                <i
                  key={i}
                  style={{
                    top: `${s.t}%`,
                    left: `${s.l}%`,
                    animationDelay: `${s.d}s`
                  }}
                />

              ))}

            </div>

            <div className="moon" />

          </>

        )}


        {/* EMPTY SLIDE - STARTING SOON REMOVED */}

        {!cur && (

          <div className="slide">

            <h1>{p.title}</h1>

          </div>

        )}


        {/* COUNTDOWN */}

        {c && c.countdown && (

          <div className={`slide sz-${sz}`}>

            <h1 style={ts}>
              {c.text || c.title}
            </h1>

            <p className="big">

              {two(Math.floor(secs / 60))}
              {' '}মিনিট{' '}
              {two(secs % 60)}
              {' '}সেকেন্ড

            </p>

          </div>

        )}


        {/* VIDEO */}

        {c && !c.countdown && c.video && (

          isFile(c.video)

            ? (

              <video
                ref={vid}
                preload="auto"
                controlsList="nodownload noremoteplayback"
                onContextMenu={(e) => e.preventDefault()}
                key={c.video + sound + idx}
                src={c.video}
                muted={mon || !sound}
                playsInline
                autoPlay
                onLoadedMetadata={seek}
                style={noTouch}
              />

            )

            : (

              <iframe
                key={c.video + sound + idx}
                src={embed(
                  c.video,
                  yt.current.s,
                  mon || !sound
                )}
                title="Video"
                allow="autoplay; fullscreen; picture-in-picture; encrypted-media" onLoad={killCaptions}
                style={noTouch}
              />

            )

        )}


        {c && !c.countdown && c.camera && (
          <CameraView sound={sound && !mon} />
        )}

        {/* IMAGE */}

        {c && !c.countdown && !c.video && c.image && (

          <img
            src={c.image}
            alt=""
            style={{
              ...fill,
              objectFit: 'contain'
            }}
          />

        )}


        {/* CAPTION */}

        {c && !c.countdown && (c.video || c.image) && c.text && (

          <div className={`cap sz-${sz}`} style={ts}>
            {c.text}
          </div>

        )}


        {/* SPEAKER */}

        {c && !c.countdown && (c.video || c.image) && c.speaker && (

          <div className="spk">
            {c.speaker}
          </div>

        )}


        {/* TEXT SLIDE */}

        {c && !c.countdown && !c.camera && !c.video && !c.image && (

          <div className={`slide sz-${sz}`}>

            <h1 style={ts}>
              {c.text || c.title}
            </h1>

            {c.speaker && (
              <p>{c.speaker}</p>
            )}

          </div>

        )}


        {/* AUDIO */}

        {sound && !mon && c && !c.countdown && !c.video && c.audio && (

          <audio
            key={c.audio + idx}
            src={c.audio}
            autoPlay
            onLoadedMetadata={seek}
          />

        )}


        {/* BANNER */}

        {banner && banner.on && banner.text && (

          <div className="annc">
            {banner.text}
          </div>

        )}


        {/* TICKER */}

        {tickOn && ticker && (

          <div className="tick">

            <span
              style={{
                animationDuration: `${Math.max(
                  12,
                  ticker.text.length * 0.3
                )}s`
              }}
            >
              {ticker.text}
            </span>

          </div>

        )}


        {/* BLACKOUT */}

        {dark && <div className="blackout" />}


        {/* LIVE TAG */}

        {!mon && p.isLive && (

          <span className="livetag">
            ● LIVE
          </span>

        )}


        {/* SOUND BUTTON */}

        {!mon && hasMedia && !sound && (

          <button
            className="soundbtn"
            onClick={() => setSound(true)}
          >
            🔊 Tap for sound
          </button>

        )}


        {/* PICTURE IN PICTURE BUTTON */}

        {!mon &&
          c &&
          !c.countdown &&
          c.video &&
          isFile(c.video) && (

            <button
              className="pipbtn"
              onClick={togglePiP}
              style={{
                position: 'absolute',
                bottom: '20px',
                right: '130px',
                zIndex: 100,
                padding: '10px 16px',
                background: 'rgba(0,0,0,0.8)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.4)',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >

              {isPiP
                ? 'Exit Mini Player'
                : 'Picture in Picture'}

            </button>

          )}


        {!mon && (
          <MiniWindow
            program={p.title}
            title={c?.title}
            text={c?.text}
            sub={c?.speaker}
            secs={c?.countdown ? secs : undefined}
            bg={bg}
            image={c && !c.countdown && !c.video ? c.image : undefined}
            media={c?.video ? 'video' : c?.audio ? 'audio' : ''}
            banner={banner && banner.on ? banner.text : undefined}
          />
        )}
        {/* FULLSCREEN */}

        {!mon && (

          <button
            className="fs"
            onClick={fullscreen}
          >
            Full screen
          </button>

        )}

      </div>


      {/* PROGRAM TITLE */}

      {!mon && (

        <section className="now">

          <h1>{p.title}</h1>

        </section>

      )}

    </main>

  );

}
