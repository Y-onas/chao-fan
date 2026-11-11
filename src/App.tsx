import { useEffect, useState } from 'react';
import { useMenu } from './order/api.ts';
import { formatPrice, priceOrder } from './order/pricing.ts';
import { selectDraft, useOrder } from './order/store.ts';
import { Admin } from './ui/Admin.tsx';
import { Builder, Receipt } from './ui/Builder.tsx';
import { Checkout, Placed } from './ui/Checkout.tsx';
import { Stage } from './ui/Stage.tsx';

function useHashRoute() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const fn = () => setHash(location.hash);
    addEventListener('hashchange', fn);
    return () => removeEventListener('hashchange', fn);
  }, []);
  return hash;
}

export default function App() {
  const route = useHashRoute();
  if (route.startsWith('#/admin')) return <Admin />;
  return <Ordering />;
}

function Ordering() {
  const { menu, status } = useMenu();
  const order = useOrder();
  const { current, stage, mode, drinks, placed, reconcile } = order;
  const ordering = status === 'live';
  const priced = priceOrder(selectDraft(order), menu);
  const canCheckout = priced.lines.length > 0;

  useEffect(() => {
    if (status === 'live') reconcile(menu);
  }, [status, menu, reconcile]);

  const goCheckout = () => {
    order.setStage('checkout');
    scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden>CF</span>
          <div>
            <h1>ChaoFan Corner</h1>
            <p>Wok-fried rice, built your way</p>
          </div>
        </div>
      </header>

      <main className="layout">
        <Stage
          bowl={current}
          mode={placed?.mode ?? mode}
          finished={stage !== 'build'}
          drinks={drinks}
          menuDrinks={menu.drinks}
          stickerLine={placed ? `Order #${placed.id}` : 'Takeaway'}
        />

        <aside className="panel">
          {stage === 'build' && (
            <>
              <Builder menu={menu} ordering={ordering} />
              <div className="summary">
                <Receipt priced={priced} currency={menu.currency} compact />
                <div className="summary-actions">
                  <button type="button" className="secondary" disabled={!current.base} onClick={order.saveAndStartNew}>
                    Add another bowl
                  </button>
                  <button type="button" className="primary" disabled={!canCheckout} onClick={goCheckout}>
                    Review order
                  </button>
                </div>
              </div>
            </>
          )}
          {stage === 'checkout' && <Checkout menu={menu} ordering={ordering} />}
          {stage === 'placed' && <Placed menu={menu} />}
        </aside>
      </main>

      {stage === 'build' && (
        <div className="mobile-bar">
          <div>
            <small>Total</small>
            <strong>{formatPrice(priced.total, menu.currency)}</strong>
          </div>
          <button type="button" className="primary" disabled={!canCheckout} onClick={goCheckout}>
            Review order
          </button>
        </div>
      )}
    </div>
  );
}
