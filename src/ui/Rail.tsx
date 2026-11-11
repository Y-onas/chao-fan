import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatPrice } from '../order/pricing.ts';
import type { Bowl, Menu } from '../order/types.ts';

export type RailItem =
  | { kind: 'base'; id: string; name: string; price: number | null; selected: boolean; qty: number; disabled?: boolean }
  | { kind: 'extra' | 'drink'; id: string; name: string; price: number | null; selected: boolean; qty: number; disabled?: boolean };

export const tileSrc = (kind: string, id: string) => `${import.meta.env.BASE_URL}assets/tiles/${kind}-${id}.webp`;

export function railItems(menu: Menu, bowl: Bowl, drinks: Record<string, number>): RailItem[] {
  return [
    ...menu.bases.map((b) => ({ kind: 'base' as const, id: b.id, name: b.name.replace(/ Chaofan$/, ''), price: b.price, selected: bowl.base === b.id, qty: bowl.base === b.id ? 1 : 0 })),
    ...menu.extras.map((e) => ({ kind: 'extra' as const, id: e.id, name: e.name, price: e.price, selected: bowl.extras[e.id] > 0, qty: bowl.extras[e.id] })),
    ...menu.drinks.map((d) => ({ kind: 'drink' as const, id: d.id, name: d.name, price: d.price, selected: (drinks[d.id] ?? 0) > 0, qty: drinks[d.id] ?? 0, disabled: d.price === null })),
  ];
}

const DRAG_START_PX = 8;

/**
 * Tap toggles an item; dragging a tile (mouse/pen) and dropping it on the
 * food stage adds one. Touch keeps native horizontal scrolling and uses taps.
 */
export function Rail({ items, currency, wiggleBases, onTap, onDrop, onDragUsed }: {
  items: RailItem[];
  currency: string;
  wiggleBases: boolean;
  onTap: (item: RailItem) => void;
  onDrop: (item: RailItem) => void;
  onDragUsed: () => void;
}) {
  const [ghost, setGhost] = useState<{ item: RailItem; x: number; y: number; over: boolean } | null>(null);
  const press = useRef<{ item: RailItem; x: number; y: number; dragging: boolean } | null>(null);

  const overStage = (x: number, y: number) => !!document.elementFromPoint(x, y)?.closest('[data-drop-target]');

  function down(e: React.PointerEvent, item: RailItem) {
    if (e.pointerType === 'touch' || item.disabled || e.button !== 0) return;
    press.current = { item, x: e.clientX, y: e.clientY, dragging: false };
    const move = (ev: PointerEvent) => {
      const p = press.current;
      if (!p) return;
      if (!p.dragging && Math.hypot(ev.clientX - p.x, ev.clientY - p.y) > DRAG_START_PX) {
        p.dragging = true;
        document.body.classList.add('dragging-tile');
      }
      if (p.dragging) setGhost({ item: p.item, x: ev.clientX, y: ev.clientY, over: overStage(ev.clientX, ev.clientY) });
    };
    const up = (ev: PointerEvent) => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      const p = press.current;
      press.current = null;
      setGhost(null);
      document.body.classList.remove('dragging-tile');
      if (p?.dragging) {
        // swallow the click that follows a drag
        addEventListener('click', (c) => c.stopPropagation(), { capture: true, once: true });
        if (overStage(ev.clientX, ev.clientY)) {
          onDrop(p.item);
          onDragUsed();
        }
      }
    };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
  }

  return (
    <>
      <ul className="rail" aria-label="Ingredients">
        {items.map((it, i) => {
          const sep = i > 0 && items[i - 1].kind !== it.kind;
          return (
            <li key={`${it.kind}-${it.id}`} className={sep ? 'sep' : ''}>
              <button
                type="button"
                className={`tile ${it.selected ? 'on' : ''} ${wiggleBases && it.kind === 'base' ? 'wiggle' : ''}`}
                aria-pressed={it.selected}
                disabled={it.disabled}
                aria-label={`${it.name}${it.kind === 'base' ? ' Chaofan' : ''}, ${it.price === null ? 'price not set yet' : formatPrice(it.price, currency)}`}
                data-kind={it.kind}
                onPointerDown={(e) => down(e, it)}
                onClick={() => onTap(it)}
              >
                <span className="tile-img">
                  <img src={tileSrc(it.kind, it.id)} alt="" draggable={false} />
                  {it.qty > 1 && <span className="tile-qty">×{it.qty}</span>}
                </span>
                <span className="tile-name">{it.name}</span>
                <span className="tile-price">{it.price === null ? 'Price TBC' : `${it.kind === 'base' ? '' : '+'}${it.price} ${currency}`}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {ghost &&
        createPortal(
          <img className={`drag-ghost ${ghost.over ? 'over' : ''}`} src={tileSrc(ghost.item.kind, ghost.item.id)} alt="" style={{ left: ghost.x, top: ghost.y }} />,
          document.body,
        )}
    </>
  );
}
