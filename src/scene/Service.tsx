import { useFrame } from '@react-three/fiber';
import { useContext, useMemo, useRef } from 'react';
import { Group, Mesh, MeshStandardMaterial, Sprite, SpriteMaterial } from 'three';
import type { MenuDrink, ServiceMode } from '../order/types.ts';
import { clamp01, easeOutBack, easeOutCubic, Pop, ReducedMotion, useProgress } from './motion.tsx';
import { kraftTexture, softDotTexture, stickerTexture } from './textures.ts';

const BOX_W = 3.95;
const BOX_D = 3.25;
const BOX_H = 1.08;
const WALL = 0.045;
const LID_OPEN = -1.95;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Takeaway packing, driven purely by `packed`: the kraft sleeve drops over
 * the bowl, the lid folds shut, then the sticker lands. Flip back to dine-in
 * mid-way and the same progress value runs it in reverse.
 */
export function TakeawayBox({ packed, label, onClosed }: { packed: boolean; label: string; onClosed?: (closed: boolean) => void }) {
  const kraft = useMemo(kraftTexture, []);
  const sticker = useMemo(() => stickerTexture(label), [label]);
  const sleeve = useRef<Group>(null);
  const lid = useRef<Group>(null);
  const seal = useRef<Mesh>(null);
  const wasClosed = useRef(false);

  useProgress(packed, 2.4, (p) => {
    const drop = clamp01(p / 0.42);
    const fold = clamp01((p - 0.42) / 0.4);
    const stamp = clamp01((p - 0.84) / 0.16);
    if (sleeve.current) {
      sleeve.current.visible = p > 0.001;
      sleeve.current.position.y = (1 - easeOutCubic(drop)) * 3.2;
    }
    if (lid.current) lid.current.rotation.x = LID_OPEN * (1 - easeInOut(fold));
    if (seal.current) {
      seal.current.visible = stamp > 0;
      seal.current.scale.setScalar(Math.max(0.001, easeOutBack(stamp)));
    }
    const closed = fold > 0.92;
    if (closed !== wasClosed.current) {
      wasClosed.current = closed;
      onClosed?.(closed);
    }
  });

  const mat = useMemo(() => new MeshStandardMaterial({ map: kraft, roughness: 0.85 }), [kraft]);
  return (
    <group ref={sleeve} visible={false}>
      <mesh material={mat} position={[0, BOX_H / 2, BOX_D / 2]} castShadow receiveShadow>
        <boxGeometry args={[BOX_W, BOX_H, WALL]} />
      </mesh>
      <mesh material={mat} position={[0, BOX_H / 2, -BOX_D / 2]} castShadow receiveShadow>
        <boxGeometry args={[BOX_W, BOX_H, WALL]} />
      </mesh>
      <mesh material={mat} position={[BOX_W / 2, BOX_H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[WALL, BOX_H, BOX_D]} />
      </mesh>
      <mesh material={mat} position={[-BOX_W / 2, BOX_H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[WALL, BOX_H, BOX_D]} />
      </mesh>
      <group ref={lid} position={[0, BOX_H, -BOX_D / 2]} rotation-x={LID_OPEN}>
        <mesh material={mat} position={[0, WALL / 2, BOX_D / 2]} castShadow receiveShadow>
          <boxGeometry args={[BOX_W + 0.06, WALL, BOX_D + 0.04]} />
        </mesh>
        <mesh ref={seal} position={[0, WALL + 0.004, BOX_D / 2]} rotation-x={-Math.PI / 2} visible={false}>
          <planeGeometry args={[1.9, 0.95]} />
          <meshStandardMaterial map={sticker} roughness={0.6} transparent />
        </mesh>
      </group>
    </group>
  );
}

export function Cutlery({ show }: { show: boolean }) {
  return (
    <Pop show={show} drop={0.5} position={[-1.75, 0.012, 1.55]}>
      <group rotation-y={-0.5}>
        <mesh position={[0, 0.012, 0]} castShadow>
          <boxGeometry args={[0.07, 0.02, 1.25]} />
          <meshStandardMaterial color="#d9dadc" metalness={1} roughness={0.22} />
        </mesh>
        <mesh position={[0, 0.03, -0.72]} scale={[0.17, 0.035, 0.24]} castShadow>
          <sphereGeometry args={[1, 24, 12]} />
          <meshStandardMaterial color="#d9dadc" metalness={1} roughness={0.2} />
        </mesh>
      </group>
    </Pop>
  );
}

/** Soft rising wisps; disabled entirely for reduced motion. */
export function Steam({ strength }: { strength: number }) {
  const reduced = useContext(ReducedMotion);
  const tex = useMemo(softDotTexture, []);
  const puffs = useMemo(() => Array.from({ length: 12 }, (_, i) => ({ x: Math.sin(i * 2.3) * 0.9, z: Math.cos(i * 1.7) * 0.6, phase: i / 12 })), []);
  const refs = useRef<(Sprite | null)[]>([]);
  const level = useRef(0);
  useFrame(({ clock }, dt) => {
    level.current += (strength - level.current) * Math.min(1, dt * 2);
    puffs.forEach((p, i) => {
      const s = refs.current[i];
      if (!s) return;
      const t = (clock.elapsedTime * 0.22 + p.phase) % 1;
      s.position.set(p.x + Math.sin(t * 6 + i) * 0.12, 0.9 + t * 1.6, p.z);
      s.scale.setScalar(0.5 + t * 0.9);
      (s.material as SpriteMaterial).opacity = Math.sin(t * Math.PI) * 0.06 * level.current;
    });
  });
  if (reduced) return null;
  return (
    <group>
      {puffs.map((_, i) => (
        <sprite key={i} ref={(s) => void (refs.current[i] = s)}>
          <spriteMaterial map={tex} transparent depthWrite={false} opacity={0} />
        </sprite>
      ))}
    </group>
  );
}

function Glass({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[0, 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.27, 0.23, 0.9, 32, 1, true]} />
        <meshPhysicalMaterial color="#ffffff" transmission={1} thickness={0.05} roughness={0.05} ior={1.45} transparent opacity={0.35} side={2} />
      </mesh>
      <mesh position={[0, 0.34, 0]}>
        <cylinderGeometry args={[0.25, 0.22, 0.64, 32]} />
        <meshStandardMaterial color={color} roughness={0.15} transparent opacity={0.88} />
      </mesh>
    </group>
  );
}

function PaperCup({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.29, 0.22, 0.9, 32]} />
        <meshStandardMaterial color="#fbf7ef" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.48, 0]}>
        <cylinderGeometry args={[0.278, 0.235, 0.22, 32, 1, true]} />
        <meshStandardMaterial color="#e4572e" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.93, 0]} castShadow>
        <cylinderGeometry args={[0.27, 0.31, 0.07, 32]} />
        <meshStandardMaterial color="#f4f1ea" roughness={0.5} />
      </mesh>
      <mesh position={[0.06, 1.15, 0]} rotation-z={-0.18} castShadow>
        <cylinderGeometry args={[0.025, 0.025, 0.55, 10]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
    </group>
  );
}

const DRINK_SLOTS: [number, number][] = [
  [2.4, -0.95],
  [2.55, 0.25],
  [-2.45, -0.85],
  [2.75, 1.4],
];

/** One stable slot per menu drink so changing one never reshuffles the others. */
export function Drinks({ menuDrinks, qty, mode }: { menuDrinks: MenuDrink[]; qty: Record<string, number>; mode: ServiceMode }) {
  return (
    <group>
      {menuDrinks.slice(0, DRINK_SLOTS.length).map((d, i) => {
        const [x, z] = DRINK_SLOTS[i];
        const n = qty[d.id] ?? 0;
        return [0, 1].map((k) => (
          <Pop key={`${d.id}-${k}`} show={n > k && d.price !== null} drop={1.2} position={[x + k * 0.62, 0, z + k * 0.2]}>
            {mode === 'takeaway' ? <PaperCup color={d.color} /> : <Glass color={d.color} />}
          </Pop>
        ));
      })}
    </group>
  );
}
