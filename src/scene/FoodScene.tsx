import { Environment, Lightformer } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Group, PCFSoftShadowMap, Vector3 } from 'three';
import type { Bowl as BowlState, MenuDrink, ServiceMode } from '../order/types.ts';
import { Bowl, Rice } from './Dish.tsx';
import { ReducedMotion } from './motion.tsx';
import { Cutlery, Drinks, Steam, TakeawayBox } from './Service.tsx';
import { marbleTexture } from './textures.ts';
import { Toppings } from './Toppings.tsx';

export interface FoodSceneProps {
  bowl: BowlState;
  mode: ServiceMode;
  /** Finished = customer is checking out or has ordered: plate it for dine-in or pack it for takeaway. */
  finished: boolean;
  drinks: Record<string, number>;
  menuDrinks: MenuDrink[];
  stickerLine: string;
  reducedMotion: boolean;
  onReady: () => void;
}

const TARGET = new Vector3(0.15, 0.35, 0.05);
const VIEW_DIR = new Vector3(0, 0.66, 0.75).normalize();

/** Keeps the whole table in frame for any aspect ratio, easing between framings. */
function CameraRig({ finished }: { finished: boolean }) {
  const { camera, size } = useThree();
  const pos = useMemo(() => new Vector3(), []);
  useFrame((_, dt) => {
    const aspect = size.width / size.height;
    const base = finished ? 9.6 : 8.6;
    const dist = base * Math.max(1, 1.45 / aspect) ** 0.85;
    pos.copy(VIEW_DIR).multiplyScalar(dist).add(TARGET);
    camera.position.lerp(pos, Math.min(1, dt * 3));
    camera.lookAt(TARGET);
  });
  return null;
}

function Table() {
  const marble = useMemo(marbleTexture, []);
  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[40, 40]} />
      <meshStandardMaterial map={marble} roughness={0.32} />
    </mesh>
  );
}

function Ready({ onReady }: { onReady: () => void }) {
  useEffect(onReady, [onReady]);
  return null;
}

/** Horizontal drag turns the table; vertical drags fall through to page scroll. */
function useTurntable() {
  const yaw = useRef(0);
  const drag = useRef<{ x: number; start: number } | null>(null);
  const handlers = {
    onPointerDown: (e: React.PointerEvent) => void (drag.current = { x: e.clientX, start: yaw.current }),
    onPointerMove: (e: React.PointerEvent) => {
      if (!drag.current) return;
      yaw.current = Math.max(-0.75, Math.min(0.75, drag.current.start + (e.clientX - drag.current.x) * 0.006));
    },
    onPointerUp: () => void (drag.current = null),
    onPointerCancel: () => void (drag.current = null),
    onPointerLeave: () => void (drag.current = null),
  };
  return { yaw, handlers };
}

function Turntable({ yaw, children }: { yaw: React.MutableRefObject<number>; children: React.ReactNode }) {
  const g = useRef<Group>(null);
  useFrame((_, dt) => {
    if (g.current) g.current.rotation.y += (yaw.current - g.current.rotation.y) * Math.min(1, dt * 8);
  });
  return <group ref={g}>{children}</group>;
}

export default function FoodScene(props: FoodSceneProps) {
  const { bowl, mode, finished, drinks, menuDrinks, stickerLine, reducedMotion, onReady } = props;
  const { yaw, handlers } = useTurntable();
  const [boxClosed, setBoxClosed] = useState(false);
  const packed = finished && mode === 'takeaway';

  return (
    <div className="scene-canvas" {...handlers}>
      <Canvas
        shadows={{ type: PCFSoftShadowMap }}
        dpr={[1, 2]}
        flat
        camera={{ fov: 30, near: 0.1, far: 60, position: [0, 6.5, 5] }}
        gl={{ antialias: true }}
        aria-label="3D preview of your chaofan"
        role="img"
      >
        <ReducedMotion.Provider value={reducedMotion}>
          <color attach="background" args={['#241a14']} />
          <fog attach="fog" args={['#241a14', 12, 22]} />
          <hemisphereLight args={['#fff3e3', '#4a3426', 0.55]} />
          <directionalLight
            position={[3.5, 7, 2.5]}
            intensity={1.45}
            color="#fff1de"
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-bias={-0.0004}
            shadow-normalBias={0.02}
            shadow-camera-left={-5}
            shadow-camera-right={5}
            shadow-camera-top={5}
            shadow-camera-bottom={-5}
          />
          <directionalLight position={[-4, 3, -3]} intensity={0.45} color="#ffd9b0" />
          <Environment resolution={128} frames={1}>
            <Lightformer intensity={0.9} position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[10, 10, 1]} />
            <Lightformer intensity={0.8} position={[-6, 2, 2]} rotation-y={Math.PI / 2} scale={[6, 3, 1]} color="#ffe3c4" />
          </Environment>
          <CameraRig finished={finished} />
          <Table />
          <Turntable yaw={yaw}>
            <Suspense fallback={null}>
              {/* hidden, not unmounted, once boxed so reopening does not replay every drop-in */}
              <group visible={!boxClosed}>
                <Bowl />
                <Rice />
                <Toppings base={bowl.base} extras={bowl.extras} />
              </group>
              <Ready onReady={onReady} />
            </Suspense>
            <TakeawayBox packed={packed} label={stickerLine} onClosed={setBoxClosed} />
            <Cutlery show={finished && mode === 'dine-in'} />
            <Steam strength={packed ? 0 : finished ? 1 : 0.55} />
            <Drinks menuDrinks={menuDrinks} qty={drinks} mode={mode} />
          </Turntable>
        </ReducedMotion.Provider>
      </Canvas>
    </div>
  );
}
