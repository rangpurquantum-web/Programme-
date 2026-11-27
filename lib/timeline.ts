export type Timed = { countdown?: number; video?: string; audio?: string; duration?: number; show?: number };

// How many seconds a slide lasts on its own. 0 = it stays until you push another slide.
export const lenOf = (it: Timed) => (it.countdown ? it.countdown : it.video || it.audio ? it.duration || it.show || 0 : it.show || 0);

// Works out which slide is showing, from the slide you pushed and the seconds since the push.
export function locate(items: Timed[], start: number, elapsed: number, chain: boolean) {
  let i = Math.min(Math.max(start, 0), Math.max(items.length - 1, 0));
  let t = Math.max(elapsed, 0);
  let offset = 0;
  for (;;) {
    const len = items[i] ? lenOf(items[i]) : 0;
    if (!len || t < len) return { index: i, t, offset, over: false };
    if (!chain || i >= items.length - 1) return { index: i, t, offset, over: true };
    t -= len;
    offset += len;
    i++;
  }
}