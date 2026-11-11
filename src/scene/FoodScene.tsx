import { Environment, Html, Lightformer } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PCFSoftShadowMap, Vector3 } from 'three';
import type { Bowl as BowlState, MenuDrink, ServiceMode } from '../order/types.ts';
import { Board, BOARD_R, BOARD_TOP, Bowl, Rice } from './Dish.tsx';
import { Drinks } from './Drinks.tsx';
import { Pop, ReducedMotion } from './motion.tsx';
import { ChickenLegs, SAUCE_POS, SauceCanvas, SauceLayer, SauceStation, TRAY_POS } from './Props.tsx';
import { OrderStamp, ServingSpoon, Steam, TakeawayBox } from './Service.tsx';
import { Toppings } from './Toppings.tsx';
import { preloadCore } from './models.tsx';

preloadCore();

export interface FoodSceneProps {
  bowl: BowlState;
  mode: ServiceMode;
  phase: 'build' | 'finished' | 'placed';
  /** Rice is still "in the wok": the board is empty. */
  warming: boolean;
  drinks: Record<string, number>;
  menuDrinks: MenuDrink[];
  legMax: number;
  orderId: string | null;
  customerName: string;
  hints: { leg: boolean; spoon: boolean };
  sauced: number;
  reducedMotion: boolean;
  onReady: () => void;
  onLegTap: () => void;
  onNeedBase: () => void;
  onSpoonUsed: () => void;
  onSauceCoverage: (pct: number) => void;
}

/** Near-overhead, fixed viewpoint like the reference; no orbiting while ordering. */
const ELEVATION = (64 * Math.PI) / 180;
const VIEW_DIR = new Vector3(0, Math.sin(ELEVATION), Math.cos(ELEVATION));
/** Below this canvas aspect the side stations are hidden and the board fills the frame. */
const WIDE_ASPECT = 1.3;

function CameraRig({ wide }: { wide: boolean }) {
  const { camera, size } = useThree();
  const pos = useMemo(() => new Vector3(), []);
  const target = useMemo(() => new Vector3(), []);
  const first = useRef(true);
  useFrame((_, dt) => {
    const aspect = size.width / size.height;
    // world-space box that must stay in view
    const [x0, x1, z0, z1] = wide ? [-5.15, 3.7, -2.55, 2.75] : [-2.4, 2.4, -3.4, 2.6];
    const vfov = ((camera as { fov: number }).fov * Math.PI) / 180;
    const w = x1 - x0;
    const d = (z1 - z0) * Math.sin(ELEVATION) + 1.6 * Math.cos(ELEVATION);
    const dist = Math.max(w / 2 / (Math.tan(vfov / 2) * aspect), d / 2 / Math.tan(vfov / 2)) * 0.98;
    target.set((x0 + x1) / 2, 0.3, (z0 + z1) / 2);
    pos.copy(VIEW_DIR).multiplyScalar(dist).add(target);
    if (first.current) camera.position.copy(pos);
    else camera.position.lerp(pos, Math.min(1, dt * 4));
    first.current = false;
    camera.lookAt(target);
  });
  return null;
}

function Ready({ onReady }: { onReady: () => void }) {
  useEffect(onReady, [onReady]);
  return null;
}

function Hint({ at, children, className = '' }: { at: [number, number, number]; children: React.ReactNode; className?: string }) {
  return (
    <Html position={at} center zIndexRange={[5, 0]} className={`scene-hint ${className}`} pointerEvents="none">
      {children}
    </Html>
  );
}

/** Zig-zag drizzle across the rice, used when sauce is picked from the rail instead of spooned on. */
function useAutoDrizzle(sauce: SauceCanvas, active: boolean, reduced: boolean, onDone: () => void) {
  const t = useRef<number | null>(null);
  useEffect(() => {
    if (!active) return;
    t.current = 0;
    if (reduced) {
      drizzleTo(sauce, 0, 1);
      t.current = null;
      onDone();
    }
  }, [active, reduced, sauce, onDone]);
  useFrame((_, dt) => {
    if (t.current === null) return;
    const prev = t.current;
    t.current = Math.min(1, prev + dt / 0.9);
    drizzleTo(sauce, prev, t.current);
    if (t.current >= 1) {
      t.current = null;
      sauce.lift();
      onDone();
    }
  });
}

function drizzlePoint(s: number): [number, number] {
  const rows = 7;
  const row = Math.min(rows - 1, Math.floor(s * rows));
  const f = s * rows - row;
  const z = -0.8 + (row + f * 0.9) * 0.27;
  const half = Math.sqrt(Math.max(0, 1.0 - z * z)) * 0.95;
  const x = row % 2 ? half - 2 * half * f : -half + 2 * half * f;
  return [x, z];
}

function drizzleTo(sauce: SauceCanvas, from: number, to: number) {
  for (let s = from; s <= to; s += 0.003) sauce.stroke(...drizzlePoint(s), 0.11);
}

