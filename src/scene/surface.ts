/** Shared geometry of the rice so every topping sits on the same surface. */
import heights from '../data/rice-height.json';

/** Scene units per real-world metre: a 20 cm bowl is ~2.9 units across. */
export const M = 14.5;
/** The rice scan is squashed a little so the heap crowns just above the bowl rim, like the restaurant serves it. */
export const RICE_SQUASH = 0.75;
/** Where the bottom of the rice scan sits inside the bowl. */
export const RICE_BASE = 0.1;
/** Radius where the rice meets the inner bowl wall (toppings stay inside it). */
export const RICE_EDGE_R = 1.08;

/** Seeded PRNG so the dish looks identical on every render and device. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 0 at the mound centre, 1 where the rice touches the bowl. */
export function riceU(x: number, z: number) {
  return Math.hypot(x, z) / RICE_EDGE_R;
}

const { n: N, half: HALF, h: H } = heights as { n: number; half: number; h: number[] };
const at = (gx: number, gz: number) => H[Math.max(0, Math.min(N - 1, gz)) * N + Math.max(0, Math.min(N - 1, gx))];

/** Height of the scanned rice surface at scene (x, z), bilinear over the baked heightmap. */
export function riceHeight(x: number, z: number) {
  const fx = ((x / M / HALF + 1) / 2) * (N - 1);
  const fz = ((z / M / HALF + 1) / 2) * (N - 1);
  const x0 = Math.floor(fx);
  const z0 = Math.floor(fz);
  const tx = fx - x0;
  const tz = fz - z0;
  const top = at(x0, z0) * (1 - tx) + at(x0 + 1, z0) * tx;
  const bot = at(x0, z0 + 1) * (1 - tx) + at(x0 + 1, z0 + 1) * tx;
  return RICE_BASE + (top * (1 - tz) + bot * tz) * M * RICE_SQUASH;
}

export function riceNormal(x: number, z: number): [number, number, number] {
  // wide step: the scan is lumpy, toppings should follow the mound, not every grain
  const e = 0.12;
  const dx = (riceHeight(x + e, z) - riceHeight(x - e, z)) / (2 * e);
  const dz = (riceHeight(x, z + e) - riceHeight(x, z - e)) / (2 * e);
  const l = Math.hypot(dx, 1, dz);
  return [-dx / l, 1 / l, -dz / l];
}

/** Random point on the rice, avoiding the outer rim band. */
export function randomOnRice(rand: () => number, maxU = 0.92): [number, number] {
  const r = Math.sqrt(rand()) * RICE_EDGE_R * maxU;
  const t = rand() * Math.PI * 2;
  return [Math.cos(t) * r, Math.sin(t) * r];
}
