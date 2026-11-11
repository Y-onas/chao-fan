import { useMemo } from 'react';
import type { MenuDrink, ServiceMode } from '../order/types.ts';
import { Pop } from './motion.tsx';
import { rng } from './surface.ts';
import { canTexture } from './textures.ts';

const CAN_R = 0.4;
const CAN_H = 1.45;

function Can({ name, color }: { name: string; color: string }) {
  const label = useMemo(() => canTexture(name, color), [name, color]);
  return (
    <group>
      <mesh position={[0, CAN_H / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[CAN_R, CAN_R, CAN_H - 0.16, 48, 1, true]} />
        <meshPhysicalMaterial map={label} metalness={0.35} roughness={0.32} clearcoat={0.6} />
      </mesh>
      {/* tapered aluminium shoulder and base */}
      <mesh position={[0, CAN_H - 0.04, 0]} castShadow>
        <cylinderGeometry args={[CAN_R * 0.82, CAN_R, 0.12, 48]} />
        <meshStandardMaterial color="#c9ccd1" metalness={1} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0.04, 0]}>
        <cylinderGeometry args={[CAN_R, CAN_R * 0.85, 0.08, 48]} />
        <meshStandardMaterial color="#c9ccd1" metalness={1} roughness={0.3} />
      </mesh>
      <mesh position={[0.08, CAN_H + 0.025, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.06, 0.12, 24]} />
        <meshStandardMaterial color="#aeb2b8" metalness={1} roughness={0.3} />
      </mesh>
    </group>
  );
}

const ICE = (() => {
  const r = rng(91);
  return Array.from({ length: 6 }, () => ({ x: (r() - 0.5) * 0.4, y: 0.95 + r() * 0.55, z: (r() - 0.5) * 0.4, rx: r() * 3, ry: r() * 3, s: 0.16 + r() * 0.06 }));
})();
const MINT = (() => {
  const r = rng(92);
  return Array.from({ length: 7 }, () => ({ x: (r() - 0.5) * 0.5, y: 0.35 + r() * 1.25, z: (r() - 0.5) * 0.5, ry: r() * 6, rz: (r() - 0.5) * 1.4 }));
})();

/** Mojito: tall glass (or lidded cup for takeaway), lime-pale liquid, crushed ice, mint, lime wedge, straw. */
function Mojito({ color, takeaway }: { color: string; takeaway: boolean }) {
  const H = 1.75;
  return (
    <group>
      <mesh position={[0, H / 2, 0]} castShadow>
        <cylinderGeometry args={[0.48, 0.42, H, 48, 1, true]} />
        {takeaway ? (
          <meshPhysicalMaterial color="#ffffff" roughness={0.25} transmission={0.85} thickness={0.02} transparent opacity={0.55} side={2} />
        ) : (
          <meshPhysicalMaterial color="#ffffff" roughness={0.04} transmission={1} thickness={0.08} ior={1.5} transparent opacity={0.4} side={2} />
        )}
      </mesh>
      <mesh position={[0, 0.04, 0]}>
        <cylinderGeometry args={[0.42, 0.42, 0.08, 40]} />
        <meshPhysicalMaterial color="#f2f6f2" roughness={0.1} transmission={0.9} thickness={0.1} />
      </mesh>
      <mesh position={[0, (H - 0.12) / 2 + 0.06, 0]}>
        <cylinderGeometry args={[0.45, 0.41, H - 0.2, 40]} />
        <meshStandardMaterial color={color} roughness={0.12} transparent opacity={0.55} />
      </mesh>
      {ICE.map((c, i) => (
        <mesh key={i} position={[c.x, c.y, c.z]} rotation={[c.rx, c.ry, 0]} scale={c.s}>
          <boxGeometry args={[1, 1, 1]} />
          <meshPhysicalMaterial color="#f4fbff" roughness={0.15} transmission={0.6} thickness={0.2} transparent opacity={0.75} />
        </mesh>
      ))}
      {MINT.map((m, i) => (
        <mesh key={i} position={[m.x, m.y, m.z]} rotation={[0.4, m.ry, m.rz]} scale={[0.17, 0.02, 0.1]}>
          <sphereGeometry args={[1, 12, 8]} />
          <meshStandardMaterial color={i % 2 ? '#3f8a2c' : '#5ea83a'} roughness={0.55} />
        </mesh>
      ))}
      {/* mint sprig crowning the drink */}
      {[0, 1.3, 2.6, 3.9].map((a) => (
        <mesh key={a} position={[Math.cos(a) * 0.12, H + 0.06, Math.sin(a) * 0.12]} rotation={[0.3, a, 0.5]} scale={[0.2, 0.025, 0.11]}>
          <sphereGeometry args={[1, 12, 8]} />
          <meshStandardMaterial color="#4f9a33" roughness={0.5} />
        </mesh>
      ))}
      <group position={[0.43, H - 0.05, 0.1]} rotation={[0, 0.4, 0.25]}>
        <mesh rotation-x={Math.PI / 2} scale={[1, 1, 0.5]}>
          <cylinderGeometry args={[0.22, 0.22, 0.12, 32, 1, false, 0, Math.PI]} />
          <meshStandardMaterial color="#8cc63f" roughness={0.45} />
        </mesh>
      </group>
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
  if (drink.id === 'coca-cola' || drink.id === 'sprite') return <Can name={drink.name} color={drink.color} />;
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
        return [0, 1].map((k) => (
          <Pop key={`${d.id}-${k}`} show={n > k && d.price !== null} drop={1.2} position={[x + k * step[0], 0, z + k * step[1]]}>
            <DrinkModel drink={d} takeaway={mode === 'takeaway'} />
          </Pop>
        ));
      })}
    </group>
  );
}
