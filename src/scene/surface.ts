/** Shared geometry of the rice mound so every topping sits on the same surface. */

/** The bowl is a circular lathe stretched along X into an oval. */
export const BOWL_STRETCH = 1.25;
/** Radius (before stretch) where the rice meets the inner bowl wall. */
export const RICE_EDGE_R = 1.12;
const EDGE_Y = 0.46;
const PEAK = 0.21;

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
  return Math.hypot(x / BOWL_STRETCH, z) / RICE_EDGE_R;
}

export function riceHeight(x: number, z: number) {
  const u = Math.min(1, riceU(x, z));
  // low-frequency lumps so the mound reads as scooped, not a perfect dome
  const lumps = 0.018 * Math.sin(x * 5.1 + 1.3) * Math.cos(z * 4.3 - 0.4) + 0.012 * Math.sin(x * 9.7 - z * 7.9);
  return EDGE_Y + PEAK * Math.pow(1 - u * u, 0.7) + lumps * (1 - u);
}

export function riceNormal(x: number, z: number): [number, number, number] {
  const e = 0.02;
  const dx = (riceHeight(x + e, z) - riceHeight(x - e, z)) / (2 * e);
  const dz = (riceHeight(x, z + e) - riceHeight(x, z - e)) / (2 * e);
  const l = Math.hypot(dx, 1, dz);
  return [-dx / l, 1 / l, -dz / l];
}

/** Random point on the rice, avoiding the outer rim band. */
export function randomOnRice(rand: () => number, maxU = 0.92): [number, number] {
  const r = Math.sqrt(rand()) * RICE_EDGE_R * maxU;
  const t = rand() * Math.PI * 2;
  return [Math.cos(t) * r * BOWL_STRETCH, Math.sin(t) * r];
}
