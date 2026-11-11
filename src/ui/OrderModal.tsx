import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { submitOrder } from '../order/api.ts';
import { formatPrice, priceOrder } from '../order/pricing.ts';
import { selectDraft, useOrder, type PlacedOrder } from '../order/store.ts';
import type { Menu } from '../order/types.ts';

function Modal({ labelledBy, onClose, children, className = '' }: { labelledBy: string; onClose: () => void; children: ReactNode; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>('input, button.primary-focus, h2')?.focus();
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', key);
    document.body.classList.add('modal-open');
    return () => {
      removeEventListener('keydown', key);
      document.body.classList.remove('modal-open');
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={box} className={`modal ${className}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        <button type="button" className="modal-x" aria-label="Close" onClick={onClose}>
          ×
        </button>
        {children}
      </div>
    </div>
  );
}

export function CheckoutModal({ menu, ordering, onClose, onPlaced }: { menu: Menu; ordering: boolean; onClose: () => void; onPlaced: () => void }) {
  const s = useOrder();
  const draft = selectDraft(s);
  const priced = priceOrder(draft, menu);
  const [customer, setCustomer] = useState<Record<string, string>>(() => JSON.parse(sessionStorage.getItem('chaofan-customer') ?? '{"name":"","phone":"","table":"","notes":""}'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      const res = await submitOrder(draft, { name: customer.name, phone: customer.phone, notes: customer.notes, table: s.mode === 'dine-in' ? customer.table : undefined });
      const placed: PlacedOrder = { id: res.id, total: res.total, currency: res.currency, mode: s.mode, name: customer.name.trim().split(/\s+/)[0], priceChanged: res.total !== priced.total };
      s.markPlaced(placed);
      onPlaced();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal labelledBy="checkout-title" onClose={onClose}>
      <small className="eyebrow">Almost there</small>
      <h2 id="checkout-title">Who’s it for?</h2>
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
          <p className="hint">We’ll box it up — collect it at the counter.</p>
        )}
        <label>
          Notes for the kitchen <small>(optional)</small>
          <textarea rows={2} maxLength={300} {...field('notes')} />
        </label>
        {priced.errors.length > 0 && (
          <ul className="errors" role="alert">
            {priced.errors.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        )}
        {error && (
          <p className="errors" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn red wide" disabled={busy || !ordering || priced.errors.length > 0}>
          {busy ? 'Sending to the kitchen…' : `Place order · ${formatPrice(priced.total, menu.currency)}`}
        </button>
      </form>
    </Modal>
  );
}

export function OrderUpModal({ placed, onAnother, onClose }: { placed: PlacedOrder; onAnother: () => void; onClose: () => void }) {
  return (
    <Modal labelledBy="orderup-title" onClose={onClose} className="orderup">
      <small className="eyebrow">Order up!</small>
      <h2 id="orderup-title" tabIndex={-1}>
        Order Nº {placed.id} is <em>{placed.mode === 'takeaway' ? 'boxed' : 'served'}.</em>
      </h2>
      <p>
        {placed.mode === 'takeaway' ? 'Tossed, boxed and ready for pick-up at the counter.' : 'Tossed, plated and on its way to your table.'} See you soon, {placed.name}!
      </p>
      <p className="orderup-total">{formatPrice(placed.total, placed.currency)}</p>
      {placed.priceChanged && <p className="hint">Prices changed while you were ordering; this is the final total from the restaurant.</p>}
      <p className="signature" aria-label="With love, ChaoFan Corner">
        <span>With love, ChaoFan Corner</span>
      </p>
      <div className="modal-actions">
        <button type="button" className="btn red" onClick={onAnother}>
          Build another
        </button>
        <button type="button" className="btn ghost" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
