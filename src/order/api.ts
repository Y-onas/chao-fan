import { useEffect, useState } from 'react';
import defaultMenu from '../data/menu.default.json';
import type { CustomerDetails, Menu, OrderDraft } from './types.ts';

export type MenuStatus = 'loading' | 'live' | 'offline';

/** Loads the live menu; falls back to the bundled one (with ordering disabled) if the API is unreachable. */
export function useMenu() {
  const [menu, setMenu] = useState<Menu>(defaultMenu as Menu);
  const [status, setStatus] = useState<MenuStatus>('loading');
  useEffect(() => {
    let alive = true;
    fetch('/api/menu')
      .then((r) => (r.ok ? (r.json() as Promise<Menu>) : Promise.reject(new Error(String(r.status)))))
      .then((m) => alive && (setMenu(m), setStatus('live')))
      .catch(() => alive && setStatus('offline'));
    return () => void (alive = false);
  }, []);
  return { menu, status };
}

export interface SubmitResult {
  id: string;
  total: number;
  currency: string;
}

export async function submitOrder(draft: OrderDraft, customer: CustomerDetails): Promise<SubmitResult> {
  let res: Response;
  try {
    res = await fetch('/api/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ draft, customer }) });
  } catch {
    throw new Error('Could not reach the restaurant. Check your connection and try again — your order is saved.');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? 'The order could not be placed. Please try again.');
  return body as SubmitResult;
}
