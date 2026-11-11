import { useFrame } from '@react-three/fiber';
import { useContext, useMemo, useRef } from 'react';
import { Group, MeshStandardMaterial, Sprite, SpriteMaterial } from 'three';
import { BOARD_TOP } from './Dish.tsx';
import { clamp01, easeOutCubic, Pop, ReducedMotion, useProgress } from './motion.tsx';
import { Spoon } from './Props.tsx';
import { riceHeight } from './surface.ts';
import { kraftTexture, nameTagTexture, softDotTexture, stampTexture } from './textures.ts';

const BOX_W = 3.05;
const BOX_D = 3.05;
export const BOX_H = 0.95;
const WALL = 0.045;
const LID_OPEN = -1.95;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Takeaway packing, driven purely by `packed`: the kraft box drops around
 * the bowl, then the lid folds shut on its hinge. Flip back to dine-in
 * mid-way and the same progress value runs it in reverse.
 */
export function TakeawayBox({ packed, onClosed }: { packed: boolean; onClosed?: (closed: boolean) => void }) {
  const kraft = useMemo(kraftTexture, []);
  const sleeve = useRef<Group>(null);
  const lid = useRef<Group>(null);
  const wasClosed = useRef(false);

  useProgress(packed, 2.2, (p) => {
    const drop = clamp01(p / 0.45);
    const fold = clamp01((p - 0.45) / 0.5);
    if (sleeve.current) {
      sleeve.current.visible = p > 0.001;
      sleeve.current.position.y = BOARD_TOP + (1 - easeOutCubic(drop)) * 3.2;
    }
    if (lid.current) lid.current.rotation.x = LID_OPEN * (1 - easeInOut(fold));
    const closed = fold > 0.92;
    if (closed !== wasClosed.current) {
      wasClosed.current = closed;
      onClosed?.(closed);
    }
  });

  const mat = useMemo(() => new MeshStandardMaterial({ map: kraft, roughness: 0.85 }), [kraft]);
  return (
    <group ref={sleeve} visible={false}>
      <mesh material={mat} position={[0, WALL / 2, 0]} receiveShadow>
        <boxGeometry args={[BOX_W, WALL, BOX_D]} />
      </mesh>
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
      {/* hinge along the back edge */}
      <group ref={lid} position={[0, BOX_H, -BOX_D / 2]} rotation-x={LID_OPEN}>
        <mesh material={mat} position={[0, WALL / 2, BOX_D / 2]} castShadow receiveShadow>
          <boxGeometry args={[BOX_W + 0.06, WALL, BOX_D + 0.04]} />
        </mesh>
      </group>
    </group>
  );
}

/** Dine-in finish: a steel spoon set into the rice, the way the restaurant serves it. */
export function ServingSpoon({ show }: { show: boolean }) {
  const x = 0.35;
  const z = 0.55;
  return (
    <Pop show={show} drop={0.6} position={[x, BOARD_TOP + riceHeight(x, z) + 0.06, z]}>
      <group rotation={[0, -0.75, 0.16]}>
        <Spoon scale={0.75} />
      </group>
    </Pop>
  );
}

/** Soft rising wisps; disabled entirely for reduced motion. */
export function Steam({ strength }: { strength: number }) {
  const reduced = useContext(ReducedMotion);
  const tex = useMemo(softDotTexture, []);
  const puffs = useMemo(() => Array.from({ length: 12 }, (_, i) => ({ x: Math.sin(i * 2.3) * 0.8, z: Math.cos(i * 1.7) * 0.6, phase: i / 12 })), []);
  const refs = useRef<(Sprite | null)[]>([]);
  const level = useRef(0);
  useFrame(({ clock }, dt) => {
    level.current += (strength - level.current) * Math.min(1, dt * 2);
    puffs.forEach((p, i) => {
      const s = refs.current[i];
      if (!s) return;
      const t = (clock.elapsedTime * 0.22 + p.phase) % 1;
      s.position.set(p.x + Math.sin(t * 6 + i) * 0.12, 1.0 + t * 1.6, p.z);
      s.scale.setScalar(0.5 + t * 0.9);
      (s.material as SpriteMaterial).opacity = Math.sin(t * Math.PI) * 0.07 * level.current;
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

/**
 * Red order stamp and a name tag, pressed on only after the server has
 * accepted the order: on the box lid for takeaway, beside the bowl for dine-in.
 */
export function OrderStamp({ orderId, name, takeaway }: { orderId: string | null; name: string; takeaway: boolean }) {
  const stamp = useMemo(() => (orderId ? stampTexture(orderId) : null), [orderId]);
  const tag = useMemo(() => (orderId ? nameTagTexture(name) : null), [orderId, name]);
  const top = takeaway ? BOARD_TOP + BOX_H + WALL + 0.012 : BOARD_TOP + 0.005;
  const stampAt: [number, number, number] = takeaway ? [0.55, top, 0.45] : [1.45, top, 1.25];
  const tagAt: [number, number, number] = takeaway ? [-0.75, top, 0.95] : [2.55, 0.01, 1.95];
  return (
    <group>
      <Pop show={!!stamp} drop={0.9} position={stampAt}>
        <mesh rotation={[-Math.PI / 2, 0, 0.25]} receiveShadow>
          <circleGeometry args={[0.62, 64]} />
          <meshStandardMaterial map={stamp} roughness={0.5} />
        </mesh>
      </Pop>
      <Pop show={!!tag} delay={0.35} drop={0.7} position={tagAt}>
        <mesh rotation={[-Math.PI / 2, 0, -0.18]} castShadow receiveShadow>
          <planeGeometry args={[1.25, 0.62]} />
          <meshStandardMaterial map={tag} roughness={0.85} />
        </mesh>
      </Pop>
    </group>
  );
}
