import { describe, expect, it } from 'vitest';
import menuJson from '../src/data/menu.default.json';
import { priceOrder } from '../src/order/pricing.ts';
import { emptyExtras, type Menu, type OrderDraft } from '../src/order/types.ts';

const menu = menuJson as Menu;
const withDrinkPrices: Menu = { ...menu, drinks: menu.drinks.map((d) => ({ ...d, price: d.id === 'juice' ? 120 : d.price })) };

const draft = (over: Partial<OrderDraft> = {}): OrderDraft => ({
  bowls: [{ base: 'chicken', extras: emptyExtras() }],
  drinks: {},
  mode: 'dine-in',
  ...over,
});

describe('priceOrder', () => {
  it('prices each chaofan at its menu price', () => {
    expect(priceOrder(draft(), menu).total).toBe(500);
    expect(priceOrder(draft({ bowls: [{ base: 'beef', extras: emptyExtras() }] }), menu).total).toBe(450);
    expect(priceOrder(draft({ bowls: [{ base: 'egg', extras: emptyExtras() }] }), menu).total).toBe(350);
    expect(priceOrder(draft({ bowls: [{ base: 'veggie', extras: emptyExtras() }] }), menu).total).toBe(270);
  });

  it('matches the worked example: chicken + leg + egg + sauce + takeaway = 910', () => {
    const r = priceOrder(draft({ bowls: [{ base: 'chicken', extras: { chickenLeg: 1, egg: 1, sauce: 1 } }], mode: 'takeaway' }), menu);
    expect(r.errors).toEqual([]);
    expect(r.total).toBe(910);
    expect(r.lines.map((l) => [l.label, l.amount])).toEqual([
      ['Chicken Chaofan', 500],
      ['Chicken leg', 280],
      ['Fried egg', 40],
      ['House sauce', 50],
      ['Takeaway box', 40],
    ]);
  });

  it('charges no packaging for dine-in and one box per bowl for takeaway', () => {
    const two = [{ base: 'veggie' as const, extras: emptyExtras() }, { base: 'egg' as const, extras: { ...emptyExtras(), egg: 2 } }];
    expect(priceOrder(draft({ bowls: two }), menu).total).toBe(270 + 350 + 80);
    expect(priceOrder(draft({ bowls: two, mode: 'takeaway' }), menu).total).toBe(270 + 350 + 80 + 80);
  });

  it('refuses rice on its own and an empty order', () => {
    expect(priceOrder(draft({ bowls: [{ base: null, extras: emptyExtras() }] }), menu).errors[0]).toMatch(/rice alone/);
    expect(priceOrder(draft({ bowls: [] }), menu).errors[0]).toMatch(/Choose a chaofan/);
  });

  it('never treats an unpriced drink as free', () => {
    const r = priceOrder(draft({ drinks: { water: 1 } }), menu);
    expect(r.errors[0]).toMatch(/no price yet/);
    expect(r.lines.some((l) => l.label === 'Bottled water')).toBe(false);
  });

  it('adds priced drinks per unit and rejects unknown ones', () => {
    expect(priceOrder(draft({ drinks: { juice: 2 } }), withDrinkPrices).total).toBe(500 + 240);
    expect(priceOrder(draft({ drinks: { tej: 1 } }), withDrinkPrices).errors[0]).toMatch(/no longer on the menu/);
  });

  it('rejects extras above the menu maximum or fractional quantities', () => {
    expect(priceOrder(draft({ bowls: [{ base: 'chicken', extras: { chickenLeg: 3, egg: 0, sauce: 0 } }] }), menu).errors).toHaveLength(1);
    expect(priceOrder(draft({ bowls: [{ base: 'chicken', extras: { chickenLeg: 0, egg: 1.5, sauce: 0 } }] }), menu).errors).toHaveLength(1);
  });
});
