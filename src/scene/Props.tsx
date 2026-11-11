import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { CanvasTexture, Group, LatheGeometry, Plane, Quaternion, Raycaster, RingGeometry, Vector2, Vector3, type Texture } from 'three';
import { BOARD_TOP } from './Dish.tsx';
import { clamp01, easeOutCubic, useProgress } from './motion.tsx';
import { RICE_EDGE_R, riceHeight } from './surface.ts';
import { LEG_SLOTS, PhotoFood, restingQuat, SauceCup, useFoodTextures } from './Toppings.tsx';

/** Side stations, left of the board (like the reference's spit and sauce pot). */
export const TRAY_POS = new Vector3(-4.05, 0, -0.95);
export const SAUCE_POS = new Vector3(-4.1, 0, 1.3);

// ------------------------------------------------------------------ chicken legs

const TRAY_SLOTS = [
  { x: -0.18, z: -0.2, yaw: 2.6 },
  { x: 0.2, z: 0.24, yaw: -0.4 },
];

function Tray() {
  const geo = useMemo(
    () => new LatheGeometry([[0.001, 0], [0.82, 0], [0.9, 0.03], [0.98, 0.1], [0.95, 0.11], [0.86, 0.06], [0.001, 0.05]].map(([r, y]) => new Vector2(r, y)), 64),
    [],
  );
  return (
    <mesh geometry={geo} castShadow receiveShadow>
      <meshPhysicalMaterial color="#1c1b1a" roughness={0.35} clearcoat={0.8} clearcoatRoughness={0.2} />
    </mesh>
  );
}

/**
 * One roasted leg per menu slot. A leg is never duplicated: it rests on the
 * tray until selected, then arcs into the bowl, and arcs back when removed.
 */
function TravellingLeg({ index, inBowl, map, height }: { index: number; inBowl: boolean; map: Texture; height: Texture }) {
  const g = useRef<Group>(null);
  const pose = useMemo(() => {
    const t = TRAY_SLOTS[index];
    const b = LEG_SLOTS[index];
    return {
      from: new Vector3(TRAY_POS.x + t.x, 0.1 + index * 0.06, TRAY_POS.z + t.z),
      fromQ: new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), t.yaw),
      to: new Vector3(b.x, BOARD_TOP + riceHeight(b.x, b.z) + 0.05 + index * 0.05, b.z),
      toQ: restingQuat(b.x, b.z, b.yaw),
    };
  }, [index]);
  useProgress(inBowl, 0.7, (p) => {
    const o = g.current;
    if (!o) return;
    const t = easeOutCubic(p);
    o.position.lerpVectors(pose.from, pose.to, t);
    o.position.y += Math.sin(Math.PI * clamp01(p)) * 1.4;
    o.quaternion.slerpQuaternions(pose.fromQ, pose.toQ, t);
  });
  return (
    <group ref={g} position={pose.from} quaternion={pose.fromQ}>
      <PhotoFood map={map} height={height} size={1.0} thickness={0.2} roughness={0.32} />
    </group>
  );
}

export function ChickenLegs({ count, max, interactive, onTap }: { count: number; max: number; interactive: boolean; onTap: () => void }) {
  const t = useFoodTextures();
  return (
    <group>
      <group
        position={TRAY_POS}
        onClick={(e) => {
          e.stopPropagation();
          if (interactive) onTap();
        }}
        onPointerOver={() => interactive && (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <Tray />
        {/* generous invisible hit area so the whole tray is tappable */}
        <mesh position={[0, 0.3, 0]} visible={false}>
          <cylinderGeometry args={[1, 1, 0.6, 16]} />
        </mesh>
      </group>
      {Array.from({ length: Math.min(max, TRAY_SLOTS.length) }, (_, i) => (
        <TravellingLeg key={i} index={i} inBowl={count > i} map={t.leg} height={t.legH} />
      ))}
    </group>
  );
}

// ------------------------------------------------------------------ house sauce

const PAINT = 512;
/** World half-extent of the paint canvas: the rice disc. */
const PAINT_R = RICE_EDGE_R;

/**
 * Off-screen mask of where sauce has been spooned onto the rice. The rice
 * layer reads it as an alpha map; its filled share drives the SAUCED meter.
 */
export class SauceCanvas {
  readonly canvas = document.createElement('canvas');
  readonly texture: CanvasTexture;
  private ctx: CanvasRenderingContext2D;
  private probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
  private last: [number, number] | null = null;

  constructor() {
    this.canvas.width = this.canvas.height = PAINT;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new CanvasTexture(this.canvas);
    this.texture.flipY = false;
    this.probe.canvas.width = this.probe.canvas.height = 48;
    this.clear();
  }

  private toPx(x: number, z: number): [number, number] {
    return [(x / (2 * PAINT_R) + 0.5) * PAINT, (z / (2 * PAINT_R) + 0.5) * PAINT];
  }

  /** Continues the current stroke to (x, z); `lift()` ends it. */
  stroke(x: number, z: number, width = 0.2) {
    const p = this.toPx(x, z);
    const g = this.ctx;
    g.strokeStyle = '#fff';
    g.lineCap = g.lineJoin = 'round';
    g.lineWidth = (width / (2 * PAINT_R)) * PAINT;
    g.shadowColor = '#fff';
    g.shadowBlur = 10;
    g.beginPath();
    g.moveTo(...(this.last ?? [p[0] - 0.1, p[1]]));
    g.lineTo(...p);
    g.stroke();
    this.last = p;
    this.texture.needsUpdate = true;
  }

  lift() {
    this.last = null;
  }

  clear() {
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, PAINT, PAINT);
    this.last = null;
    this.texture.needsUpdate = true;
  }

  /** 0..1: how much of the rice is sauced. A generous drizzle (~half the surface) reads as 100%. */
  coverage() {
    const n = 48;
    this.probe.clearRect(0, 0, n, n);
    this.probe.drawImage(this.canvas, 0, 0, n, n);
    const d = this.probe.getImageData(0, 0, n, n).data;
    let on = 0;
    let all = 0;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        if (Math.hypot(x + 0.5 - n / 2, y + 0.5 - n / 2) > n / 2) continue;
        all++;
        if (d[(y * n + x) * 4] > 110) on++;
      }
    return Math.min(1, on / all / 0.5);
  }
}

