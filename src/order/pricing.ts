import { EXTRA_IDS, type Menu, type OrderDraft, type PricedOrder, type PriceLine } from './types.ts';

export const MAX_BOWLS = 20;
export const MAX_DRINK_QTY = 10;

export const formatPrice = (amount: number, currency = 'ETB') => `${amount.toLocaleString('en-US')} ${currency}`;

/**
 * Single source of truth for order pricing, used by the UI and re-run by the
 * server on submit so a stale or tampered client total is never trusted.
 */
export function priceOrder(draft: OrderDraft, menu: Menu): PricedOrder {
  const lines: PriceLine[] = [];
  const errors: string[] = [];

  if (draft.bowls.length === 0) errors.push('Choose a chaofan to start your order.');
  if (draft.bowls.length > MAX_BOWLS) errors.push(`At most ${MAX_BOWLS} bowls per order.`);

  draft.bowls.forEach((bowl, i) => {
    const n = i + 1;
    const base = menu.bases.find((b) => b.id === bowl.base);
    if (!base) {
      errors.push(`Bowl ${n} needs a chaofan (rice alone is not on the menu).`);
      return;
    }
    lines.push({ key: `bowl${i}`, label: draft.bowls.length > 1 ? `${base.name} (bowl ${n})` : base.name, qty: 1, unit: base.price, amount: base.price });

    for (const id of EXTRA_IDS) {
      const qty = bowl.extras?.[id] ?? 0;
      if (qty === 0) continue;
      const extra = menu.extras.find((e) => e.id === id);
      if (!extra) {
        errors.push(`Unknown extra "${id}".`);
        continue;
      }
      if (!Number.isInteger(qty) || qty < 0 || qty > extra.max) {
        errors.push(`${extra.name}: choose between 0 and ${extra.max}.`);
        continue;
      }
      lines.push({ key: `bowl${i}-${id}`, label: extra.name, qty, unit: extra.price, amount: qty * extra.price, child: true });
    }

    if (draft.mode === 'takeaway') {
      const unit = menu.packaging.takeawayBox;
      lines.push({ key: `bowl${i}-box`, label: 'Takeaway box', qty: 1, unit, amount: unit, child: true });
    }
  });

  for (const [id, qty] of Object.entries(draft.drinks)) {
    if (qty === 0) continue;
    const drink = menu.drinks.find((d) => d.id === id);
    if (!drink) {
      errors.push(`Drink "${id}" is no longer on the menu.`);
      continue;
    }
    if (drink.price === null) {
      errors.push(`${drink.name} has no price yet — please remove it.`);
      continue;
    }
    if (!Number.isInteger(qty) || qty < 0 || qty > MAX_DRINK_QTY) {
      errors.push(`${drink.name}: choose between 0 and ${MAX_DRINK_QTY}.`);
      continue;
    }
    lines.push({ key: `drink-${id}`, label: drink.name, qty, unit: drink.price, amount: qty * drink.price });
  }

  const total = lines.reduce((sum, l) => sum + l.amount, 0);
  return { lines, total, errors };
}
