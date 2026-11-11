import { Bounds, Environment, Lightformer } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect, useState } from 'react';
import menuJson from '../data/menu.default.json';
import { emptyExtras, type BaseId, type Menu } from '../order/types.ts';
import { Bowl, Rice } from './Dish.tsx';
import { DrinkModel } from './Drinks.tsx';
import { PhotoFood, SauceCup, Toppings, useFoodTextures } from './Toppings.tsx';

/**
 * Renders one rail item on a transparent background so the ingredient tiles
 * are pictures of the very models that land on the bowl.
 * Used by scripts/render_tiles.ts via #/thumbs?item=<kind>-<id>.
 */
function Item({ kind, id }: { kind: string; id: string }) {
  const t = useFoodTextures();
  if (kind === 'base')
    return (
      <group>
        <Bowl />
        <Rice />
        <Toppings base={id as BaseId} extras={emptyExtras()} />
      </group>
    );
  if (id === 'chickenLeg') return <PhotoFood map={t.leg} height={t.legH} size={1} thickness={0.2} roughness={0.32} />;
  if (id === 'egg') return <PhotoFood map={t.egg} height={t.eggH} size={0.92} thickness={0.06} roughness={0.4} />;
  if (id === 'sauce') return <SauceCup map={t.sauce} height={t.sauceH} />;
  const drink = (menuJson as Menu).drinks.find((d) => d.id === id);
  return drink ? <DrinkModel drink={drink} takeaway={false} /> : null;
}

function Done() {
  useEffect(() => {
    // give textures a couple of frames to upload before the screenshot
    const t = setTimeout(() => document.body.setAttribute('data-thumb-ready', ''), 600);
    return () => clearTimeout(t);
  }, []);
  return null;
}

export default function Thumbs() {
  const [item] = useState(() => new URLSearchParams(location.hash.split('?')[1]).get('item') ?? 'base-chicken');
  const [kind, ...rest] = item.split('-');
  const id = rest.join('-');
  const drink = kind === 'drink';
  return (
    <div style={{ width: 256, height: 256 }} id="thumb">
      <Canvas flat dpr={1} gl={{ alpha: true, preserveDrawingBuffer: true }} camera={{ fov: 24, position: drink ? [0, 4, 9] : [0, 9, 4.5] }}>
        <hemisphereLight args={['#fff8ee', '#b99a7a', 0.8]} />
        <directionalLight position={[-4, 10, 3]} intensity={1.4} />
        <Environment resolution={64} frames={1}>
          <Lightformer intensity={1.1} position={[0, 7, 0]} rotation-x={Math.PI / 2} scale={[12, 12, 1]} />
        </Environment>
        <Suspense fallback={null}>
          {/* base tiles zoom into the toppings so the four chaofans read differently */}
          <Bounds fit clip margin={kind === 'base' ? 0.62 : 1.05}>
            <Item kind={kind} id={id} />
          </Bounds>
          <Done />
        </Suspense>
      </Canvas>
    </div>
  );
}
