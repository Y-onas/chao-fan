import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useMenu } from './order/api.ts';
import { formatPrice, priceOrder } from './order/pricing.ts';
import { selectDraft, useOrder } from './order/store.ts';
import type { BaseId, ExtraId } from './order/types.ts';
import { Admin } from './ui/Admin.tsx';
import { CheckoutModal, OrderUpModal } from './ui/OrderModal.tsx';
import { Rail, railItems, type RailItem } from './ui/Rail.tsx';
import { Receipt } from './ui/Receipt.tsx';
import { Stage, usePrefersReducedMotion } from './ui/Stage.tsx';

const Thumbs = lazy(() => import('./scene/Thumbs.tsx'));

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
  if (route.startsWith('#/thumbs'))
    return (
      <Suspense fallback={null}>
        <Thumbs />
      </Suspense>
    );
  return <Ordering />;
}

/** Sauce counts as added once a decent share of the rice has been spooned over. */
const SAUCE_THRESHOLD = 0.3;
const WARM_MS = 1100;

function Ordering() {
  const { menu, status } = useMenu();
  const order = useOrder();
  const { current, phase, mode, drinks, placed, reconcile, resetCount } = order;
  const ordering = status === 'live';
  const priced = priceOrder(selectDraft(order), menu);
  const reducedMotion = usePrefersReducedMotion();
  const extraMax = (id: ExtraId) => menu.extras.find((e) => e.id === id)?.max ?? 1;

  const [warming, setWarming] = useState(true);
  const [sauced, setSauced] = useState(0);
  const [nudge, setNudge] = useState(false);
  const [modal, setModal] = useState<'checkout' | 'orderup' | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status === 'live') reconcile(menu);
  }, [status, menu, reconcile]);

  // the rice "comes off the wok" on load and after every start-over
  useEffect(() => {
    setWarming(true);
    const t = setTimeout(() => setWarming(false), reducedMotion ? 0 : WARM_MS);
    return () => clearTimeout(t);
  }, [resetCount, reducedMotion]);

  const needBase = useCallback(() => {
    setNudge(true);
    railRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setTimeout(() => setNudge(false), 1400);
  }, []);

  const add = useCallback(
    (item: RailItem, mode: 'toggle' | 'add') => {
      const s = useOrder.getState();
      if (item.disabled || s.phase === 'placed') return;
      if (item.kind === 'base') {
        s.setBase(mode === 'toggle' && s.current.base === item.id ? null : (item.id as BaseId));
      } else if (item.kind === 'extra') {
        if (!s.current.base) return needBase();
        const id = item.id as ExtraId;
        const q = s.current.extras[id];
        s.setExtra(id, mode === 'toggle' ? (q > 0 ? 0 : 1) : q + 1, extraMax(id));
      } else {
        const q = s.drinks[item.id] ?? 0;
        s.setDrink(item.id, mode === 'toggle' ? (q > 0 ? 0 : 1) : q + 1);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [needBase, menu],
  );

  const onSauceCoverage = useCallback(
    (p: number) => {
      setSauced(p);
      const s = useOrder.getState();
      if (p >= SAUCE_THRESHOLD && s.current.base && s.current.extras.sauce === 0) s.setExtra('sauce', 1, extraMax('sauce'));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [menu],
  );
  const onLegTap = useCallback(() => {
    const s = useOrder.getState();
    s.doneHint('leg');
    s.setExtra('chickenLeg', s.current.extras.chickenLeg + 1, extraMax('chickenLeg'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu]);
  const onSpoonUsed = useCallback(() => useOrder.getState().doneHint('spoon'), []);

  const startOver = () => {
    setModal(null);
    order.startOver();
    scrollTo({ top: 0, behavior: 'smooth' });
  };
  const primary = () => {
    if (phase === 'build') return current.base ? order.finish() : needBase();
    if (phase === 'finished') return setModal('checkout');
    setModal('orderup');
  };
  const primaryLabel = phase === 'build' ? (mode === 'takeaway' ? 'Box it up ✓' : 'Plate it up ✓') : phase === 'finished' ? 'Checkout' : 'View order';

  return (
    <div className="page">
      <div className="awning" aria-hidden />
      <header className="nav">
        <a className="logo" href="#top" aria-label="ChaoFan Corner home">
          ChaoFan <em>Corner</em>
        </a>
        <nav aria-label="Main">
          <a href="#build">Build</a>
          <a href="#menu" onClick={() => railRef.current?.scrollIntoView({ behavior: 'smooth' })}>
            Menu
          </a>
          <a href="#how">How it works</a>
        </nav>
        <button type="button" className="btn red pill" onClick={primary}>
          Order now <span aria-hidden>↗</span>
        </button>
      </header>

      <main id="top">
        <section className="hero" id="build">
          <p className="eyebrow">
            <i className="dot" /> ChaoFan Corner · wok-fried to order
          </p>
          <h1>
            Build your <em>perfect</em> bowl.
          </h1>
          <p className="lede">
            Tossed in the wok, built to order. <b>Pick your chaofan, tap a chicken leg, spoon on the house sauce</b> and we’ll have it ready when you are.
          </p>
        </section>

        <section className="builder">
          <div className="stage-col">
            <Stage
              bowl={current}
              mode={placed?.mode ?? mode}
              phase={phase}
              warming={warming}
              drinks={drinks}
              menuDrinks={menu.drinks}
              legMax={extraMax('chickenLeg')}
              orderId={placed?.id ?? null}
              customerName={placed?.name ?? ''}
              hints={order.hintsDone}
              sauced={sauced}
              onLegTap={onLegTap}
              onNeedBase={needBase}
              onSpoonUsed={onSpoonUsed}
              onSauceCoverage={onSauceCoverage}
            />
          </div>
          <div className={`receipt-col ${receiptOpen ? 'open' : ''}`}>
            <Receipt
              menu={menu}
              priced={priced}
              phase={phase}
              mode={mode}
              warming={warming}
              hasBase={!!current.base}
              lastAdded={order.lastAdded}
              placed={placed}
              ordering={ordering}
              reducedMotion={reducedMotion}
              onMode={order.setMode}
              onFinish={order.finish}
              onCheckout={() => setModal('checkout')}
              onStartOver={startOver}
            />
          </div>
        </section>

        <section className="rail-wrap" id="menu" ref={railRef}>
          {!order.hintsDone.drag && <p className="scene-hint rail-hint">drag one onto the bowl ↓</p>}
          {nudge && (
            <p className="nudge" role="status">
              Pick a chaofan first ↓
            </p>
          )}
          <Rail
            items={railItems(menu, current, drinks)}
            currency={menu.currency}
            wiggleBases={nudge}
            onTap={(it) => add(it, 'toggle')}
            onDrop={(it) => add(it, 'add')}
            onDragUsed={() => order.doneHint('drag')}
          />
          {menu.drinks.some((d) => d.price === null) && <p className="rail-note">Drinks marked “Price TBC” can be ordered once the restaurant sets their price.</p>}
        </section>

        <section className="how" id="how">
          <h2>How it works</h2>
          <ol>
            <li>
              <b>Build.</b> Pick a chaofan — the rice comes with it. Add chicken legs, a fried egg, house sauce and a drink.
            </li>
            <li>
              <b>Finish.</b> Plate it for dine-in, or box it up for takeaway (+{formatPrice(menu.packaging.takeawayBox, menu.currency)}).
            </li>
            <li>
              <b>Order.</b> Leave your name and phone; the kitchen confirms your order number.
            </li>
          </ol>
        </section>
      </main>

      <footer className="credits">
        3D food: scans by EGFoodScans, truekit, blenderguppy, usefulspunforsup, Arkify 3D, Zinaida.Kovrova; can by Blender3D; cutlery by Okayest — via Sketchfab, CC BY 4.0, modified.
      </footer>

      <div className="mobile-bar">
        <button type="button" className="mobile-total" onClick={() => setReceiptOpen((o) => !o)} aria-expanded={receiptOpen}>
          <small>Total · view receipt</small>
          <strong>{formatPrice(priced.total, menu.currency)}</strong>
        </button>
        <button type="button" className={`btn ${phase === 'build' ? 'green' : 'red'}`} disabled={(phase === 'build' && (!current.base || warming)) || (phase === 'finished' && !ordering)} onClick={primary}>
          {primaryLabel}
        </button>
      </div>

      {modal === 'checkout' && (
        <CheckoutModal
          menu={menu}
          ordering={ordering}
          onClose={() => setModal(null)}
          onPlaced={() => {
            setModal(null);
            // let the stamp land before the card appears, like the reference
            setTimeout(() => setModal('orderup'), reducedMotion ? 0 : 1100);
          }}
        />
      )}
      {modal === 'orderup' && placed && <OrderUpModal placed={placed} onAnother={startOver} onClose={() => setModal(null)} />}
    </div>
  );
}
