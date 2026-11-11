import { useTexture } from '@react-three/drei';
import { useMemo } from 'react';
import { Color, IcosahedronGeometry, PlaneGeometry, Quaternion, SRGBColorSpace, Texture, Vector3 } from 'three';
import type { BaseId, Extras } from '../order/types.ts';
import { ASSET } from './assets.ts';
import { Pop } from './motion.tsx';
import { randomOnRice, riceHeight, riceNormal, rng } from './surface.ts';

const UP = new Vector3(0, 1, 0);

export function useFoodTextures() {
  const urls = [ASSET.chickenLeg, ASSET.chickenLegH, ASSET.friedEgg, ASSET.friedEggH, ASSET.sauce, ASSET.sauceH, ...ASSET.chickenPieces.flat()];
  const tex = useTexture(urls) as Texture[];
  useMemo(() => {
    for (let i = 0; i < tex.length; i += 2) tex[i].colorSpace = SRGBColorSpace;
  }, [tex]);
  const [leg, legH, egg, eggH, sauce, sauceH, ...pieces] = tex;
  return { leg, legH, egg, eggH, sauce, sauceH, pieces };
}

const planeCache = new Map<number, PlaneGeometry>();
function flatPlane(size: number) {
  let g = planeCache.get(size);
  if (!g) {
    g = new PlaneGeometry(size, size, 56, 56);
    g.rotateX(-Math.PI / 2);
    planeCache.set(size, g);
  }
  return g;
}

/** Orientation that makes an object lie on the rice at (x, z), turned by `yaw`. */
export function restingQuat(x: number, z: number, yaw: number) {
  const q = new Quaternion().setFromUnitVectors(UP, new Vector3(...riceNormal(x, z)));
  return q.multiply(new Quaternion().setFromAxisAngle(UP, yaw));
}

interface PhotoProps {
  map: Texture;
  height: Texture;
  size: number;
  /** World-space thickness the height map is pushed up by. */
  thickness: number;
  roughness?: number;
}

/** A photographic cut-out given real relief by displacing a dense plane with its height map. */
export function PhotoFood({ map, height, size, thickness, roughness = 0.55 }: PhotoProps) {
  return (
    <mesh geometry={flatPlane(size)} castShadow receiveShadow>
      <meshStandardMaterial
        map={map}
        alphaTest={0.45}
        emissiveMap={map}
        emissive="#ffffff"
        emissiveIntensity={0.28}
        displacementMap={height}
        displacementScale={thickness}
        bumpMap={height}
        bumpScale={2}
        roughness={roughness}
      />
    </mesh>
  );
}

function OnRice({ x, z, yaw, lift, show, delay, children }: { x: number; z: number; yaw: number; lift: number; show: boolean; delay?: number; children: React.ReactNode }) {
  const q = useMemo(() => restingQuat(x, z, yaw), [x, z, yaw]);
  return (
    <Pop show={show} delay={delay} position={[x, riceHeight(x, z) + lift, z]}>
      <group quaternion={q}>{children}</group>
    </Pop>
  );
}

// ------------------------------------------------------------------ bases

const CHICKEN_SPOTS = (() => {
  const rand = rng(41);
  return Array.from({ length: 11 }, (_, i) => {
    const [x, z] = randomOnRice(rand, 0.82);
    return { x, z, yaw: rand() * Math.PI * 2, variant: i % 3, size: 0.34 + rand() * 0.1 };
  });
})();

function ChickenBase({ show, pieces }: { show: boolean; pieces: Texture[] }) {
  return (
    <>
      {CHICKEN_SPOTS.map((s, i) => (
        <OnRice key={i} x={s.x} z={s.z} yaw={s.yaw} lift={0.012} show={show} delay={(i / CHICKEN_SPOTS.length) * 0.55}>
          <PhotoFood map={pieces[s.variant * 2]} height={pieces[s.variant * 2 + 1]} size={s.size} thickness={0.07} roughness={0.6} />
        </OnRice>
      ))}
    </>
  );
}

/** Irregular chunk geometry; every chunk is the same mesh scaled differently. */
function lumpGeometry(seed: number, radius: number, detail: number, jag: number) {
  const g = new IcosahedronGeometry(radius, detail);
  const rand = rng(seed);
  const pos = g.attributes.position;
  const seen = new Map<string, number>();
  for (let i = 0; i < pos.count; i++) {
    // shared vertices must move together or the mesh tears open
    const key = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
    let k = seen.get(key);
    if (k === undefined) seen.set(key, (k = 1 + (rand() - 0.5) * jag));
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k);
  }
  g.computeVertexNormals();
  return g;
}

