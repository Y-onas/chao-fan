import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import { rng } from './surface.ts';

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!] as const;
}

function colorTex(c: HTMLCanvasElement) {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Smooth 2D value noise on a wrapping grid, enough for wood figure. */
function valueNoise(seed: number, cells: number) {
  const rand = rng(seed);
  const grid = Array.from({ length: cells * cells }, rand);
  const at = (x: number, y: number) => grid[(((y % cells) + cells) % cells) * cells + (((x % cells) + cells) % cells)];
  const s = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = s(x - xi);
    const fy = s(y - yi);
    const a = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * fx;
    const b = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * fx;
    return a + (b - a) * fy;
  };
}

/** Olive-wood serving board: honey base with wavy dark figure, like the reference's prep board. */
export function oliveWoodTexture() {
  const N = 1024;
  const [c, g] = canvas(N, N);
  const img = g.createImageData(N, N);
  const n1 = valueNoise(3, 8);
  const n2 = valueNoise(4, 32);
  const n3 = valueNoise(5, 128);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const u = x / N;
      const v = y / N;
      // long, gently waving grain lines (stretched along u) with a few darker olive figure bands
      const warp = n1(u * 3, v * 8) * 1.6 + n2(u * 8, v * 32) * 0.18;
      const fine = Math.sin((v * 70 + warp * 9) * Math.PI * 2) * 0.5 + 0.5;
      const broad = Math.sin((v * 6 + warp) * Math.PI * 2);
      const figure = Math.pow(Math.max(0, broad), 10) * 0.55;
      const fleck = (n3(u * 128, v * 128) - 0.5) * 0.06;
      const k = Math.min(1, figure + Math.pow(fine, 6) * 0.22 + fleck + 0.08);
      const i = (y * N + x) * 4;
      // honey (#c4925c) toward dark olive figure (#5c3a1e)
      img.data[i] = 196 - (196 - 92) * k;
      img.data[i + 1] = 146 - (146 - 58) * k;
      img.data[i + 2] = 92 - (92 - 30) * k;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return colorTex(c);
}

/** Round red order stamp, pressed onto the finished meal once the server confirms the order. */
export function stampTexture(orderId: string) {
  const [c, g] = canvas(512, 512);
  g.fillStyle = '#d42a2a';
  g.beginPath();
  g.arc(256, 256, 248, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(255,240,230,0.85)';
  g.lineWidth = 6;
  g.setLineDash([14, 10]);
  g.beginPath();
  g.arc(256, 256, 214, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = '#fff4ea';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = 'italic 76px "Instrument Serif", Georgia, serif';
  g.fillText('ChaoFan', 256, 190);
  g.font = '800 44px "Bricolage Grotesque", system-ui, sans-serif';
  g.fillText('CORNER', 256, 256);
  g.font = '600 38px "Bricolage Grotesque", system-ui, sans-serif';
  g.fillText(`Nº ${orderId}`, 256, 330);
  return colorTex(c);
}

/** Little kraft tag with the customer's name in handwriting. */
export function nameTagTexture(name: string) {
  const [c, g] = canvas(512, 256);
  g.fillStyle = '#f4e6cc';
  g.beginPath();
  g.roundRect(8, 8, 496, 240, 24);
  g.fill();
  g.fillStyle = '#d9c7a6';
  g.beginPath();
  g.arc(60, 128, 16, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#b8261f';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '600 92px Caveat, cursive';
  g.fillText(`for ${name}`.slice(0, 18), 284, 128, 400);
  return colorTex(c);
}


/** Fibre-flecked kraft board for the takeaway box. */
export function kraftTexture() {
  const [c, g] = canvas(512, 512);
  g.fillStyle = '#b98a57';
  g.fillRect(0, 0, 512, 512);
  const rand = rng(5);
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = rand() < 0.5 ? 'rgba(90,58,28,0.18)' : 'rgba(235,205,160,0.2)';
    g.fillRect(rand() * 512, rand() * 512, 1 + rand() * 6, 1);
  }
  const t = colorTex(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

export function softDotTexture() {
  const [c, g] = canvas(128, 128);
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new CanvasTexture(c);
}
