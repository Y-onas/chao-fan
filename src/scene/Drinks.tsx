import { useGLTF } from '@react-three/drei';
import { Suspense, useMemo } from 'react';
import { CanvasTexture, Mesh, MeshPhysicalMaterial, SRGBColorSpace, type MeshStandardMaterial } from 'three';
import type { MenuDrink, ServiceMode } from '../order/types.ts';
import { Model, modelUrl, MODELS } from './models.tsx';
import { Pop } from './motion.tsx';
import { M, rng } from './surface.ts';

/** Label panels of the can's texture atlas (fractions of the image), each a vertical strip of the wrap. */
const CAN_PANELS: [number, number, number, number][] = [
  [0.254, 0.04, 0.205, 0.41],
  [0.512, 0.04, 0.191, 0.41],
  [0.713, 0.04, 0.186, 0.41],
  [0.01, 0.461, 0.186, 0.418],
];

/**
 * Repaints the Coca-Cola can atlas for another canned drink: label pixels
 * become the brand colour (silver rims, tab and lid are left untouched) and
 * the name is lettered along each panel.
 */
function relabelAtlas(image: CanvasImageSource & { width: number; height: number }, name: string, color: string) {
  const c = document.createElement('canvas');
  c.width = image.width;
  c.height = image.height;
  const g = c.getContext('2d')!;
  g.drawImage(image, 0, 0);
  const W = c.width;
  const H = c.height;
  const img = g.getImageData(0, 0, W, H);
  const d = img.data;
  const [br, bg, bb] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  for (const [px, py, pw, ph] of CAN_PANELS) {
    for (let y = Math.floor(py * H); y < (py + ph) * H; y++)
      for (let x = Math.floor(px * W); x < (px + pw) * W; x++) {
        const i = (y * W + x) * 4;
        const r = d[i];
        const gg = d[i + 1];
        const b = d[i + 2];
        const sat = Math.max(r, gg, b) - Math.min(r, gg, b);
        const silver = sat < 28 && r < 215 && r > 60;
        if (silver) continue;
        // keep a little of the original shading so the print still looks printed on metal
        const shade = 0.82 + 0.18 * (Math.max(r, gg, b) / 255);
        d[i] = br * shade;
        d[i + 1] = bg * shade;
        d[i + 2] = bb * shade;
      }
  }
  g.putImageData(img, 0, 0);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (const [px, py, pw, ph] of CAN_PANELS) {
    g.save();
    g.translate((px + pw / 2) * W, (py + ph / 2) * H);
    g.rotate(-Math.PI / 2);
    g.scale(-1, 1); // the atlas panels are mirrored
    g.font = `italic 800 ${Math.round(pw * W * 0.55)}px "Bricolage Grotesque", Georgia, sans-serif`;
    g.lineWidth = pw * W * 0.06;
    g.strokeStyle = '#f5d33a';
    g.strokeText(name, 0, 0, ph * H * 0.85);
    g.fillStyle = '#ffffff';
    g.fillText(name, 0, 0, ph * H * 0.85);
    g.restore();
  }
  const t = new CanvasTexture(c);
  t.flipY = false; // glTF UV convention
  t.colorSpace = SRGBColorSpace;
  return t;
}

/**
 * Drink can from a modelled aluminium can. Coca-Cola keeps the can's own
 * artwork; other canned drinks get their colours and name painted onto it.
 */
function Can({ drink }: { drink: MenuDrink }) {
  const { scene } = useGLTF(modelUrl(MODELS.can));
  const obj = useMemo(() => {
    const o = scene.clone(true);
    o.traverse((n) => {
      const mesh = n as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = mesh.receiveShadow = true;
      if (!mesh.geometry.attributes.normal) mesh.geometry.computeVertexNormals();
      const src = mesh.material as MeshStandardMaterial;
      const map = drink.id !== 'coca-cola' && src.map ? relabelAtlas(src.map.image, drink.name, drink.color) : src.map;
      mesh.material = new MeshPhysicalMaterial({ map, normalMap: src.normalMap, metalness: 0.45, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2 });
    });
    return o;
  }, [scene, drink.id, drink.name, drink.color]);
  return <primitive object={obj} scale={M} />;
}

const ICE = (() => {
  const r = rng(91);
  return Array.from({ length: 6 }, () => ({ x: (r() - 0.5) * 0.4, y: 0.95 + r() * 0.55, z: (r() - 0.5) * 0.4, rx: r() * 3, ry: r() * 3, s: 0.16 + r() * 0.06 }));
})();
const MINT = (() => {
  const r = rng(92);
  return Array.from({ length: 5 }, () => ({ x: (r() - 0.5) * 0.4, y: 0.3 + r() * 1.2, z: (r() - 0.5) * 0.4, rx: (r() - 0.5) * 2, ry: r() * 6 }));
})();

