import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { MAX_DRINK_QTY } from './pricing.ts';
import { emptyExtras, type BaseId, type Bowl, type ExtraId, type Menu, type OrderDraft, type ServiceMode } from './types.ts';

/** build → finished (plated or boxed) → placed (server confirmed). Any edit drops back to build. */
export type Phase = 'build' | 'finished' | 'placed';

export interface PlacedOrder {
  id: string;
  total: number;
  currency: string;
  mode: ServiceMode;
  name: string;
  /** Server total differed from what the customer saw (menu changed meanwhile). */
  priceChanged?: boolean;
}

export type LastAdded = { kind: 'base' | 'extra' | 'drink' | 'mode'; id: string } | null;

/** One-time coach marks, like the reference's handwritten hints; each hides once the customer has done it. */
export interface Hints {
  leg: boolean;
  spoon: boolean;
  drag: boolean;
}

export interface OrderState {
  /** The bowl on screen. Rice-only (base null) until a chaofan is chosen. */
  current: Bowl;
  drinks: Record<string, number>;
  mode: ServiceMode;
  phase: Phase;
  placed: PlacedOrder | null;
  lastAdded: LastAdded;
  hintsDone: Hints;
  /** Bumped by "Start over" so the scene replays the rice warming up. */
  resetCount: number;

  setBase: (base: BaseId | null) => void;
  setExtra: (id: ExtraId, qty: number, max: number) => void;
  setDrink: (id: string, qty: number) => void;
  setMode: (mode: ServiceMode) => void;
  finish: () => void;
  markPlaced: (order: PlacedOrder) => void;
  doneHint: (hint: keyof Hints) => void;
  startOver: () => void;
  /** Drops selections the current menu can no longer price (e.g. a removed drink). */
  reconcile: (menu: Menu) => void;
}

const riceOnly = (): Bowl => ({ base: null, extras: emptyExtras() });
const clamp = (n: number, max: number) => Math.max(0, Math.min(max, Math.round(n)));

export const selectDraft = (s: Pick<OrderState, 'current' | 'drinks' | 'mode'>): OrderDraft => ({
  bowls: s.current.base ? [s.current] : [],
  drinks: Object.fromEntries(Object.entries(s.drinks).filter(([, q]) => q > 0)),
  mode: s.mode,
});

/** Edits after the bowl was finished re-open it; a placed order is frozen until "Start over". */
const editable = (s: OrderState) => s.phase !== 'placed';

export const useOrder = create<OrderState>()(
  persist(
    (set) => ({
      current: riceOnly(),
      drinks: {},
      mode: 'dine-in',
      phase: 'build',
      placed: null,
      lastAdded: null,
      hintsDone: { leg: false, spoon: false, drag: false },
      resetCount: 0,

      setBase: (base) =>
        set((s) => {
          if (!editable(s)) return s;
          // extras only make sense on a chaofan, so going back to plain rice clears them
          const current = base ? { ...s.current, base } : riceOnly();
          return { current, phase: 'build', lastAdded: base ? { kind: 'base', id: base } : null };
        }),
      setExtra: (id, qty, max) =>
        set((s) => {
          if (!editable(s) || !s.current.base) return s;
          const next = clamp(qty, max);
          const prev = s.current.extras[id];
          if (next === prev) return s;
          return {
            current: { ...s.current, extras: { ...s.current.extras, [id]: next } },
            phase: 'build',
            lastAdded: next > prev ? { kind: 'extra', id } : s.lastAdded,
          };
        }),
      setDrink: (id, qty) =>
        set((s) => {
          if (!editable(s)) return s;
          const next = clamp(qty, MAX_DRINK_QTY);
          const prev = s.drinks[id] ?? 0;
          return { drinks: { ...s.drinks, [id]: next }, phase: 'build', lastAdded: next > prev ? { kind: 'drink', id } : s.lastAdded };
        }),
      setMode: (mode) => set((s) => (editable(s) && s.mode !== mode ? { mode, phase: 'build', lastAdded: { kind: 'mode', id: mode } } : s)),
      finish: () => set((s) => (s.current.base && s.phase === 'build' ? { phase: 'finished' } : s)),
      markPlaced: (placed) => set({ placed, phase: 'placed' }),
      doneHint: (hint) => set((s) => (s.hintsDone[hint] ? s : { hintsDone: { ...s.hintsDone, [hint]: true } })),
      startOver: () => set((s) => ({ current: riceOnly(), drinks: {}, phase: 'build', placed: null, lastAdded: null, resetCount: s.resetCount + 1 })),
      reconcile: (menu) =>
        set((s) => {
          const drinks = Object.fromEntries(Object.entries(s.drinks).filter(([id, q]) => q > 0 && menu.drinks.some((d) => d.id === id && d.price !== null)));
          const extras = Object.fromEntries(menu.extras.map((e) => [e.id, clamp(s.current.extras[e.id] ?? 0, e.max)])) as Bowl['extras'];
          return { drinks, current: { base: s.current.base, extras } };
        }),
    }),
    {
      name: 'chaofan-order-v2',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({ current: s.current, drinks: s.drinks, mode: s.mode, phase: s.phase, placed: s.placed, hintsDone: s.hintsDone }),
    },
  ),
);
