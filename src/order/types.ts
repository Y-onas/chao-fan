export type BaseId = 'chicken' | 'beef' | 'egg' | 'veggie';
export type ExtraId = 'chickenLeg' | 'egg' | 'sauce';
export type ServiceMode = 'dine-in' | 'takeaway';

export const BASE_IDS: readonly BaseId[] = ['chicken', 'beef', 'egg', 'veggie'];
export const EXTRA_IDS: readonly ExtraId[] = ['chickenLeg', 'egg', 'sauce'];

export interface MenuBase {
  id: BaseId;
  name: string;
  price: number;
  description: string;
}

export interface MenuExtra {
  id: ExtraId;
  name: string;
  price: number;
  max: number;
  description?: string;
}

export interface MenuDrink {
  id: string;
  name: string;
  /** null = the owner has not set a price yet; the drink cannot be ordered. */
  price: number | null;
  color: string;
  description?: string;
}

export interface Menu {
  currency: string;
  bases: MenuBase[];
  extras: MenuExtra[];
  packaging: { takeawayBox: number };
  drinks: MenuDrink[];
}

export type Extras = Record<ExtraId, number>;

export interface Bowl {
  base: BaseId | null;
  extras: Extras;
}

export interface OrderDraft {
  bowls: Bowl[];
  drinks: Record<string, number>;
  mode: ServiceMode;
}

export interface CustomerDetails {
  name: string;
  phone: string;
  table?: string;
  notes?: string;
}

export interface PriceLine {
  key: string;
  label: string;
  qty: number;
  unit: number;
  amount: number;
  /** Indented under the bowl it belongs to. */
  child?: boolean;
}

export interface PricedOrder {
  lines: PriceLine[];
  total: number;
  errors: string[];
}

export const emptyExtras = (): Extras => ({ chickenLeg: 0, egg: 0, sauce: 0 });
