import { useTexture } from '@react-three/drei';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { Color, InstancedMesh, LatheGeometry, Object3D, RepeatWrapping, RingGeometry, SRGBColorSpace, Vector2 } from 'three';
import palette from '../data/rice-palette.json';
import { ASSET } from './assets.ts';
import { BOWL_STRETCH, RICE_EDGE_R, randomOnRice, riceHeight, rng } from './surface.ts';
import { oliveWoodTexture } from './textures.ts';

const BOWL_PROFILE: [number, number][] = [
  [0.001, 0], [0.5, 0], [0.56, 0.03], [0.62, 0.08], [0.85, 0.25], [1.15, 0.45], [1.42, 0.62],
  [1.445, 0.645], [1.4, 0.658], [1.36, 0.63], [1.1, 0.44], [0.8, 0.24], [0.55, 0.11], [0.001, 0.09],
];

/** Glazed black ceramic, as the restaurant serves its chaofan. */
export function Bowl() {
  const geo = useMemo(() => new LatheGeometry(BOWL_PROFILE.map(([r, y]) => new Vector2(r, y)), 128), []);
  return (
    <mesh geometry={geo} scale={[BOWL_STRETCH, 1, 1]} castShadow receiveShadow>
      <meshPhysicalMaterial color="#1a1918" roughness={0.3} clearcoat={0.9} clearcoatRoughness={0.18} />
    </mesh>
  );
}

export const BOARD_R = 2.0;
export const BOARD_TOP = 0.12;
const BOARD_PROFILE: [number, number][] = [
  [0.001, 0], [BOARD_R - 0.06, 0], [BOARD_R, 0.04], [BOARD_R + 0.01, 0.12], [BOARD_R - 0.04, 0.17], [BOARD_R - 0.16, 0.15],
  [BOARD_R - 0.24, BOARD_TOP], [0.001, BOARD_TOP],
];

/** Round olive-wood serving board with a raised lip; the bowl and finished meal sit on it. */
export function Board() {
  const map = useMemo(oliveWoodTexture, []);
  const geo = useMemo(() => {
    const g = new LatheGeometry(BOARD_PROFILE.map(([r, y]) => new Vector2(r, y)), 128);
    // planar UVs so the grain runs straight across the board instead of around it
    const pos = g.attributes.position;
    const uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / (BOARD_R * 2.1) + 0.5, pos.getZ(i) / (BOARD_R * 2.1) + 0.5);
    return g;
  }, []);
  return (
    <mesh geometry={geo} castShadow receiveShadow>
      <meshPhysicalMaterial map={map} roughness={0.55} clearcoat={0.35} clearcoatRoughness={0.4} />
    </mesh>
  );
}

function riceGeometry() {
  const g = new RingGeometry(0.0001, RICE_EDGE_R, 160, 48);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) * BOWL_STRETCH;
    const z = pos.getZ(i);
    pos.setXYZ(i, x, riceHeight(x, z), z);
    uv.setXY(i, x / 1.1, z / 1.1);
  }
  g.computeVertexNormals();
  return g;
}

interface ScatterSpec {
  count: number;
  seed: number;
  colors: string[];
  maxU?: number;
  lift?: number;
  flat?: boolean;
}

/** Writes seeded positions/rotations/colours into an instanced mesh lying on the rice. */
export function useScatter(ref: React.RefObject<InstancedMesh | null>, spec: ScatterSpec) {
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const rand = rng(spec.seed);
    const d = new Object3D();
    const c = new Color();
    for (let i = 0; i < spec.count; i++) {
      const [x, z] = randomOnRice(rand, spec.maxU ?? 0.97);
      d.position.set(x, riceHeight(x, z) + (spec.lift ?? 0.004) + rand() * 0.012, z);
      d.rotation.set((rand() - 0.5) * 0.5, rand() * Math.PI * 2, spec.flat ? Math.PI / 2 + (rand() - 0.5) * 0.5 : rand() * Math.PI);
      const s = 0.8 + rand() * 0.45;
      d.scale.set(s, s, s);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
      c.set(spec.colors[Math.floor(rand() * spec.colors.length)]).offsetHSL(0, 0, (rand() - 0.5) * 0.06);
      mesh.setColorAt(i, c);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [ref, spec]);
}

const GRAINS: ScatterSpec = { count: 4200, seed: 3, colors: palette as string[], flat: true };
const CORN: ScatterSpec = { count: 22, seed: 21, colors: ['#f2c230', '#e9b322'], maxU: 0.9, lift: 0.012 };
const SCALLION: ScatterSpec = { count: 20, seed: 22, colors: ['#5f9c3a', '#86b84f'], maxU: 0.9, lift: 0.01, flat: true };

/** The plain wok-fried rice. Always on screen: the dish starts as rice only. */
export function Rice() {
  const [map, normalMap, roughnessMap] = useTexture([ASSET.riceAlbedo, ASSET.riceNormal, ASSET.riceRoughness]);
  useMemo(() => {
    for (const t of [map, normalMap, roughnessMap]) {
      t.wrapS = t.wrapT = RepeatWrapping;
      t.anisotropy = 8;
    }
    map.colorSpace = SRGBColorSpace;
  }, [map, normalMap, roughnessMap]);
  const geo = useMemo(riceGeometry, []);
  const grains = useRef<InstancedMesh>(null);
  const corn = useRef<InstancedMesh>(null);
  const scallion = useRef<InstancedMesh>(null);
  useScatter(grains, GRAINS);
  useScatter(corn, CORN);
  useScatter(scallion, SCALLION);

  return (
    <group>
      <mesh geometry={geo} receiveShadow>
        <meshStandardMaterial map={map} emissiveMap={map} emissive="#ffffff" emissiveIntensity={0.4} normalMap={normalMap} normalScale={new Vector2(1.4, 1.4)} roughnessMap={roughnessMap} roughness={0.9} />
      </mesh>
      <instancedMesh ref={grains} args={[undefined, undefined, GRAINS.count]} castShadow receiveShadow>
        <capsuleGeometry args={[0.0105, 0.042, 2, 6]} />
        <meshStandardMaterial roughness={0.42} emissive="#5a2a0a" emissiveIntensity={0.55} />
      </instancedMesh>
      <instancedMesh ref={corn} args={[undefined, undefined, CORN.count]} castShadow>
        <sphereGeometry args={[0.026, 10, 8]} />
        <meshStandardMaterial roughness={0.35} />
      </instancedMesh>
      <instancedMesh ref={scallion} args={[undefined, undefined, SCALLION.count]} castShadow>
        <cylinderGeometry args={[0.018, 0.018, 0.03, 10, 1, true]} />
        <meshStandardMaterial roughness={0.5} side={2} />
      </instancedMesh>
    </group>
  );
}