export default function FoodScene(props: FoodSceneProps) {
  const { bowl, mode, phase, warming, drinks, menuDrinks, reducedMotion, onReady } = props;
  const [boxClosed, setBoxClosed] = useState(false);
  const [wide, setWide] = useState(true);
  const sauce = useMemo(() => new SauceCanvas(), []);
  const finished = phase !== 'build';
  const packed = finished && mode === 'takeaway';
  const sauceOn = bowl.extras.sauce > 0;
  const editable = phase !== 'placed' && !warming;

  // throttle coverage reads; the canvas probe is cheap but not free
  const lastProbe = useRef(0);
  const { onSauceCoverage } = props;
  const report = useCallback(() => onSauceCoverage(sauce.coverage()), [onSauceCoverage, sauce]);
  const onStroke = useCallback(() => {
    const now = performance.now();
    if (now - lastProbe.current > 120) {
      lastProbe.current = now;
      report();
    }
  }, [report]);

  // sauce picked on the rail with nothing spooned yet → drizzle it on; removed → wipe it off
  const [drizzle, setDrizzle] = useState(false);
  useEffect(() => {
    if (!sauceOn) {
      sauce.clear();
      report();
      setDrizzle(false);
    } else if (sauce.coverage() < 0.05) setDrizzle(true);
  }, [sauceOn, sauce, report]);
  const drizzleDone = useCallback(() => {
    setDrizzle(false);
    report();
  }, [report]);

  return (
    <div className="scene-canvas">
      <Canvas
        shadows={{ type: PCFSoftShadowMap }}
        dpr={[1, 2]}
        flat
        camera={{ fov: 28, near: 0.5, far: 80, position: [0, 14, 7] }}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
        onCreated={({ size }) => setWide(size.width / size.height >= WIDE_ASPECT)}
        onPointerMissed={() => (document.body.style.cursor = '')}
        aria-label="Live 3D preview of your chaofan"
        role="img"
      >
        <AspectWatcher onChange={setWide} />
        <ReducedMotion.Provider value={reducedMotion}>
          <hemisphereLight args={['#fff8ee', '#b99a7a', 0.75]} />
          <directionalLight
            position={[-4.5, 10, -3]}
            intensity={1.55}
            color="#fff3e2"
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-bias={-0.0004}
            shadow-normalBias={0.02}
            shadow-camera-left={-7}
            shadow-camera-right={7}
            shadow-camera-top={6}
            shadow-camera-bottom={-6}
            shadow-radius={6}
          />
          <directionalLight position={[4, 4, 5]} intensity={0.35} color="#ffe2c2" />
          <Environment resolution={128} frames={1}>
            <Lightformer intensity={1.1} position={[0, 7, 0]} rotation-x={Math.PI / 2} scale={[12, 12, 1]} />
            <Lightformer intensity={0.7} position={[-6, 3, 2]} rotation-y={Math.PI / 2} scale={[6, 3, 1]} color="#ffe6cc" />
          </Environment>
          <CameraRig wide={wide} />

          {/* catches contact shadows only, so the striped page shows through */}
          <mesh rotation-x={-Math.PI / 2} receiveShadow>
            <planeGeometry args={[40, 40]} />
            <shadowMaterial opacity={0.2} />
          </mesh>

          <Suspense fallback={null}>
            <Board />
            {/* hidden, not unmounted, once boxed so reopening does not replay every drop-in */}
            <group visible={!boxClosed}>
              <group position={[0, BOARD_TOP, 0]}>
                <Bowl />
                <Pop show={!warming} drop={1.4} duration={0.6}>
                  <Rice />
                  <Toppings base={bowl.base} extras={bowl.extras} />
                  <SauceLayer sauce={sauce} />
                </Pop>
              </group>
              <ServingSpoon show={finished && mode === 'dine-in'} />
            </group>
            {wide && (
              <>
                <ChickenLegs count={bowl.extras.chickenLeg} max={props.legMax} interactive={editable} onTap={bowl.base ? props.onLegTap : props.onNeedBase} />
                <SauceStation sauce={sauce} enabled={editable && !!bowl.base && !packed} onDragStart={props.onSpoonUsed} onStroke={onStroke} onRefused={props.onNeedBase} />
              </>
            )}
            <TakeawayBox packed={packed} onClosed={setBoxClosed} />
            <OrderStamp orderId={props.orderId} name={props.customerName} takeaway={mode === 'takeaway'} />
            <Drinks menuDrinks={menuDrinks} qty={drinks} mode={mode} wide={wide} />
            <Ready onReady={onReady} />
          </Suspense>
          <DrizzleDriver sauce={sauce} active={drizzle} reduced={reducedMotion} onDone={drizzleDone} />
          <Steam strength={packed || warming ? 0 : finished ? 1 : 0.5} />

          {wide && !props.hints.leg && (
            <Hint at={[TRAY_POS.x + 0.2, 0.4, TRAY_POS.z - 1.35]}>tap for a leg ↓</Hint>
          )}
          {wide && !props.hints.spoon && (
            <Hint at={[SAUCE_POS.x - 0.55, 0.4, SAUCE_POS.z - 1.15]} className="tilt">
              drag the spoon ↘
            </Hint>
          )}
          <Html position={[0, 0, BOARD_R + 0.42]} center zIndexRange={[5, 0]} pointerEvents="none">
            <div className="sauce-meter" data-testid="sauce-meter" aria-label={`Sauced ${Math.round(props.sauced * 100)}%`}>
              <span>Sauced</span>
              <i style={{ ['--p' as string]: props.sauced }} />
              <b>{Math.round(props.sauced * 100)}%</b>
            </div>
          </Html>
        </ReducedMotion.Provider>
      </Canvas>
    </div>
  );
}

function DrizzleDriver(p: { sauce: SauceCanvas; active: boolean; reduced: boolean; onDone: () => void }) {
  useAutoDrizzle(p.sauce, p.active, p.reduced, p.onDone);
  return null;
}

function AspectWatcher({ onChange }: { onChange: (wide: boolean) => void }) {
  const { size } = useThree();
  useEffect(() => onChange(size.width / size.height >= WIDE_ASPECT), [size.width, size.height, onChange]);
  return null;
}
