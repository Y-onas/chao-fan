/**
 * Turns the downloaded Sketchfab scans (see ASSETS.md) into small web-ready GLBs.
 *   SKETCHFAB=<api token> npm run models            # download + prepare
 *   npm run models -- --inspect                      # print mesh info only
 *
 * Each scan is baked to world space, cropped to the part we need (the rice
 * mound without its plate, one egg, the drumstick without the wing),
 * recentred on its base, scaled to metres, decimated and given webp textures.
 */
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Document, NodeIO, type Primitive } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, flatten, join, meshopt, prune, simplify, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const RAW = path.resolve('assets-src/models');
const OUT = path.resolve('public/assets/models');

/** uid on sketchfab.com/3d-models/<uid>; all CC BY 4.0, credited in ASSETS.md. */
const SOURCES = {
  rice: 'cc3f316d13fc4d60ad09e6519a8ad25b',
  egg: 'b5526cdddd194459be920b866b481cf9',
  leg: '38312e045dc2488ebd99971f4cef9d66',
  chickensteak: '9797e54671094233bcfa469f616bd7df',
  can: 'aaa11e57064848268d701a3586792d0d',
  lime: '9a1c7a00013745ab8b79be940e77f824',
  mint: '25837c82537c46e3ade674e0b8e99864',
  cutlery: '8f59435c14c74e9dbe82a4c488882df9',
} as const;
type Name = keyof typeof SOURCES;

type Vec3 = [number, number, number];
type Keep = (c: Vec3, bbox: { min: Vec3; max: Vec3 }) => boolean;
interface Output {
  out: string;
  src: Name;
  /** Keep a triangle when its centroid (world space, raw scan units) passes. */
  keep?: Keep;
  /** Also keep only triangles whose base-colour texel passes, e.g. orange carrot shreds off a grey plate. */
  color?: (r: number, g: number, b: number) => boolean;
  /** Real-world size in metres of the widest horizontal side (or the longest side with `longest`). */
  width: number;
  longest?: boolean;
  /** Target triangle ratio for meshopt simplify. */
  ratio: number;
  /** Simplifier error budget (fraction of mesh extent); raise it for dense scans. */
  error?: number;
  textureSize: number;
}

/** Irregular blob around (cx, cz) so cut pieces have organic outlines rather than circles. */
function blob(cx: number, cz: number, r: number, seed: number, stretch = 1, angle = 0): Keep {
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  return (c) => {
    const dx = c[0] - cx;
    const dz = c[2] - cz;
    const u = (dx * ca + dz * sa) / stretch;
    const v = -dx * sa + dz * ca;
    const t = Math.atan2(v, u);
    const edge = r * (1 + 0.2 * Math.sin(3 * t + seed) + 0.1 * Math.sin(5 * t + 2.3 * seed));
    return Math.hypot(u, v) < edge;
  };
}

// grilled breast scan, plan-view coordinates read off a top render
const CHICKEN_CHUNKS: [number, number][] = [[-0.357, -0.087], [0.132, -0.157], [-0.043, 0.332], [-0.392, 0.542], [0.167, -0.472]];
const BEEF_STRIPS: [number, number][] = [[-0.2, 0.05], [0.05, 0.2], [-0.25, 0.45], [0.1, -0.3]];
// fried egg scan: ring of bits straddling the yolk edge, so each has yolk and white
const YOLK = [-15.26, 0.45] as const;

const OUTPUTS: Output[] = [
  // scan is a plate with a rice dome in the well; keep the dome only
  {
    out: 'rice',
    src: 'rice',
    keep: (c, b) => {
      const cx = (b.min[0] + b.max[0]) / 2;
      const cz = (b.min[2] + b.max[2]) / 2;
      return Math.hypot(c[0] - cx, c[2] - cz) < 0.06 && c[1] > b.min[1] + 0.019;
    },
    width: 0.16,
    ratio: 0.12,
    textureSize: 2048,
  },
  // shredded carrot garnish on the plate rim
  // (the pickled-ginger slice at the lower left of that box is excluded)
  { out: 'carrot', src: 'rice', keep: (c) => c[0] > -0.0864 && c[0] < -0.0111 && c[2] > -0.1208 && c[2] < -0.0596 && !(c[0] < -0.048 && c[2] > -0.08), color: (r, g, b) => r > 150 && r - b > 70 && r - g > 35, width: 0.07, ratio: 0.12, error: 0.004, textureSize: 512 },
  // two overlapping eggs; keep a round cut around the left yolk so no straight seam shows
  {
    out: 'egg',
    src: 'egg',
    keep: (c, b) => {
      const w = b.max[0] - b.min[0];
      const r = Math.hypot(c[0] - YOLK[0], c[2] - YOLK[1]) / w;
      return r < 0.235 && c[0] < b.min[0] + w * 0.5;
    },
    width: 0.12,
    ratio: 0.6,
    textureSize: 1024,
  },
  ...[0, 1, 2, 3, 4].map((i): Output => {
    const a = (i / 5) * Math.PI * 2 + 0.4;
    return { out: `egg-bit-${i}`, src: 'egg', keep: blob(YOLK[0] + Math.cos(a) * 2.4, YOLK[1] + Math.sin(a) * 2.4, 1.15, i + 1), width: 0.018, ratio: 0.8, textureSize: 512 };
  }),
  // leg and wing are separate parts; the drumstick is the one at +z
  { out: 'leg', src: 'leg', keep: (c) => c[2] > 0.03, width: 0.14, ratio: 0.6, textureSize: 1024 },
  ...CHICKEN_CHUNKS.map(([x, z], i): Output => ({ out: `chicken-${i}`, src: 'chickensteak', keep: blob(x, z, 0.15, i + 1), width: 0.03, ratio: 0.4, textureSize: 512 })),
  ...BEEF_STRIPS.map(([x, z], i): Output => ({ out: `beef-${i}`, src: 'chickensteak', keep: blob(x, z, 0.1, i + 7, 2.0, -0.6), width: 0.04, ratio: 0.4, textureSize: 512 })),
  { out: 'can', src: 'can', width: 0.066, ratio: 1, textureSize: 1024 },
  { out: 'lime', src: 'lime', width: 0.05, ratio: 0.04, error: 0.03, textureSize: 512 },
  { out: 'mint', src: 'mint', width: 0.05, ratio: 1, textureSize: 512 },
  { out: 'spoon', src: 'cutlery', keep: (c) => c[0] > -0.002 && c[0] < 0.07, width: 0.17, longest: true, ratio: 0.08, textureSize: 512 },
];

