/**
 * The work reel's geometry: a stream of photos on a ring that curves
 * towards you at the edges. After ruixen.ui's Tilted Grid Hero (MIT).
 *
 * The viewer stands DEPTH ring-radii back from the flat centre, and
 * the ring is sized so a tile `curve` degrees round lands exactly on
 * the reel's edge. Each tile is cut into SLICES upright strips, each
 * turned a little further round, so a flat photo reads as bent.
 *
 * Shared by the server, which paints the first frame at a guessed
 * size, and scripts/reel.ts, which re-measures in the browser.
 */

export interface ReelShape {
  /** Tile height, as a percentage of the reel's height. */
  tile: number;
  /** How far round the edges bend, in degrees. */
  curve: number;
}

export interface Reel {
  columns: number;
  /** Half the angle a tile travels in one lap, in degrees. */
  sweep: number;
  /** The angle one tile-height of ring subtends, in degrees. */
  unit: number;
  /** Past this angle a tile is hidden while it goes round the back. */
  limit: number;
}

export const ASPECT = 4 / 3;
export const SLICES = 16;
/** Seconds between one tile and the next. */
export const SPEED = 5;
const GAP = 6; // % of tile height
// The viewer sits inside the ring, and the far edge of an edge tile
// swings round towards them. At 1.6 that edge reached the viewer
// itself at some widths, which GPUs draw as a flicker; at 1.8 it
// stays at least 16° clear at every width from 340px to 2560px.
const DEPTH = 1.8;
const MAX_W = 55; // tile width cap, % of the reel's width

/** A phone-width ring bent as hard as a desktop one folds its tiles in half. */
export const shapeFor = (width: number): ReelShape =>
  width < 720 ? { tile: 46, curve: 55 } : { tile: 40, curve: 80 };

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const round = (n: number) => +n.toFixed(4);

/** The ring's radius, as a fraction of the reel's width. */
const arc = (curve: number) =>
  (DEPTH - 1 + Math.cos(rad(curve))) / (2 * DEPTH * Math.sin(rad(curve)));

export function measure(width: number, height: number, shape: ReelShape): Reel {
  const tile = Math.min((shape.tile / 100) * height, ((MAX_W / 100) * width) / ASPECT);
  const radius = width * arc(shape.curve);
  if (!(tile > 0) || !(radius > 0)) return { columns: 2, sweep: 0, unit: 0, limit: 0 };
  const unit = deg(tile / radius);
  const step = (ASPECT + GAP / 100) * unit;
  // Far enough round that a tile has fully left before it is hidden.
  const reach = shape.curve + (ASPECT * unit) / 2;
  const columns = Math.min(60, Math.max(2, Math.ceil((2 * reach) / step)));
  const sweep = round((columns * step) / 2);
  return { columns, sweep, unit: round(unit), limit: round(Math.min(sweep, reach)) };
}

/** Custom properties for the reel's root; the CSS does the rest. */
export function reelVars(shape: ReelShape, reel: Reel): Record<string, string> {
  const ring = 100 * arc(shape.curve);
  return {
    "--tile": `min(${shape.tile}cqh, ${round(MAX_W / ASPECT)}cqw)`,
    "--aspect": String(round(ASPECT)),
    "--ring": `${round(ring)}cqw`,
    "--view": `${round(ring * DEPTH)}cqw`,
    "--unit": `${reel.unit}deg`,
    "--period": `${reel.columns * SPEED}s`,
  };
}

/** One lap round the ring, hidden for the stretch behind the edges. */
export function keyframes(shape: ReelShape, reel: Reel): string {
  const z = `${round(100 * arc(shape.curve))}cqw`;
  const turn = (a: number) => `translateZ(${z}) rotateY(${a}deg) translateZ(-${z})`;
  const edge = round(((reel.sweep - reel.limit) / (2 * reel.sweep || 1)) * 100);
  return (
    `@keyframes reel-turn{from{transform:${turn(-reel.sweep)}}to{transform:${turn(reel.sweep)}}` +
    `0%,${edge}%,${round(100 - edge)}%,100%{visibility:hidden}` +
    `${round(edge + 0.001)}%,${round(100 - edge - 0.001)}%{visibility:visible}}`
  );
}
