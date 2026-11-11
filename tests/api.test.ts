import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import menuJson from '../src/data/menu.default.json';
import { createApi } from '../server/api.ts';

let server: Server;
let base: string;
let dir: string;
const TOKEN = 'test-token';

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'chaofan-'));
  const api = createApi({ dataDir: dir, adminToken: TOKEN });
  server = createServer((req, res) => void api(req, res).then((h) => !h && res.writeHead(404).end()));
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  server.close();
  await rm(dir, { recursive: true, force: true });
});

const customer = { name: 'Abebe', phone: '+251 911 234567' };
const order = (body: unknown) => fetch(`${base}/api/orders`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const putMenu = (body: unknown, token = TOKEN) =>
  fetch(`${base}/api/menu`, { method: 'PUT', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify(body) });

describe('order API', () => {
  it('recomputes the total on the server and stores the order', async () => {
    const res = await order({
      draft: { bowls: [{ base: 'chicken', extras: { chickenLeg: 1, egg: 1, sauce: 1 } }], drinks: {}, mode: 'takeaway' },
      customer,
      total: 1, // a client-sent total is ignored
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.total).toBe(910);
    expect(body.id).toMatch(/^CF-/);
    const stored = (await readFile(path.join(dir, 'orders.jsonl'), 'utf8')).trim().split('\n');
    expect(JSON.parse(stored.at(-1)!).total).toBe(910);
  });

  it('rejects rice-only bowls, unpriced drinks and bad customer details', async () => {
    const rice = await order({ draft: { bowls: [{ base: null, extras: {} }], drinks: {}, mode: 'dine-in' }, customer });
    expect(rice.status).toBe(422);
    const drink = await order({ draft: { bowls: [{ base: 'egg', extras: {} }], drinks: { sprite: 1 }, mode: 'dine-in' }, customer });
    expect(drink.status).toBe(422);
    const phone = await order({ draft: { bowls: [{ base: 'egg', extras: {} }], drinks: {}, mode: 'dine-in' }, customer: { name: 'Abebe', phone: 'x' } });
    expect(phone.status).toBe(400);
  });

  it('lets an admin price a drink, after which it can be ordered', async () => {
    const menu = structuredClone(menuJson);
    menu.drinks[0].price = 60 as never;
    expect((await putMenu(menu, 'wrong')).status).toBe(401);
    expect((await putMenu(menu)).status).toBe(200);
    expect((await (await fetch(`${base}/api/menu`)).json()).drinks[0].price).toBe(60);
    const res = await order({ draft: { bowls: [{ base: 'veggie', extras: {} }], drinks: { 'coca-cola': 2 }, mode: 'dine-in' }, customer });
    expect((await res.json()).total).toBe(270 + 120);
  });

  it('rejects an invalid menu', async () => {
    const menu = structuredClone(menuJson);
    menu.bases[0].price = -5;
    expect((await putMenu(menu)).status).toBe(400);
  });
});
