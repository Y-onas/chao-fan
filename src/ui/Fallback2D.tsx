import type { Bowl, MenuDrink, ServiceMode } from '../order/types.ts';
import { tileSrc } from './Rail.tsx';

/**
 * Simplified preview for devices without WebGL: the same renders of the 3D
 * models used on the ingredient rail, stacked. Never presented as live 3D.
 */
export function Fallback2D({ bowl, mode, finished, drinks, menuDrinks }: { bowl: Bowl; mode: ServiceMode; finished: boolean; drinks: Record<string, number>; menuDrinks: MenuDrink[] }) {
  const extras = (['chickenLeg', 'egg', 'sauce'] as const).filter((id) => bowl.extras[id] > 0);
  const ordered = menuDrinks.filter((d) => (drinks[d.id] ?? 0) > 0);
  return (
    <div className="plate2d" role="img" aria-label="Preview of your chaofan">
      <img className="plate2d-main" src={tileSrc('base', bowl.base ?? 'veggie')} alt="" style={{ filter: bowl.base ? undefined : 'saturate(0.6)' }} />
      <div className="plate2d-side">
        {extras.map((id) => (
          <img key={id} src={tileSrc('extra', id)} alt="" />
        ))}
        {ordered.map((d) => (
          <img key={d.id} src={tileSrc('drink', d.id)} alt="" />
        ))}
      </div>
      {finished && <span className="plate2d-badge">{mode === 'takeaway' ? 'Boxed for takeaway' : 'Plated for dine-in'}</span>}
    </div>
  );
}