/** Mojito: modelled glass (or lidded cup for takeaway) with scanned mint leaves and a scanned lime half on the rim. */
function Mojito({ color, takeaway }: { color: string; takeaway: boolean }) {
  const H = 1.75;
  return (
    <group>
      <mesh position={[0, H / 2, 0]} castShadow>
        <cylinderGeometry args={[0.48, 0.42, H, 48, 1, true]} />
        {takeaway ? (
          <meshPhysicalMaterial color="#ffffff" roughness={0.25} transmission={0.85} thickness={0.02} transparent opacity={0.55} side={2} />
        ) : (
          <meshPhysicalMaterial color="#ffffff" roughness={0.03} metalness={0} transparent opacity={0.16} side={2} clearcoat={1} />
        )}
      </mesh>
      <mesh position={[0, (H - 0.12) / 2 + 0.06, 0]}>
        <cylinderGeometry args={[0.45, 0.41, H - 0.2, 40]} />
        <meshPhysicalMaterial color={color} roughness={0.08} transmission={0.55} thickness={0.6} transparent opacity={0.72} />
      </mesh>
      {ICE.map((c, i) => (
        <mesh key={i} position={[c.x, c.y, c.z]} rotation={[c.rx, c.ry, 0]} scale={c.s}>
          <boxGeometry args={[1, 1, 1]} />
          <meshPhysicalMaterial color="#f4fbff" roughness={0.15} transmission={0.6} thickness={0.2} transparent opacity={0.75} />
        </mesh>
      ))}
      <Suspense fallback={null}>
        {MINT.map((m, i) => (
          <group key={i} position={[m.x, m.y, m.z]} rotation={[m.rx, m.ry, 0]}>
            <Model name={MODELS.mint} scale={0.6} shadows={false} />
          </group>
        ))}
        {/* sprig crowning the drink */}
        <group position={[-0.05, H - 0.02, 0]} rotation={[0.15, 0.6, 0]}>
          <Model name={MODELS.mint} scale={0.9} />
        </group>
        {/* lime half perched on the rim, cut face outward */}
        <group position={[0.46, H - 0.32, 0.05]} rotation={[0, 0, -Math.PI / 2]}>
          <Model name={MODELS.lime} scale={0.8} />
        </group>
      </Suspense>
      <mesh position={[-0.12, H + 0.2, 0.05]} rotation-z={0.22} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 2.1, 12]} />
        <meshStandardMaterial color={takeaway ? '#1f1f1f' : '#e9e4d8'} roughness={0.5} />
      </mesh>
      {takeaway && (
        <mesh position={[0, H, 0]}>
          <sphereGeometry args={[0.49, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshPhysicalMaterial color="#ffffff" roughness={0.2} transmission={0.8} thickness={0.02} transparent opacity={0.4} />
        </mesh>
      )}
    </group>
  );
}

function PlainGlass({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[0, 0.8, 0]} castShadow>
        <cylinderGeometry args={[0.44, 0.38, 1.6, 40, 1, true]} />
        <meshPhysicalMaterial color="#ffffff" roughness={0.05} transmission={1} thickness={0.06} transparent opacity={0.4} side={2} />
      </mesh>
      <mesh position={[0, 0.62, 0]}>
        <cylinderGeometry args={[0.41, 0.37, 1.15, 40]} />
        <meshStandardMaterial color={color} roughness={0.15} transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

export function DrinkModel({ drink, takeaway }: { drink: MenuDrink; takeaway: boolean }) {
  if (drink.id === 'mojito') return <Mojito color={drink.color} takeaway={takeaway} />;
  if (drink.id === 'coca-cola' || drink.id === 'sprite') return <Can drink={drink} />;
  return <PlainGlass color={drink.color} />;
}

/** One stable spot per menu drink beside the board, so changing one never reshuffles the others. */
export function Drinks({ menuDrinks, qty, mode, wide }: { menuDrinks: MenuDrink[]; qty: Record<string, number>; mode: ServiceMode; wide: boolean }) {
  // wide screens: a column right of the board; narrow screens: a row behind it
  const slots: [number, number][] = wide
    ? [[3.05, -1.5], [3.15, -0.2], [3.05, 1.1], [3.15, 2.3]]
    : [[-1.6, -2.9], [0, -3.05], [1.6, -2.9], [3.0, -2.4]];
  const step: [number, number] = wide ? [0.95, 0.25] : [0.35, -0.9];
  return (
    <group>
      {menuDrinks.slice(0, slots.length).map((d, i) => {
        const [x, z] = slots[i];
        const n = qty[d.id] ?? 0;
        // each drink loads its own models only once it is actually ordered
        return [0, 1].map((k) =>
          n > k && d.price !== null ? (
            <Suspense key={`${d.id}-${k}`} fallback={null}>
              <Pop show drop={1.2} position={[x + k * step[0], 0, z + k * step[1]]}>
                <DrinkModel drink={d} takeaway={mode === 'takeaway'} />
              </Pop>
            </Suspense>
          ) : null,
        );
      })}
    </group>
  );
}