function sauceGeometry() {
  const g = new RingGeometry(0.0001, PAINT_R * 0.97, 96, 24);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, riceHeight(x, z) + 0.03);
    uv.setXY(i, x / (2 * PAINT_R) + 0.5, z / (2 * PAINT_R) + 0.5);
  }
  g.computeVertexNormals();
  return g;
}

/** The sauce itself: the restaurant's sauce photo, revealed wherever the spoon has been. */
export function SauceLayer({ sauce }: { sauce: SauceCanvas }) {
  const t = useFoodTextures();
  const geo = useMemo(sauceGeometry, []);
  return (
    <mesh geometry={geo} renderOrder={2}>
      <meshStandardMaterial
        map={t.sauce}
        color="#ffe2cc"
        alphaMap={sauce.texture}
        bumpMap={sauce.texture}
        bumpScale={3}
        transparent
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-2}
        roughness={0.28}
      />
    </mesh>
  );
}

/** Steel spoon; origin at the centre of the bowl of the spoon, handle along +x. */
export function Spoon({ scale = 1 }: { scale?: number }) {
  return (
    <group scale={scale}>
      <mesh scale={[0.2, 0.05, 0.14]} castShadow>
        <sphereGeometry args={[1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#e6e7ea" metalness={1} roughness={0.16} side={2} />
      </mesh>
      <mesh position={[0.62, 0.05, 0]} rotation-z={Math.PI / 2 - 0.12} castShadow>
        <capsuleGeometry args={[0.028, 0.86, 4, 10]} />
        <meshStandardMaterial color="#e6e7ea" metalness={1} roughness={0.2} />
      </mesh>
    </group>
  );
}

const SPOON_HOME = new Vector3(SAUCE_POS.x + 0.05, 0.42, SAUCE_POS.z);
const DRAG_Y = BOARD_TOP + 0.85;

/**
 * Drag the spoon from the sauce cup across the rice to spread sauce.
 * Pointer events are followed on window so a fast drag never "drops" the spoon.
 */
export function SauceStation({
  sauce,
  enabled,
  onDragStart,
  onStroke,
  onRefused,
}: {
  sauce: SauceCanvas;
  enabled: boolean;
  onDragStart: () => void;
  onStroke: () => void;
  onRefused: () => void;
}) {
  const t = useFoodTextures();
  const { camera, gl } = useThree();
  const spoon = useRef<Group>(null);
  const target = useRef(SPOON_HOME.clone());
  const dragging = useRef(false);
  const tools = useMemo(() => ({ ray: new Raycaster(), plane: new Plane(new Vector3(0, 1, 0), -DRAG_Y), hit: new Vector3(), ndc: new Vector2() }), []);

  useEffect(() => {
    const el = gl.domElement;
    const move = (e: PointerEvent) => {
      if (!dragging.current) return;
      const r = el.getBoundingClientRect();
      tools.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      tools.ray.setFromCamera(tools.ndc, camera);
      if (!tools.ray.ray.intersectPlane(tools.plane, tools.hit)) return;
      target.current.copy(tools.hit);
      if (Math.hypot(tools.hit.x, tools.hit.z) < PAINT_R * 0.95) {
        sauce.stroke(tools.hit.x, tools.hit.z);
        onStroke();
      } else sauce.lift();
    };
    const up = () => {
      if (!dragging.current) return;
      dragging.current = false;
      sauce.lift();
      target.current.copy(SPOON_HOME);
      document.body.classList.remove('dragging-spoon');
    };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
    addEventListener('pointercancel', up);
    return () => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      removeEventListener('pointercancel', up);
    };
  }, [camera, gl, sauce, tools, onStroke]);

  useFrame((_, dt) => {
    const s = spoon.current;
    if (!s) return;
    s.position.lerp(target.current, Math.min(1, dt * (dragging.current ? 18 : 7)));
    const tilt = dragging.current ? -0.35 : -0.18;
    s.rotation.z += (tilt - s.rotation.z) * Math.min(1, dt * 8);
  });

  return (
    <group>
      <group position={SAUCE_POS} scale={1.7}>
        <SauceCup map={t.sauce} height={t.sauceH} />
      </group>
      <group
        ref={spoon}
        position={SPOON_HOME}
        rotation={[0, -0.6, -0.18]}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (!enabled) return onRefused();
          dragging.current = true;
          document.body.classList.add('dragging-spoon');
          onDragStart();
        }}
        onPointerOver={() => (document.body.style.cursor = 'grab')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <Spoon scale={1.25} />
        <mesh position={[0.5, 0.05, 0]} visible={false}>
          <boxGeometry args={[1.6, 0.4, 0.6]} />
        </mesh>
      </group>
    </group>
  );
}
