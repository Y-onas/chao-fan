import type { Bowl, MenuDrink, ServiceMode } from '../order/types.ts';
import { ASSET } from '../scene/assets.ts';

/** Static, photo-composited preview for devices without WebGL or when 3D assets fail. */
export function Fallback2D({ bowl, mode, finished, drinks, menuDrinks }: { bowl: Bowl; mode: ServiceMode; finished: boolean; drinks: Record<string, number>; menuDrinks: MenuDrink[] }) {
  const packed = finished && mode === 'takeaway';
  const on = (v: boolean) => (v ? 'on' : '');
  const chicken = ASSET.chickenPieces.map(([src]) => src);
  return (
    <div className={`plate2d ${packed ? 'packed' : ''}`} role="img" aria-label="Preview of your chaofan">
      <div className="plate2d-bowl">
        <div className="plate2d-rice" style={{ backgroundImage: `url(${ASSET.riceAlbedo})` }} />
        <div className={`plate2d-layer ${on(bowl.base === 'chicken')}`}>
          {[[30, 32], [55, 28], [42, 58], [66, 55], [24, 52]].map(([l, t], i) => (
            <img key={i} src={chicken[i % 3]} alt="" style={{ left: `${l}%`, top: `${t}%`, width: '17%' }} />
          ))}
        </div>
        <div className={`plate2d-layer dots beef ${on(bowl.base === 'beef')}`} />
        <div className={`plate2d-layer dots egg ${on(bowl.base === 'egg')}`} />
        <div className={`plate2d-layer dots veg ${on(bowl.base === 'veggie')}`} />
        {[0, 1, 2].map((i) => (
          <img key={`e${i}`} className={`plate2d-item ${on(bowl.extras.egg > i)}`} src={ASSET.friedEgg} alt="" style={{ left: `${[18, 48, 8][i]}%`, top: `${[48, 55, 22][i]}%`, width: '34%' }} />
        ))}
        {[0, 1].map((i) => (
          <img key={`l${i}`} className={`plate2d-item ${on(bowl.extras.chickenLeg > i)}`} src={ASSET.chickenLeg} alt="" style={{ left: `${[60, 40][i]}%`, top: `${[18, 6][i]}%`, width: '34%' }} />
        ))}
        <div className={`plate2d-item plate2d-sauce ${on(bowl.extras.sauce > 0)}`} style={{ backgroundImage: `url(${ASSET.sauce})` }} />
      </div>
      <div className={`plate2d-item plate2d-sauce side ${on(bowl.extras.sauce > 1)}`} style={{ backgroundImage: `url(${ASSET.sauce})` }} />
      <div className="plate2d-drinks">
        {menuDrinks.map((d) =>
          Array.from({ length: Math.min(2, drinks[d.id] ?? 0) }, (_, k) => <span key={`${d.id}${k}`} className={`plate2d-drink ${mode}`} style={{ ['--drink' as string]: d.color }} />),
        )}
      </div>
      <div className="plate2d-box" aria-hidden={!packed}>
        <span>ChaoFan Corner</span>
      </div>
    </div>
  );
}
