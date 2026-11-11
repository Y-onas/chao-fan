import { useMemo } from 'react';
import { Quaternion, Vector3 } from 'three';
import type { BaseId, Extras } from '../order/types.ts';
import { FINISH, Model, MODELS, type Finish } from './models.tsx';
import { Pop } from './motion.tsx';
import { randomOnRice, riceHeight, riceNormal, rng } from './surface.ts';

const UP = new Vector3(0, 1, 0);

/** Orientation that makes an object lie on the rice at (x, z), turned by `yaw`. */
export function restingQuat(x: number, z: number, yaw: number) {
  const q = new Quaternion().setFromUnitVectors(UP, new Vector3(...riceNormal(x, z)));
  return q.multiply(new Quaternion().setFromAxisAngle(UP, yaw));
}

function OnRice({ x, z, yaw, lift = 0, sink = 0, show, delay, children }: { x: number; z: number; yaw: number; lift?: number; sink?: number; show: boolean; delay?: number; children: React.ReactNode }) {
  const q = useMemo(() => restingQuat(x, z, yaw), [x, z, yaw]);
  return (
    <Pop show={show} delay={delay} position={[x, riceHeight(x, z) + lift - sink, z]}>
      <group quaternion={q}>{children}</group>
    </Pop>
  );
}

interface Scatter {
  seed: number;
  count: number;
  names: readonly string[];
  finish?: Finish;
  scale: [number, number];
  maxU?: number;
  /** Pieces nestle into the rice by this much (scene units). */
  sink?: number;
}

function useSpots(s: Scatter) {
  return useMemo(() => {
    const rand = rng(s.seed);
    return Array.from({ length: s.count }, (_, i) => {
      const [x, z] = randomOnRice(rand, s.maxU ?? 0.78);
      return { x, z, yaw: rand() * Math.PI * 2, name: s.names[i % s.names.length], scale: s.scale[0] + rand() * (s.scale[1] - s.scale[0]) };
    });
  }, [s]);
}

function ScatterBase({ show, spec }: { show: boolean; spec: Scatter }) {
  const spots = useSpots(spec);
  return (
    <>
      {spots.map((p, i) => (
        <OnRice key={i} x={p.x} z={p.z} yaw={p.yaw} sink={spec.sink} show={show} delay={(i / spots.length) * 0.55}>
          <Model name={p.name} finish={spec.finish} scale={p.scale} />
        </OnRice>
      ))}
    </>
  );
}

// all specs are module constants so their memoised spots never change
const CHICKEN: Scatter = { seed: 41, count: 11, names: MODELS.chicken, finish: FINISH.chicken, scale: [1.0, 1.25], sink: -0.01 };
const BEEF: Scatter = { seed: 51, count: 14, names: MODELS.beef, finish: FINISH.beef, scale: [0.85, 1.05], sink: 0.03 };
const EGG_BITS: Scatter = { seed: 61, count: 26, names: MODELS.eggBits, finish: FINISH.egg, scale: [0.75, 1.05], sink: 0 };

/** Veggie chaofan: heaps of shredded carrot from the scan, around the crown of the rice. */
const CARROT_SPOTS = [
  { x: -0.35, z: -0.25, yaw: 0.4 },
  { x: 0.42, z: 0.18, yaw: 2.2 },
  { x: -0.1, z: 0.5, yaw: 4.1 },
];

// fried eggs lie on the crown; the first sits front-and-centre like the restaurant photo
const EGG_SLOTS = [
  { x: -0.2, z: 0.25, yaw: 0.3 },
  { x: 0.35, z: -0.25, yaw: 2.0 },
  { x: -0.45, z: -0.35, yaw: 4.0 },
];

export const LEG_SLOTS = [
  { x: 0.55, z: -0.05, yaw: 0.5 },
  { x: 0.1, z: -0.45, yaw: -0.35 },
];

export function Toppings({ base, extras }: { base: BaseId | null; extras: Extras }) {
  return (
    <group>
      <ScatterBase show={base === 'chicken'} spec={CHICKEN} />
      <ScatterBase show={base === 'beef'} spec={BEEF} />
      <ScatterBase show={base === 'egg'} spec={EGG_BITS} />
      {CARROT_SPOTS.map((s, i) => (
        <OnRice key={`carrot${i}`} {...s} sink={0.06} show={base === 'veggie'} delay={i * 0.2}>
          <Model name={MODELS.carrot} scale={0.55} />
        </OnRice>
      ))}

      {/* chicken legs and house sauce live in Props.tsx: they travel from the side station */}
      {EGG_SLOTS.map((s, i) => (
        <OnRice key={`egg${i}`} {...s} lift={0.02 + i * 0.03} show={extras.egg > i}>
          <Model name={MODELS.egg} finish={FINISH.egg} scale={0.72} />
        </OnRice>
      ))}
    </group>
  );
}
