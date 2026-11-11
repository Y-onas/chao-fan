import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { MAX_BOWLS, MAX_DRINK_QTY } from './pricing.ts';
import { emptyExtras, type BaseId, type Bowl, type ExtraId, type Menu, type OrderDraft, type ServiceMode } from './types.ts';

export type Stage = 'build' | 'checkout' | 'placed';

export interface PlacedOrder {
  id: string;
  total: number;
  currency: string;
  mode: ServiceMode;
  /** Server total differed from what the customer saw (menu changed meanwhile). */
  priceChanged?: boolean;
}

export interface OrderState {
  /** The bowl on screen. Rice-only (base null) until a chaofan is chosen. */
  current: Bowl;
  /** Finished bowls the customer has set aside with "Add another bowl". */
  saved: Bowl[];
  drinks: Record<string, number>;
  mode: ServiceMode;
  stage: Stage;
  placed: PlacedOrder | null;

  setBase: (base: BaseId | null) => void;
  setExtra: (id: ExtraId, qty: number, max: number) => void;
  setDrink: (id: string, qty: number) => void;
  setMode: (mode: ServiceMode) => void;
  saveAndStartNew: () => void;
  editSaved: (index: number) => void;
  removeSaved: (index: number) => void;
  setStage: (stage: Stage) => void;
  markPlaced: (order: PlacedOrder) => void;
  startOver: () => void;
  /** Drops selections the current menu can no longer price (e.g. a removed drink). */
  reconcile: (menu: Menu) => void;
}

const riceOnly = (): Bowl => ({ base: null, extras: emptyExtras() });
const clamp = (n: number, max: number) => Math.max(0, Math.min(max, Math.round(n)));

export const selectDraft = (s: Pick<OrderState, 'current' | 'saved' | 'drinks' | 'mode'>): OrderDraft => ({
  bowls: s.current.base ? [...s.saved, s.current] : s.saved,
  drinks: Object.fromEntries(Object.entries(s.drinks).filter(([, q]) => q > 0)),
  mode: s.mode,
});

export const useOrder = create<OrderState>()(
  persist(
    (set, get) => ({
      current: riceOnly(),
      saved: [],
      drinks: {},
      mode: 'dine-in',
      stage: 'build',
      placed: null,

      setBase: (base) => set((s) => ({ current: { ...s.current, base } })),
      setExtra: (id, qty, max) => set((s) => ({ current: { ...s.current, extras: { ...s.current.extras, [id]: clamp(qty, max) } } })),
      setDrink: (id, qty) => set((s) => ({ drinks: { ...s.drinks, [id]: clamp(qty, MAX_DRINK_QTY) } })),
      setMode: (mode) => set({ mode }),
      saveAndStartNew: () => {
        const { current, saved } = get();
        if (!current.base || saved.length + 1 >= MAX_BOWLS) return;
        set({ saved: [...saved, current], current: riceOnly() });
      },
      editSaved: (index) =>
        set((s) => {
          const target = s.saved[index];
          if (!target) return s;
          const rest = s.saved.filter((_, i) => i !== index);
          // the bowl being edited swaps places with whatever is on screen
          return { current: target, saved: s.current.base ? [...rest, s.current] : rest, stage: 'build' };
        }),
      removeSaved: (index) => set((s) => ({ saved: s.saved.filter((_, i) => i !== index) })),
      setStage: (stage) => set({ stage }),
      markPlaced: (placed) => set({ placed, stage: 'placed' }),
      startOver: () => set({ current: riceOnly(), saved: [], drinks: {}, stage: 'build', placed: null }),
      reconcile: (menu) =>
        set((s) => {
          const drinks = Object.fromEntries(Object.entries(s.drinks).filter(([id, q]) => q > 0 && menu.drinks.some((d) => d.id === id && d.price !== null)));
          const fix = (b: Bowl): Bowl => ({
            base: b.base,
            extras: Object.fromEntries(menu.extras.map((e) => [e.id, clamp(b.extras[e.id] ?? 0, e.max)])) as Bowl['extras'],
          });
          return { drinks, current: fix(s.current), saved: s.saved.map(fix) };
        }),
    }),
    {
      name: 'chaofan-order-v1',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({ current: s.current, saved: s.saved, drinks: s.drinks, mode: s.mode, stage: s.stage, placed: s.placed }),
    },
  ),
);
