/**
 * The work reel.
 *
 * The server paints the ring at a guessed size; this re-measures it
 * whenever the reel changes size. Each tile also moves on to the
 * next photo in the list while it is hidden round the back, so the
 * stream reads in order however many tiles fit.
 */
import { SPEED, shapeFor, measure, reelVars, keyframes } from "../lib/reel.ts";

type Photo = { title: string; src: string };

const el = document.querySelector<HTMLElement>("#reel");
const stage = el?.querySelector<HTMLElement>(".reel-stage");
const turn = document.querySelector<HTMLStyleElement>("#reelTurn");
const first = stage?.firstElementChild;

if (el && stage && turn && first) {
  let photos: Photo[] = [];
  try {
    photos = JSON.parse(el.dataset.work ?? "[]") as Photo[];
  } catch {
    photos = [];
  }

  const template = first.cloneNode(true) as HTMLElement;
  let columns = stage.children.length;

  const paint = (col: Element, k: number) => {
    const p = photos[k % photos.length];
    if (!p) return;
    col.querySelectorAll("img").forEach((img) => (img.src = p.src));
    col.querySelectorAll("span").forEach((s) => (s.textContent = p.title));
  };

  new ResizeObserver(([entry]) => {
    if (!entry) return;
    const { width, height } = entry.contentRect;
    const shape = shapeFor(width);
    const reel = measure(width, height, shape);
    Object.entries(reelVars(shape, reel)).forEach(([k, v]) => el.style.setProperty(k, v));
    turn.textContent = keyframes(shape, reel);
    if (reel.columns === columns) return;
    columns = reel.columns;
    stage.replaceChildren(
      ...Array.from({ length: columns }, (_, x) => {
        const col = template.cloneNode(true) as HTMLElement;
        col.style.animationDelay = `${-x * SPEED}s`;
        paint(col, columns - 1 - x);
        return col;
      }),
    );
  }).observe(el);

  // A tile comes back into view moments after it changes photo, so
  // every photo is fetched once the reel is close.
  new IntersectionObserver(
    (entries, io) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      photos.forEach((p) => (new Image().src = p.src));
    },
    { rootMargin: "600px" },
  ).observe(el);

  stage.addEventListener("animationiteration", (e) => {
    const x = Array.prototype.indexOf.call(stage.children, e.target);
    if (x < 0) return;
    const lap = Math.round(e.elapsedTime / (columns * SPEED));
    paint(e.target as Element, lap * columns + columns - 1 - x);
  });
}
