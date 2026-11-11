# ChaoFan Corner

Online ordering for ChaoFan Corner: pick a chaofan, add extras and drinks, choose dine-in or
takeaway, and place the order. A 3D plate updates as you build the bowl (with a 2D photo view
for devices without WebGL or when "Simple view" is chosen).

Stack: React 18 + TypeScript + Vite, Three.js via React Three Fiber, Zustand, and a small
dependency-free Node HTTP server for the order API.

## Run

```sh
npm install
npm run dev          # http://localhost:5173, admin token "dev-admin"
npm test             # pricing + API tests
npm run test:e2e     # browser checks (needs a Chromium for playwright-core)
npm run build && ADMIN_TOKEN=... npm start   # production server on $PORT (default 3000)
```

`npm start` runs TypeScript directly, so it needs Node 22.18+ (or 23.6+).

## Menu and prices

Defaults live in `src/data/menu.default.json`: Chicken 500, Beef 450, Egg 350, Veggie 270 ETB;
chicken leg +280, fried egg +40, house sauce +50, takeaway box +40 per bowl. Rice on its own is
not orderable. **Drink prices start unset** and drinks can't be ordered until the owner sets
them at `/#/admin`. The server re-prices every order, so totals sent by the browser are ignored.

## Production settings

| Variable | Purpose |
| --- | --- |
| `ADMIN_TOKEN` | Required to use `/#/admin` (menu editing, recent orders). Admin is disabled without it. |
| `DATA_DIR` | Where orders (`orders.jsonl`) and menu edits are stored. Defaults to `./data`; point it at persistent storage or data is lost on redeploy. |
| `PORT` | HTTP port (default 3000). |

## Visual assets

See [ASSETS.md](ASSETS.md) for which visuals come from the restaurant's photos, which are
procedural stand-ins, and which production assets are still needed.
