import { useEffect, useState } from 'react';
import { formatPrice } from '../order/pricing.ts';
import type { Menu, MenuDrink } from '../order/types.ts';

interface AdminOrder {
  id: string;
  createdAt: string;
  total: number;
  currency: string;
  draft: { mode: string };
  customer: { name: string; phone: string; table?: string; notes?: string };
  lines: { key: string; label: string; qty: number; child?: boolean }[];
}

const priceInput = (v: number | null) => (v === null ? '' : String(v));
const parsePrice = (s: string): number | null => (s.trim() === '' ? null : Math.max(0, Math.round(Number(s)) || 0));

/** Owner page (#/admin): set prices — drinks in particular — and see recent orders. */
export function Admin() {
  const [token, setToken] = useState(() => sessionStorage.getItem('chaofan-admin') ?? '');
  const [menu, setMenu] = useState<Menu | null>(null);
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/menu').then((r) => r.json()).then(setMenu, () => setMsg({ ok: false, text: 'Could not load the menu.' }));
  }, []);

  const auth = { authorization: `Bearer ${token}` };
  async function loadOrders() {
    sessionStorage.setItem('chaofan-admin', token);
    const r = await fetch('/api/orders', { headers: auth });
    const body = await r.json();
    if (r.ok) setOrders(body);
    else setMsg({ ok: false, text: body.error });
  }
  async function save() {
    if (!menu) return;
    sessionStorage.setItem('chaofan-admin', token);
    const r = await fetch('/api/menu', { method: 'PUT', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify(menu) });
    const body = await r.json();
    if (r.ok) setMenu(body);
    setMsg(r.ok ? { ok: true, text: 'Menu saved. Customers see it on their next visit.' } : { ok: false, text: body.error });
  }

  if (!menu) return <main className="admin"><p>{msg?.text ?? 'Loading…'}</p></main>;
  const setDrink = (i: number, patch: Partial<MenuDrink>) => setMenu({ ...menu, drinks: menu.drinks.map((d, j) => (j === i ? { ...d, ...patch } : d)) });

  return (
    <main className="admin">
      <header>
        <h1>ChaoFan Corner · Admin</h1>
        <a href="#/">← Back to ordering</a>
      </header>
      <label className="token">
        Admin token
        <input type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="current-password" />
      </label>

      <section>
        <h2>Chaofan</h2>
        {menu.bases.map((b, i) => (
          <label key={b.id} className="admin-row">
            <span>{b.name}</span>
            <input type="number" min={0} value={b.price} onChange={(e) => setMenu({ ...menu, bases: menu.bases.map((x, j) => (j === i ? { ...x, price: parsePrice(e.target.value) ?? 0 } : x)) })} />
          </label>
        ))}
        <h2>Extras & packaging</h2>
        {menu.extras.map((x, i) => (
          <label key={x.id} className="admin-row">
            <span>{x.name}</span>
            <input type="number" min={0} value={x.price} onChange={(e) => setMenu({ ...menu, extras: menu.extras.map((y, j) => (j === i ? { ...y, price: parsePrice(e.target.value) ?? 0 } : y)) })} />
          </label>
        ))}
        <label className="admin-row">
          <span>Takeaway box (per bowl)</span>
          <input type="number" min={0} value={menu.packaging.takeawayBox} onChange={(e) => setMenu({ ...menu, packaging: { takeawayBox: parsePrice(e.target.value) ?? 0 } })} />
        </label>

        <h2>Drinks</h2>
        <p className="hint">Leave a price empty to show the drink as “price not set” — customers can’t order it until you add one.</p>
        {menu.drinks.map((d, i) => (
          <div key={i} className="admin-row drink">
            <input aria-label="Drink name" value={d.name} onChange={(e) => setDrink(i, { name: e.target.value })} />
            <input aria-label={`${d.name} price`} type="number" min={0} placeholder="Price" value={priceInput(d.price)} onChange={(e) => setDrink(i, { price: parsePrice(e.target.value) })} />
            <input aria-label={`${d.name} colour`} type="color" value={d.color} onChange={(e) => setDrink(i, { color: e.target.value })} />
            <button type="button" className="link danger" onClick={() => setMenu({ ...menu, drinks: menu.drinks.filter((_, j) => j !== i) })}>Remove</button>
          </div>
        ))}
        <button
          type="button"
          className="chip"
          onClick={() => setMenu({ ...menu, drinks: [...menu.drinks, { id: `drink-${Date.now().toString(36)}`, name: 'New drink', price: null, color: '#c0392b' }] })}
        >
          + Add drink
        </button>
      </section>

      <div className="admin-actions">
        <button type="button" className="primary" onClick={save}>Save menu</button>
        {msg && <p className={msg.ok ? 'ok' : 'errors'} role="status">{msg.text}</p>}
      </div>

      <section>
        <h2>Recent orders</h2>
        <button type="button" className="chip" onClick={loadOrders}>Load orders</button>
        {orders?.length === 0 && <p className="hint">No orders yet.</p>}
        <ul className="admin-orders">
          {orders?.map((o) => (
            <li key={o.id}>
              <strong>#{o.id}</strong> · {new Date(o.createdAt).toLocaleString()} · {o.draft.mode} · {o.customer.name} ({o.customer.phone}){o.customer.table ? ` · table ${o.customer.table}` : ''}
              <div>{o.lines.filter((l) => !l.child || l.label !== 'Takeaway box').map((l) => `${l.qty > 1 ? `${l.qty}× ` : ''}${l.label}`).join(', ')}</div>
              {o.customer.notes && <div className="hint">“{o.customer.notes}”</div>}
              <div className="price">{formatPrice(o.total, o.currency)}</div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
