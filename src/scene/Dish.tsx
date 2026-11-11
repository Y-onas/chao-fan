import { useMemo } from 'react';
import { LatheGeometry, Vector2 } from 'three';
import { FINISH, Model, MODELS } from './models.tsx';
import { RICE_BASE, RICE_SQUASH } from './surface.ts';
import { oliveWoodTexture } from './textures.ts';

const BOWL_PROFILE: [number, number][] = [
  [0.001, 0], [0.5, 0], [0.56, 0.03], [0.62, 0.08], [0.85, 0.25], [1.15, 0.45], [1.42, 0.62],
  [1.445, 0.645], [1.4, 0.658], [1.36, 0.63], [1.1, 0.44], [0.8, 0.24], [0.55, 0.11], [0.001, 0.09],
];

/** Glazed black ceramic, as the restaurant serves its chaofan. */
export function Bowl() {
  const geo = useMemo(() => new LatheGeometry(BOWL_PROFILE.map(([r, y]) => new Vector2(r, y)), 128), []);
  return (
    <mesh geometry={geo} castShadow receiveShadow>
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

/** The wok-fried rice: a photogrammetry scan of real fried rice, sat in the bowl. Always on screen. */
export function Rice() {
  return (
    <group position-y={RICE_BASE} scale={[1, RICE_SQUASH, 1]}>
      <Model name={MODELS.rice} finish={FINISH.rice} />
    </group>
  );
}
