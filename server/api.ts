import { randomBytes, timingSafeEqual } from 'node:crypto';
import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import defaultMenu from '../src/data/menu.default.json' with { type: 'json' };
import { MAX_BOWLS, priceOrder } from '../src/order/pricing.ts';
import { BASE_IDS, EXTRA_IDS, type Bowl, type CustomerDetails, type Menu, type OrderDraft } from '../src/order/types.ts';

export interface ApiOptions {
  dataDir: string;
  /** When unset, admin endpoints refuse every request. */
  adminToken?: string;
}

export interface StoredOrder {
  id: string;
  createdAt: string;
  draft: OrderDraft;
  customer: CustomerDetails;
  lines: ReturnType<typeof priceOrder>['lines'];
  total: number;
  currency: string;
}

const MAX_BODY = 64 * 1024;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isPrice = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 1_000_000;
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function validateMenu(input: unknown): { menu?: Menu; error?: string } {
  if (!isObj(input)) return { error: 'Menu must be an object.' };
  const { bases, extras, packaging, drinks } = input;
  if (!Array.isArray(bases) || !Array.isArray(extras) || !Array.isArray(drinks) || !isObj(packaging)) return { error: 'Menu is missing sections.' };
  for (const id of BASE_IDS) {
    const b = bases.find((x) => isObj(x) && x.id === id);
    if (!isObj(b) || !isPrice(b.price) || typeof b.name !== 'string' || !b.name.trim()) return { error: `Base "${id}" needs a name and a whole-number price.` };
  }
  for (const id of EXTRA_IDS) {
    const e = extras.find((x) => isObj(x) && x.id === id);
    if (!isObj(e) || !isPrice(e.price) || typeof e.max !== 'number' || !Number.isInteger(e.max) || e.max < 1 || e.max > 5) return { error: `Extra "${id}" needs a price and a max of 1–5.` };
  }
  if (!isPrice(packaging.takeawayBox)) return { error: 'Takeaway box needs a whole-number price.' };
  const seen = new Set<string>();
  for (const d of drinks) {
    if (!isObj(d) || typeof d.id !== 'string' || !/^[a-z0-9-]{1,40}$/.test(d.id) || seen.has(d.id)) return { error: 'Each drink needs a unique id (lowercase letters, digits, dashes).' };
    seen.add(d.id);
    if (typeof d.name !== 'string' || !d.name.trim()) return { error: `Drink "${d.id}" needs a name.` };
    if (d.price !== null && !isPrice(d.price)) return { error: `${d.name}: price must be a whole number or empty.` };
    if (typeof d.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(d.color)) return { error: `${d.name}: colour must look like #aabbcc.` };
  }
  const menu: Menu = {
    currency: 'ETB',
    bases: BASE_IDS.map((id) => {
      const b = bases.find((x) => isObj(x) && x.id === id) as Record<string, unknown>;
      return { id, name: str(b.name, 60), price: b.price as number, description: str(b.description, 200) };
    }),
    extras: EXTRA_IDS.map((id) => {
      const e = extras.find((x) => isObj(x) && x.id === id) as Record<string, unknown>;
      return { id, name: str(e.name, 60) || id, price: e.price as number, max: e.max as number, description: str(e.description, 200) };
    }),
    packaging: { takeawayBox: packaging.takeawayBox as number },
    drinks: drinks.map((d) => {
      const r = d as Record<string, unknown>;
      return { id: r.id as string, name: str(r.name, 60), price: r.price as number | null, color: r.color as string, description: str(r.description, 200) };
    }),
  };
  return { menu };
}

