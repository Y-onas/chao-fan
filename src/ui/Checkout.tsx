import { useEffect, useRef, useState, type FormEvent } from 'react';
import { submitOrder } from '../order/api.ts';
import { formatPrice, priceOrder } from '../order/pricing.ts';
import { selectDraft, useOrder } from '../order/store.ts';
import type { Menu } from '../order/types.ts';
import { ModeToggle, Receipt } from './Builder.tsx';

const describeBowl = (menu: Menu, b: { base: string | null; extras: Record<string, number> }) => {
  const base = menu.bases.find((x) => x.id === b.base)?.name ?? 'Plain rice';
  const extras = menu.extras.filter((e) => b.extras[e.id] > 0).map((e) => (b.extras[e.id] > 1 ? `${b.extras[e.id]}× ${e.name}` : e.name));
  return extras.length ? `${base} + ${extras.join(', ')}` : base;
};

export function Checkout({ menu, ordering }: { menu: Menu; ordering: boolean }) {
  const s = useOrder();
  const draft = selectDraft(s);
  const priced = priceOrder(draft, menu);
  const [customer, setCustomer] = useState(() => JSON.parse(sessionStorage.getItem('chaofan-customer') ?? '{"name":"","phone":"","table":"","notes":""}'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => heading.current?.focus(), []);
  useEffect(() => sessionStorage.setItem('chaofan-customer', JSON.stringify(customer)), [customer]);

  const field = (k: string) => ({
    value: customer[k] ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setCustomer({ ...customer, [k]: e.target.value }),
  });

  async function place(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await submitOrder(draft, { ...customer, table: s.mode === 'dine-in' ? customer.table : undefined });
      s.markPlaced({ id: res.id, total: res.total, currency: res.currency, mode: s.mode, priceChanged: res.total !== priced.total });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="checkout">
      <button type="button" className="link back" onClick={() => s.setStage('build')}>
        ← Back to the menu
      </button>
      <h2 ref={heading} tabIndex={-1}>
        Review your order
      </h2>

      <ul className="bowls">
        {s.saved.map((b, i) => (
          <li key={i}>
            <span>{describeBowl(menu, b)}</span>
            <span className="actions">
              <button type="button" className="link" onClick={() => s.editSaved(i)}>Edit</button>
              <button type="button" className="link danger" onClick={() => s.removeSaved(i)}>Remove</button>
            </span>
          </li>
        ))}
        {s.current.base && (
          <li>
            <span>{describeBowl(menu, s.current)}</span>
            <span className="actions">
              <button type="button" className="link" onClick={() => s.setStage('build')}>Edit</button>
            </span>
          </li>
        )}
      </ul>

      <ModeToggle mode={s.mode} onChange={s.setMode} boxPrice={menu.packaging.takeawayBox} currency={menu.currency} />
      <Receipt priced={priced} currency={menu.currency} />
      {priced.errors.length > 0 && (
        <ul className="errors" role="alert">
          {priced.errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}

      <form onSubmit={place} className="form">
        <label>
          Your name
          <input required minLength={2} maxLength={60} autoComplete="name" {...field('name')} />
        </label>
        <label>
          Phone
          <input required type="tel" inputMode="tel" pattern="\+?[0-9 ]{7,16}" autoComplete="tel" placeholder="09… or +251…" {...field('phone')} />
        </label>
        {s.mode === 'dine-in' ? (
          <label>
            Table number <small>(optional)</small>
            <input maxLength={10} inputMode="numeric" {...field('table')} />
          </label>
        ) : (
          <p className="hint">We’ll pack it in a takeaway box — collect it at the counter.</p>
        )}
        <label>
          Notes for the kitchen <small>(optional)</small>
          <textarea rows={2} maxLength={300} {...field('notes')} />
        </label>
        {error && <p className="errors" role="alert">{error}</p>}
        <button type="submit" className="primary" disabled={busy || !ordering || priced.errors.length > 0}>
          {busy ? 'Placing order…' : `Place order · ${formatPrice(priced.total, menu.currency)}`}
        </button>
        {!ordering && <p className="hint">Ordering is unavailable while we can’t reach the kitchen.</p>}
      </form>
    </div>
  );
}

export function Placed({ menu }: { menu: Menu }) {
  const { placed, startOver } = useOrder();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  if (!placed) return null;
  return (
    <div className="placed">
      <p className="eyebrow">Order received</p>
      <h2 ref={heading} tabIndex={-1}>
        #{placed.id}
      </h2>
      <p className="placed-total">{formatPrice(placed.total, placed.currency || menu.currency)}</p>
      {placed.priceChanged && <p className="hint">Prices changed while you were ordering; this is the final total from the restaurant.</p>}
      <p>
        {placed.mode === 'takeaway'
          ? 'Your chaofan is being packed into a takeaway box. Show this number at the counter to collect it.'
          : 'Take a seat — we’ll bring your chaofan to you. Show this number if staff ask.'}
      </p>
      <button type="button" className="primary" onClick={startOver}>
        Start a new order
      </button>
    </div>
  );
}
