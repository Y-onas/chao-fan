import { useEffect, useRef, useState } from 'react';
import { formatPrice } from '../order/pricing.ts';
import type { LastAdded, Phase, PlacedOrder } from '../order/store.ts';
import type { Menu, PricedOrder, ServiceMode } from '../order/types.ts';

/** Rolls the displayed number toward `value` (snaps when motion is reduced). */
export function useRollingNumber(value: number, reduced: boolean) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reduced) return setShown(value);
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 450);
      const v = Math.round(a + (value - a) * (1 - Math.pow(1 - k, 3)));
      setShown(v);
      from.current = v;
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduced]);
  return shown;
}

function note(menu: Menu, last: LastAdded, warming: boolean, phase: Phase, mode: ServiceMode, hasBase: boolean, placed: PlacedOrder | null) {
  if (warming) return { label: 'Chef’s note', title: 'Warming up…', body: 'Your rice is in the wok.' };
  if (placed) return { label: 'Order up', title: `Nº ${placed.id}`, body: placed.mode === 'takeaway' ? 'Packed, stamped and ready for pick-up.' : 'Plated and on its way to your table.' };
  if (phase === 'finished')
    return mode === 'takeaway'
      ? { label: 'Chef’s note', title: 'Boxed up tight', body: 'Sealed in the box and still steaming. Ready when you are.' }
      : { label: 'Chef’s note', title: 'Plated up', body: 'Spoon in, steam rising. Ready when you are.' };
  if (last?.kind === 'base') {
    const b = menu.bases.find((x) => x.id === last.id);
    if (b) return { label: `Added · ${b.name}`, title: b.name, body: b.description };
  }
  if (last?.kind === 'extra') {
    const e = menu.extras.find((x) => x.id === last.id);
    if (e) return { label: `Added · ${e.name}`, title: e.name, body: e.description ?? '' };
  }
  if (last?.kind === 'drink') {
    const d = menu.drinks.find((x) => x.id === last.id);
    if (d) return { label: `Added · ${d.name}`, title: d.name, body: d.description ?? '' };
  }
  if (last?.kind === 'mode')
    return last.id === 'takeaway'
      ? { label: 'Added · Takeaway', title: 'Takeaway box', body: `We’ll pack it to go (+${formatPrice(menu.packaging.takeawayBox, menu.currency)}).` }
      : { label: 'Dine in', title: 'Served in our bowl', body: 'No packaging charge.' };
  if (!hasBase) return { label: 'Chef’s note', title: 'Rice is ready', body: 'Pick a chaofan below to make it a meal — rice comes with it.' };
  return null;
}

export interface ReceiptProps {
  menu: Menu;
  priced: PricedOrder;
  phase: Phase;
  mode: ServiceMode;
  warming: boolean;
  hasBase: boolean;
  lastAdded: LastAdded;
  placed: PlacedOrder | null;
  ordering: boolean;
  reducedMotion: boolean;
  onMode: (m: ServiceMode) => void;
  onFinish: () => void;
  onCheckout: () => void;
  onStartOver: () => void;
}

export function Receipt(p: ReceiptProps) {
  const cur = p.menu.currency;
  const shown = useRollingNumber(p.priced.total, p.reducedMotion);
  const n = note(p.menu, p.lastAdded, p.warming, p.phase, p.mode, p.hasBase, p.placed);
  const locked = p.phase === 'placed';

  return (
    <aside className="receipt" aria-label="Your order">
      <header>
        <div className="receipt-logo">
          ChaoFan <em>Corner</em>
        </div>
        <div className="receipt-meta">{p.placed ? `Order Nº ${p.placed.id}` : 'New order'} · {p.mode === 'takeaway' ? 'Takeaway' : 'Dine in'}</div>
        <div className="mode" role="radiogroup" aria-label="Dine in or takeaway">
          {(['dine-in', 'takeaway'] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={p.mode === m} disabled={locked} onClick={() => p.onMode(m)}>
              {m === 'dine-in' ? 'Dine in' : `Takeaway +${p.menu.packaging.takeawayBox}`}
            </button>
          ))}
        </div>
      </header>

      <ul className="receipt-lines" aria-live="polite">
        {!p.hasBase && !p.warming && (
          <li className="muted">
            <span>Wok-fried rice</span>
            <span>with a chaofan</span>
          </li>
        )}
        {p.priced.lines.map((l) => (
          <li key={l.key}>
            <span>
              {l.label}
              {l.qty > 1 ? ` ×${l.qty}` : ''}
            </span>
            <span>{formatPrice(l.amount, cur)}</span>
          </li>
        ))}
      </ul>

      {n && (
        <div className="receipt-note" key={n.label + n.title}>
          <small>{n.label}</small>
          <strong>{n.title}</strong>
          <p>{n.body}</p>
        </div>
      )}

      <div className="receipt-total">
        <small>Total</small>
        <strong data-testid="total" data-value={p.priced.total}>
          {formatPrice(shown, cur)}
        </strong>
      </div>

      <div className="receipt-actions">
        {p.phase === 'build' && (
          <button type="button" className="btn green" disabled={!p.hasBase || p.warming} onClick={p.onFinish}>
            {p.mode === 'takeaway' ? 'Box it up' : 'Plate it up'} <span aria-hidden>✓</span>
          </button>
        )}
        {p.phase === 'finished' && (
          <button type="button" className="btn red" disabled={!p.ordering || p.priced.errors.length > 0} onClick={p.onCheckout}>
            Checkout
          </button>
        )}
        {p.phase === 'placed' && (
          <button type="button" className="btn red" onClick={p.onStartOver}>
            Build another
          </button>
        )}
        <button type="button" className="btn ghost" onClick={p.onStartOver} disabled={p.warming}>
          Start over
        </button>
      </div>
      {!p.ordering && <p className="receipt-warn">Ordering is paused — we can’t reach the kitchen right now.</p>}
    </aside>
  );
}
