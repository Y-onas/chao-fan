import { Component, lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import type { FoodSceneProps } from '../scene/FoodScene.tsx';
import { Fallback2D } from './Fallback2D.tsx';

const FoodScene = lazy(() => import('../scene/FoodScene.tsx'));

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export function usePrefersReducedMotion() {
  const query = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(query).matches);
  useEffect(() => {
    const m = matchMedia(query);
    const fn = () => setReduced(m.matches);
    m.addEventListener('change', fn);
    return () => m.removeEventListener('change', fn);
  }, []);
  return reduced;
}

class SceneBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.warn('3D preview failed, using photo preview instead', err);
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export type StageProps = Omit<FoodSceneProps, 'reducedMotion' | 'onReady'>;

/** The food stage: live 3D when possible, a simplified photo preview otherwise (never presented as 3D). */
export function Stage(props: StageProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [failed, setFailed] = useState(() => !hasWebGL());
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  const onError = useCallback(() => setFailed(true), []);

  return (
    <div className="stage" data-view={failed ? '2d' : '3d'} data-drop-target>
      {failed ? (
        <>
          <Fallback2D bowl={props.bowl} mode={props.mode} finished={props.phase !== 'build'} drinks={props.drinks} menuDrinks={props.menuDrinks} />
          <span className="stage-note">Simplified photo preview — 3D isn’t available on this device</span>
        </>
      ) : (
        <SceneBoundary onError={onError}>
          <Suspense fallback={null}>
            <FoodScene {...props} reducedMotion={reducedMotion} onReady={onReady} />
          </Suspense>
        </SceneBoundary>
      )}
      {!failed && !ready && <div className="stage-loading">Setting the table…</div>}
    </div>
  );
}