/** Normalises untrusted order JSON into a draft; pricing then decides validity. */
export function parseOrder(input: unknown): { draft?: OrderDraft; customer?: CustomerDetails; error?: string } {
  if (!isObj(input) || !isObj(input.draft) || !isObj(input.customer)) return { error: 'Malformed order.' };
  const { bowls, drinks, mode } = input.draft;
  if (mode !== 'dine-in' && mode !== 'takeaway') return { error: 'Choose dine-in or takeaway.' };
  if (!Array.isArray(bowls) || bowls.length === 0 || bowls.length > MAX_BOWLS) return { error: 'Order must contain 1–20 bowls.' };
  if (!isObj(drinks)) return { error: 'Malformed drinks.' };
  const parsedBowls: Bowl[] = [];
  for (const b of bowls) {
    if (!isObj(b) || !isObj(b.extras)) return { error: 'Malformed bowl.' };
    const base = BASE_IDS.find((id) => id === b.base) ?? null;
    const extras = { chickenLeg: 0, egg: 0, sauce: 0 };
    for (const id of EXTRA_IDS) {
      const q = b.extras[id] ?? 0;
      if (typeof q !== 'number') return { error: 'Malformed extras.' };
      extras[id] = q;
    }
    parsedBowls.push({ base, extras });
  }
  const parsedDrinks: Record<string, number> = {};
  for (const [id, q] of Object.entries(drinks)) {
    if (typeof q !== 'number') return { error: 'Malformed drinks.' };
    parsedDrinks[id.slice(0, 40)] = q;
  }
  const c = input.customer;
  const customer: CustomerDetails = { name: str(c.name, 60), phone: str(c.phone, 20), table: str(c.table, 10) || undefined, notes: str(c.notes, 300) || undefined };
  if (customer.name.length < 2) return { error: 'Please enter your name.' };
  if (!/^\+?[0-9 ]{7,16}$/.test(customer.phone)) return { error: 'Please enter a valid phone number.' };
  return { draft: { bowls: parsedBowls, drinks: parsedDrinks, mode }, customer };
}

function tokenOk(expected: string | undefined, header: string | undefined) {
  if (!expected || !header?.startsWith('Bearer ')) return false;
  const a = Buffer.from(header.slice(7));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new Error('too large');
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

export function createApi(opts: ApiOptions) {
  const menuFile = path.join(opts.dataDir, 'menu.json');
  const ordersFile = path.join(opts.dataDir, 'orders.jsonl');

  async function loadMenu(): Promise<Menu> {
    try {
      const { menu } = validateMenu(JSON.parse(await readFile(menuFile, 'utf8')));
      if (menu) return menu;
    } catch {
      // no saved menu yet
    }
    return defaultMenu as Menu;
  }

  async function saveMenu(menu: Menu) {
    await mkdir(opts.dataDir, { recursive: true });
    const tmp = `${menuFile}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(menu, null, 2));
    await rename(tmp, menuFile);
  }

  async function listOrders(): Promise<StoredOrder[]> {
    try {
      const text = await readFile(ordersFile, 'utf8');
      return text.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l) as StoredOrder).slice(-50).reverse();
    } catch {
      return [];
    }
  }

  /** Returns false when the request is not an /api route so callers can fall through. */
  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = new URL(req.url ?? '/', 'http://local');
    if (!url.pathname.startsWith('/api/')) return false;
    const route = `${req.method} ${url.pathname}`;
    try {
      if (route === 'GET /api/menu') return send(res, 200, await loadMenu()), true;

      if (route === 'PUT /api/menu') {
        if (!opts.adminToken) return send(res, 503, { error: 'Admin is disabled: set ADMIN_TOKEN on the server.' }), true;
        if (!tokenOk(opts.adminToken, req.headers.authorization)) return send(res, 401, { error: 'Wrong admin token.' }), true;
        const { menu, error } = validateMenu(await readJson(req));
        if (!menu) return send(res, 400, { error }), true;
        await saveMenu(menu);
        return send(res, 200, menu), true;
      }

      if (route === 'GET /api/orders') {
        if (!opts.adminToken) return send(res, 503, { error: 'Admin is disabled: set ADMIN_TOKEN on the server.' }), true;
        if (!tokenOk(opts.adminToken, req.headers.authorization)) return send(res, 401, { error: 'Wrong admin token.' }), true;
        return send(res, 200, await listOrders()), true;
      }

      if (route === 'POST /api/orders') {
        const { draft, customer, error } = parseOrder(await readJson(req));
        if (!draft || !customer) return send(res, 400, { error }), true;
        const menu = await loadMenu();
        const priced = priceOrder(draft, menu);
        if (priced.errors.length) return send(res, 422, { error: priced.errors[0], errors: priced.errors }), true;
        const order: StoredOrder = {
          id: `CF-${Date.now().toString(36).slice(-4).toUpperCase()}${randomBytes(2).toString('hex').toUpperCase()}`,
          createdAt: new Date().toISOString(),
          draft,
          customer,
          lines: priced.lines,
          total: priced.total,
          currency: menu.currency,
        };
        await mkdir(opts.dataDir, { recursive: true });
        await appendFile(ordersFile, JSON.stringify(order) + '\n');
        return send(res, 201, order), true;
      }

      return send(res, 404, { error: 'Not found' }), true;
    } catch (err) {
      const msg = err instanceof SyntaxError ? 'Invalid JSON.' : err instanceof Error && err.message === 'too large' ? 'Request too large.' : 'Server error.';
      return send(res, msg === 'Server error.' ? 500 : 400, { error: msg }), true;
    }
  };
}
