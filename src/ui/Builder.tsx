import { formatPrice } from '../order/pricing.ts';
import { useOrder } from '../order/store.ts';
import type { Menu, PricedOrder, ServiceMode } from '../order/types.ts';

export function Stepper({ label, value, max, onChange, disabled }: { label: string; value: number; max: number; onChange: (n: number) => void; disabled?: boolean }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" aria-label={`Remove one ${label}`} disabled={disabled || value === 0} onClick={() => onChange(value - 1)}>
        −
      </button>
      <output aria-live="polite" aria-label={`${label} quantity`}>{value}</output>
      <button type="button" aria-label={`Add one ${label}`} disabled={disabled || value >= max} onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  );
}

export function ModeToggle({ mode, onChange, boxPrice, currency }: { mode: ServiceMode; onChange: (m: ServiceMode) => void; boxPrice: number; currency: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label="Dine in or takeaway">
      {(['dine-in', 'takeaway'] as const).map((m) => (
        <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => onChange(m)}>
          <strong>{m === 'dine-in' ? 'Dine in' : 'Takeaway'}</strong>
          <small>{m === 'dine-in' ? 'Served in our bowl' : `+${formatPrice(boxPrice, currency)} box per bowl`}</small>
        </button>
      ))}
    </div>
  );
}

export function Builder({ menu, ordering }: { menu: Menu; ordering: boolean }) {
  const { current, saved, drinks, mode, setBase, setExtra, setDrink, setMode } = useOrder();
  const hasBase = current.base !== null;
  const cur = menu.currency;

  return (
    <div className="builder">
      <section aria-labelledby="h-base">
        <h2 id="h-base">
          <span className="step">1</span> Pick your chaofan
        </h2>
        {!hasBase && <p className="hint">Every bowl starts with our wok-fried rice. Pick a chaofan to make it a meal.</p>}
        <div className="base-grid" role="radiogroup" aria-labelledby="h-base">
          {menu.bases.map((b) => (
            <button key={b.id} type="button" role="radio" aria-checked={current.base === b.id} className={`base-card base-${b.id}`} onClick={() => setBase(b.id)}>
              <span className="base-name">{b.name}</span>
              <span className="base-desc">{b.description}</span>
              <span className="price">{formatPrice(b.price, cur)}</span>
            </button>
          ))}
        </div>
        {hasBase && (
          <button type="button" className="link" onClick={() => setBase(null)}>
            Back to plain rice
          </button>
        )}
      </section>

      <section aria-labelledby="h-extras">
        <h2 id="h-extras">
          <span className="step">2</span> Add extras
        </h2>
        {!hasBase && <p className="hint">Extras go on top of a chaofan — pick one first.</p>}
        <ul className="rows">
          {menu.extras.map((e) => (
            <li key={e.id} className={hasBase ? '' : 'muted'}>
              <div>
                <span className="row-name">{e.name}</span>
                <span className="price small">+{formatPrice(e.price, cur)} each</span>
              </div>
              <Stepper label={e.name} value={current.extras[e.id]} max={e.max} disabled={!hasBase} onChange={(n) => setExtra(e.id, n, e.max)} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="h-drinks">
        <h2 id="h-drinks">
          <span className="step">3</span> Drinks
        </h2>
        <ul className="rows">
          {menu.drinks.map((d) => (
            <li key={d.id} className={d.price === null ? 'muted' : ''}>
              <div>
                <span className="row-name">
                  <span className="swatch" style={{ background: d.color }} aria-hidden /> {d.name}
                </span>
                <span className="price small">{d.price === null ? 'Price not set yet — ask staff' : formatPrice(d.price, cur)}</span>
              </div>
              <Stepper label={d.name} value={drinks[d.id] ?? 0} max={10} disabled={d.price === null} onChange={(n) => setDrink(d.id, n)} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="h-mode">
        <h2 id="h-mode">
          <span className="step">4</span> How are you eating?
        </h2>
        <ModeToggle mode={mode} onChange={setMode} boxPrice={menu.packaging.takeawayBox} currency={cur} />
      </section>

      {saved.length > 0 && <p className="hint">{saved.length} other bowl{saved.length > 1 ? 's' : ''} already in your order.</p>}
      {!ordering && <p className="banner">We can’t reach the kitchen right now. You can still build your bowl; ordering will work once we’re back online.</p>}
    </div>
  );
}

export function Receipt({ priced, currency, compact }: { priced: PricedOrder; currency: string; compact?: boolean }) {
  return (
    <div className={`receipt ${compact ? 'compact' : ''}`}>
      {priced.lines.length === 0 ? (
        <p className="hint">Nothing priced yet — plain rice isn’t sold on its own.</p>
      ) : (
        <ul>
          {priced.lines.map((l) => (
            <li key={l.key} className={l.child ? 'child' : ''}>
              <span>
                {l.qty > 1 && <b>{l.qty}× </b>}
                {l.label}
              </span>
              <span>{formatPrice(l.amount, currency)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="total" aria-live="polite">
        <span>Total</span>
        <strong data-testid="total">{formatPrice(priced.total, currency)}</strong>
      </div>
    </div>
  );
}