function ChunkScatter({ show, seed, count, geometry, colors, scale, roughness, flatten = 0.55, maxU = 0.85 }: {
  show: boolean; seed: number; count: number; geometry: IcosahedronGeometry; colors: string[]; scale: [number, number]; roughness: number; flatten?: number; maxU?: number;
}) {
  const spots = useMemo(() => {
    const rand = rng(seed);
    return Array.from({ length: count }, () => {
      const [x, z] = randomOnRice(rand, maxU);
      const s = scale[0] + rand() * (scale[1] - scale[0]);
      return { x, z, yaw: rand() * Math.PI * 2, s, sx: 0.8 + rand() * 0.6, color: new Color(colors[Math.floor(rand() * colors.length)]) };
    });
  }, [seed, count, colors, scale, maxU]);
  return (
    <>
      {spots.map((p, i) => (
        <OnRice key={i} x={p.x} z={p.z} yaw={p.yaw} lift={0.02 * p.s} show={show} delay={(i / count) * 0.6}>
          <mesh geometry={geometry} scale={[p.s * p.sx, p.s * flatten, p.s]} castShadow receiveShadow>
            <meshStandardMaterial color={p.color} roughness={roughness} />
          </mesh>
        </OnRice>
      ))}
    </>
  );
}

const BEEF_GEO = lumpGeometry(9, 0.06, 1, 0.35);
const EGG_GEO = lumpGeometry(10, 0.05, 1, 0.55);
const VEG_GEO = lumpGeometry(12, 0.03, 0, 0.25);
const BEEF_COLORS = ['#4a2414', '#5a2c17', '#3d1d10', '#683519'];
const EGG_COLORS = ['#f6d256', '#f8e08a', '#f3c443', '#fbefc4'];
const CARROT = ['#e8692a', '#f07a35'];
const CORN = ['#f2c230', '#f5d04a'];
const PEAS = ['#5d9c3a', '#79b44b'];
const BEEF_SCALE: [number, number] = [0.85, 1.35];
const EGG_SCALE: [number, number] = [0.8, 1.4];
const VEG_SCALE: [number, number] = [0.8, 1.25];

/** No usable beef photo was supplied, so beef is modelled: glazed, soy-dark, irregular strips. */
function BeefBase({ show }: { show: boolean }) {
  return <ChunkScatter show={show} seed={51} count={22} geometry={BEEF_GEO} colors={BEEF_COLORS} scale={BEEF_SCALE} roughness={0.38} flatten={0.45} />;
}

function EggBase({ show }: { show: boolean }) {
  return <ChunkScatter show={show} seed={61} count={30} geometry={EGG_GEO} colors={EGG_COLORS} scale={EGG_SCALE} roughness={0.7} flatten={0.4} />;
}

function VeggieBase({ show }: { show: boolean }) {
  return (
    <>
      <ChunkScatter show={show} seed={71} count={26} geometry={VEG_GEO} colors={CARROT} scale={VEG_SCALE} roughness={0.45} flatten={0.9} />
      <ChunkScatter show={show} seed={72} count={30} geometry={VEG_GEO} colors={CORN} scale={VEG_SCALE} roughness={0.35} flatten={0.8} />
      <ChunkScatter show={show} seed={73} count={22} geometry={VEG_GEO} colors={PEAS} scale={VEG_SCALE} roughness={0.4} flatten={1} />
    </>
  );
}

// ------------------------------------------------------------------ extras

export const LEG_SLOTS = [
  { x: 0.78, z: -0.12, yaw: 0.5 },
  { x: 0.2, z: -0.5, yaw: -0.3 },
];
const EGG_SLOTS = [
  { x: -0.55, z: 0.38, yaw: 0.2 },
  { x: 0.42, z: 0.5, yaw: 1.4 },
  { x: -0.95, z: -0.28, yaw: 2.6 },
];

export function SauceCup({ map, height }: { map: Texture; height: Texture }) {
  const lathe = useMemo(
    () => [
      [0.001, 0], [0.27, 0], [0.3, 0.02], [0.36, 0.2], [0.37, 0.23], [0.35, 0.235], [0.33, 0.21], [0.27, 0.05], [0.001, 0.045],
    ].map(([r, y]) => ({ x: r, y })),
    [],
  );
  return (
    <group>
      <mesh castShadow receiveShadow>
        <latheGeometry args={[lathe as never, 64]} />
        <meshPhysicalMaterial color="#141414" roughness={0.35} clearcoat={0.5} />
      </mesh>
      <group position={[0, 0.17, 0]}>
        <PhotoFood map={map} height={height} size={0.64} thickness={0.07} roughness={0.3} />
      </group>
    </group>
  );
}

export function Toppings({ base, extras }: { base: BaseId | null; extras: Extras }) {
  const t = useFoodTextures();
  return (
    <group>
      <ChickenBase show={base === 'chicken'} pieces={t.pieces} />
      <BeefBase show={base === 'beef'} />
      <EggBase show={base === 'egg'} />
      <VeggieBase show={base === 'veggie'} />

      {/* chicken legs and house sauce live in Props.tsx: they travel from the side station */}
      {EGG_SLOTS.map((s, i) => (
        <OnRice key={`egg${i}`} {...s} lift={0.03 + i * 0.03} show={extras.egg > i}>
          <PhotoFood map={t.egg} height={t.eggH} size={0.92} thickness={0.06} roughness={0.4} />
        </OnRice>
      ))}
    </group>
  );
}

