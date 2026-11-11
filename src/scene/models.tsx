import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import { Color, Mesh, MeshPhysicalMaterial, type Material, type MeshStandardMaterial, type Object3D } from 'three';
import { M } from './surface.ts';

const base = `${import.meta.env.BASE_URL}assets/models/`;

/**
 * Real-world food scans and props, prepared by scripts/prepare_models.ts
 * (sources and licences in ASSETS.md). Every GLB is in metres, centred on
 * x/z with its lowest point at y = 0.
 */
export const MODELS = {
  rice: 'rice',
  carrot: 'carrot',
  egg: 'egg',
  leg: 'leg',
  can: 'can',
  lime: 'lime',
  mint: 'mint',
  spoon: 'spoon',
  chicken: [0, 1, 2, 3, 4].map((i) => `chicken-${i}`),
  beef: [0, 1, 2, 3].map((i) => `beef-${i}`),
  eggBits: [0, 1, 2, 3, 4].map((i) => `egg-bit-${i}`),
} as const;

export const modelUrl = (name: string) => `${base}${name}.glb`;

/** Everything on the bowl itself; drinks and garnish load on demand. */
export const CORE_MODELS = [MODELS.rice, MODELS.carrot, MODELS.egg, MODELS.leg, MODELS.spoon, ...MODELS.chicken, ...MODELS.beef, ...MODELS.eggBits];
export function preloadCore() {
  for (const m of CORE_MODELS) useGLTF.preload(modelUrl(m));
}

export interface Finish {
  /** Multiplies the scan's own colour, e.g. to darken grilled breast into soy-glazed beef. */
  tint?: string;
  /** 0..1 clear lacquer for glazes and oil. */
  glaze?: number;
  roughness?: number;
  /** Lift dark scan textures a touch when the scene lighting is softer than the capture's. */
  lift?: number;
}

function finishMaterial(src: Material, f: Finish) {
  const s = src as MeshStandardMaterial;
  const m = new MeshPhysicalMaterial({
    map: s.map,
    normalMap: s.normalMap,
    roughnessMap: s.roughnessMap,
    metalnessMap: s.metalnessMap,
    metalness: s.metalness,
    roughness: f.roughness ?? s.roughness,
    color: new Color(f.tint ?? '#ffffff'),
    clearcoat: f.glaze ?? 0,
    clearcoatRoughness: 0.35,
    transparent: s.transparent,
    alphaTest: s.alphaTest,
    side: s.side,
  });
  if (f.lift && s.map) {
    m.emissiveMap = s.map;
    m.emissive = new Color(f.tint ?? '#ffffff');
    m.emissiveIntensity = f.lift;
  }
  return m;
}

/** One placed copy of a scan, scaled from metres into scene units; geometry and textures are shared. */
export function Model({ name, finish, scale = 1, shadows = true }: { name: string; finish?: Finish; scale?: number; shadows?: boolean }) {
  const { scene } = useGLTF(modelUrl(name));
  const key = JSON.stringify(finish ?? {});
  const obj = useMemo(() => {
    const o: Object3D = scene.clone(true);
    o.traverse((n) => {
      if (!(n as Mesh).isMesh) return;
      const mesh = n as Mesh;
      mesh.castShadow = shadows;
      mesh.receiveShadow = true;
      // photogrammetry scans often ship unlit, without normals; lit materials need them
      if (!mesh.geometry.attributes.normal) mesh.geometry.computeVertexNormals();
      if (finish) mesh.material = finishMaterial(mesh.material as Material, finish);
    });
    return o;
    // finish is compared by value
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, key, shadows]);
  return <primitive object={obj} scale={M * scale} />;
}

/** Colour treatments that take the scans from their capture look to ChaoFan Corner's dishes. */
export const FINISH = {
  // restaurant chaofan is wok-dark with soy: darken and warm the pale scan
  rice: { tint: '#b98552', roughness: 0.75, lift: 0.12 } satisfies Finish,
  chicken: { tint: '#e3ab72', glaze: 0.4, roughness: 0.5 } satisfies Finish,
  beef: { tint: '#8a5230', glaze: 0.65, roughness: 0.42 } satisfies Finish,
  // whole leg: roasted and glazed rather than breaded
  leg: { tint: '#a9724a', glaze: 0.6, roughness: 0.42 } satisfies Finish,
  egg: { glaze: 0.25 } satisfies Finish,
  steel: { roughness: 0.18 } satisfies Finish,
} as const;
