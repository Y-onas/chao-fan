import { useFrame } from '@react-three/fiber';
import { createContext, useContext, useRef, type ReactNode } from 'react';
import type { Group } from 'three';

/** True when the visitor prefers reduced motion: transitions snap instead of animate. */
export const ReducedMotion = createContext(false);

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t: number) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/**
 * Drives a 0..1 progress toward `target` every frame. Because it is a
 * position rather than a timeline, a selection change mid-animation simply
 * reverses from wherever it is — no queued or stale tweens on rapid taps.
 */
export function useProgress(target: boolean, duration: number, onFrame: (p: number) => void) {
  const reduced = useContext(ReducedMotion);
  const p = useRef(target && reduced ? 1 : 0);
  useFrame((_, dt) => {
    const goal = target ? 1 : 0;
    if (reduced) p.current = goal;
    else {
      const step = Math.min(dt, 0.25) / duration; // real time even at low fps
      p.current = goal > p.current ? Math.min(goal, p.current + step) : Math.max(goal, p.current - step);
    }
    onFrame(p.current);
  });
  return p;
}

interface PopProps {
  show: boolean;
  /** 0..0.7 — fraction of the transition to wait, staggering grouped items. */
  delay?: number;
  duration?: number;
  drop?: number;
  position?: [number, number, number];
  children: ReactNode;
}

/** Drops children onto the dish with a small overshoot, and lifts them off when deselected. */
export function Pop({ show, delay = 0, duration = 0.55, drop = 0.9, position = [0, 0, 0], children }: PopProps) {
  const ref = useRef<Group>(null);
  useProgress(show, duration, (p) => {
    const g = ref.current;
    if (!g) return;
    const t = clamp01((p - delay) / (1 - delay));
    g.visible = t > 0.001;
    const s = Math.max(0.001, easeOutBack(t));
    g.scale.setScalar(s);
    g.position.set(position[0], position[1] + (1 - easeOutCubic(t)) * drop, position[2]);
  });
  return (
    <group ref={ref} visible={false} position={position}>
      {children}
    </group>
  );
}

export { clamp01, easeOutBack, easeOutCubic };