async function download(name: Name) {
  const file = path.join(RAW, `${name}.glb`);
  if (existsSync(file)) return file;
  const token = process.env.SKETCHFAB;
  if (!token) throw new Error(`${file} missing and SKETCHFAB token not set`);
  const meta = await fetch(`https://api.sketchfab.com/v3/models/${SOURCES[name]}/download`, { headers: { Authorization: `Token ${token}` } });
  if (!meta.ok) throw new Error(`sketchfab ${name}: ${meta.status}`);
  const { glb } = (await meta.json()) as { glb?: { url: string } };
  if (!glb) throw new Error(`sketchfab ${name}: no glb`);
  await mkdir(RAW, { recursive: true });
  await writeFile(file, Buffer.from(await (await fetch(glb.url)).arrayBuffer()));
  return file;
}

function bounds(doc: Document) {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of prims(doc)) {
    const pos = p.getAttribute('POSITION')!;
    const idx = p.getIndices();
    const v: number[] = [];
    // only vertices still referenced by a triangle: cropping leaves orphans behind
    const n = idx ? idx.getCount() : pos.getCount();
    for (let j = 0; j < n; j++) {
      pos.getElement(idx ? idx.getScalar(j) : j, v);
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], v[k]);
        max[k] = Math.max(max[k], v[k]);
      }
    }
  }
  return { min, max };
}

const prims = (doc: Document): Primitive[] => doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives());

/**
 * Drops triangles whose centroid fails `keep` (positions are world-space after
 * flatten+bake) and, with `color`, whose base-colour texel fails it too.
 */
async function crop(doc: Document, keep: Keep, color?: Output['color']) {
  const b = bounds(doc);
  const centroid = (pos: NonNullable<ReturnType<Primitive['getAttribute']>>, i0: number, i1: number, i2: number): Vec3 => {
    const a = pos.getElement(i0, []);
    const bb = pos.getElement(i1, []);
    const cc = pos.getElement(i2, []);
    return [(a[0] + bb[0] + cc[0]) / 3, (a[1] + bb[1] + cc[1]) / 3, (a[2] + bb[2] + cc[2]) / 3];
  };
  for (const p of prims(doc)) {
    const pos = p.getAttribute('POSITION')!;
    const uv = p.getAttribute('TEXCOORD_0');
    const idx = p.getIndices()!;
    const encoded = color && uv ? p.getMaterial()?.getBaseColorTexture()?.getImage() : null;
    const tex = encoded ? await sharp(encoded).removeAlpha().raw().toBuffer({ resolveWithObject: true }) : null;
    const texel = (i0: number, i1: number, i2: number) => {
      if (!tex || !uv) return true;
      const a = uv.getElement(i0, []);
      const bb = uv.getElement(i1, []);
      const cc = uv.getElement(i2, []);
      const u = ((((a[0] + bb[0] + cc[0]) / 3) % 1) + 1) % 1;
      const v = ((((a[1] + bb[1] + cc[1]) / 3) % 1) + 1) % 1;
      const { width, height } = tex.info;
      const k = (Math.min(height - 1, Math.floor(v * height)) * width + Math.min(width - 1, Math.floor(u * width))) * 3;
      return color!(tex.data[k], tex.data[k + 1], tex.data[k + 2]);
    };
    const kept: number[] = [];
    for (let t = 0; t < idx.getCount(); t += 3) {
      const i0 = idx.getScalar(t);
      const i1 = idx.getScalar(t + 1);
      const i2 = idx.getScalar(t + 2);
      if (keep(centroid(pos, i0, i1, i2), b) && texel(i0, i1, i2)) kept.push(i0, i1, i2);
    }
    idx.setArray(new Uint32Array(kept));
    if (kept.length === 0) p.dispose();
  }
}

