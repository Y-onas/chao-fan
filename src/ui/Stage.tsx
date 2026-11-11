import { Component, lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import type { Bowl, MenuDrink, ServiceMode } from '../order/types.ts';
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

interface StageProps {
  bowl: Bowl;
  mode: ServiceMode;
  finished: boolean;
  drinks: Record<string, number>;
  menuDrinks: MenuDrink[];
  stickerLine: string;
}

export function Stage(props: StageProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [view, setView] = useState<'3d' | '2d'>(() => (hasWebGL() ? '3d' : '2d'));
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  const onError = useCallback(() => {
    setFailed(true);
    setView('2d');
  }, []);
  const show3d = view === '3d' && !failed;

  return (
    <div className={`stage ${props.finished ? 'finished' : ''}`} data-view={show3d ? '3d' : '2d'}>
      {show3d ? (
        <SceneBoundary onError={onError}>
          <Suspense fallback={null}>
            <FoodScene {...props} reducedMotion={reducedMotion} onReady={onReady} />
          </Suspense>
        </SceneBoundary>
      ) : (
        <Fallback2D {...props} />
      )}
      {show3d && !ready && <div className="stage-loading">Plating up…</div>}
      <div className="stage-tools">
        {failed ? (
          <span className="stage-note">3D preview unavailable — showing photo preview</span>
        ) : (
          hasWebGL() && (
            <button type="button" className="chip" onClick={() => setView(show3d ? '2d' : '3d')}>
              {show3d ? 'Simple view' : '3D view'}
            </button>
          )
        )}
        {show3d && <span className="stage-hint">Drag sideways to turn the plate</span>}
      </div>
    </div>
  );
}