/** Bakes every node transform into its vertices so cropping and recentring work in one space. */
function bake(doc: Document) {
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const m = node.getWorldMatrix();
    for (const p of mesh.listPrimitives()) {
      const pos = p.getAttribute('POSITION')!;
      const nor = p.getAttribute('NORMAL');
      const v: number[] = [];
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, v);
        pos.setElement(i, [m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13], m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]]);
        if (nor) {
          nor.getElement(i, v);
          const n = [m[0] * v[0] + m[4] * v[1] + m[8] * v[2], m[1] * v[0] + m[5] * v[1] + m[9] * v[2], m[2] * v[0] + m[6] * v[1] + m[10] * v[2]];
          const l = Math.hypot(n[0], n[1], n[2]) || 1;
          nor.setElement(i, [n[0] / l, n[1] / l, n[2] / l]);
        }
      }
      p.setAttribute('TANGENT', null);
    }
  }
  for (const node of doc.getRoot().listNodes()) {
    node.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
  }
}

/** Centre on x/z, sit the lowest point on y=0, scale so the widest horizontal side (or longest side) is `width` metres. */
function normalise(doc: Document, width: number, longest = false) {
  const { min, max } = bounds(doc);
  const s = width / Math.max(max[0] - min[0], max[2] - min[2], longest ? max[1] - min[1] : 0);
  const cx = (min[0] + max[0]) / 2;
  const cz = (min[2] + max[2]) / 2;
  for (const p of prims(doc)) {
    const pos = p.getAttribute('POSITION')!;
    const v: number[] = [];
    for (let i = 0; i < pos.getCount(); i++) {
      pos.getElement(i, v);
      pos.setElement(i, [(v[0] - cx) * s, (v[1] - min[1]) * s, (v[2] - cz) * s]);
    }
  }
}

/**
 * Top-surface height of the rice scan on a grid (metres), so toppings in the
 * app rest exactly on the scanned rice instead of a guessed dome.
 */
async function writeHeightmap(doc: Document) {
  const N = 41;
  const { min, max } = bounds(doc);
  const half = Math.max(max[0] - min[0], max[2] - min[2]) / 2;
  const h = new Array<number>(N * N).fill(0);
  for (const p of prims(doc)) {
    const pos = p.getAttribute('POSITION')!;
    const idx = p.getIndices()!;
    const v: number[] = [];
    for (let j = 0; j < idx.getCount(); j++) {
      pos.getElement(idx.getScalar(j), v);
      const gx = Math.round(((v[0] / half + 1) / 2) * (N - 1));
      const gz = Math.round(((v[2] / half + 1) / 2) * (N - 1));
      if (gx < 0 || gz < 0 || gx >= N || gz >= N) continue;
      h[gz * N + gx] = Math.max(h[gz * N + gx], v[1]);
    }
  }
  const file = path.resolve('src/data/rice-height.json');
  await writeFile(file, JSON.stringify({ n: N, half: +half.toFixed(5), h: h.map((x) => +x.toFixed(5)) }));
  console.log('  heightmap →', path.relative(process.cwd(), file));
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const inspect = process.argv.includes('--inspect');
await mkdir(OUT, { recursive: true });

const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (inspect) {
  for (const name of (only.length ? only : Object.keys(SOURCES)) as Name[]) {
    const doc = await io.read(await download(name));
    await doc.transform(flatten());
    bake(doc);
    const b = bounds(doc);
    console.log(`${name}: bbox`, b.min.map((x) => +x.toFixed(4)), b.max.map((x) => +x.toFixed(4)));
    for (const p of prims(doc)) {
      const pos = p.getAttribute('POSITION')!;
      console.log('   prim', p.getMaterial()?.getName(), p.getIndices()!.getCount() / 3, pos.getMin([]).map((x) => +x.toFixed(3)), pos.getMax([]).map((x) => +x.toFixed(3)));
    }
  }
  process.exit(0);
}

await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;
for (const spec of OUTPUTS.filter((o) => !only.length || only.includes(o.out) || only.includes(o.src))) {
  const doc = await io.read(await download(spec.src));
  await doc.transform(flatten());
  bake(doc);
  if (spec.keep) await crop(doc, spec.keep, spec.color);
  normalise(doc, spec.width, spec.longest);
  if (spec.out === 'rice') await writeHeightmap(doc);
  await doc.transform(
    join(),
    weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio: spec.ratio, error: spec.error ?? 0.0008, lockBorder: !!spec.keep }),
    prune(),
    dedup(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [spec.textureSize, spec.textureSize], quality: 82 }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  const after = bounds(doc);
  const tris = prims(doc).reduce((n, p) => n + p.getIndices()!.getCount() / 3, 0);
  await io.write(path.join(OUT, `${spec.out}.glb`), doc);
  console.log(`→ ${spec.out}.glb`, 'size m', after.max.map((x, i) => +(x - after.min[i]).toFixed(3)), 'tris', tris);
}
