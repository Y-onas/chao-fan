import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import { rng } from './surface.ts';

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!] as const;
}

/** White marble with warm veins, after the restaurant's table tops. */
export function marbleTexture() {
  const [c, g] = canvas(1024, 1024);
  g.fillStyle = '#d9d3cb';
  g.fillRect(0, 0, 1024, 1024);
  const rand = rng(11);
  for (let i = 0; i < 26; i++) {
    const warm = rand() < 0.35;
    g.strokeStyle = warm ? `rgba(176,112,52,${0.25 + rand() * 0.35})` : `rgba(120,118,122,${0.08 + rand() * 0.22})`;
    g.lineWidth = warm ? 1 + rand() * 2.5 : 2 + rand() * 9;
    g.filter = warm ? 'blur(0.6px)' : 'blur(3px)';
    let x = rand() * 1024;
    let y = rand() * 1024;
    g.beginPath();
    g.moveTo(x, y);
    const dir = rand() * Math.PI * 2;
    for (let s = 0; s < 40; s++) {
      x += Math.cos(dir + Math.sin(s * 0.4 + i) * 0.9) * 22;
      y += Math.sin(dir + Math.sin(s * 0.4 + i) * 0.9) * 22;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(3, 3);
  t.anisotropy = 8;
  return t;
}

export function stickerTexture(line2: string) {
  const [c, g] = canvas(512, 256);
  g.fillStyle = '#fff8ec';
  g.beginPath();
  g.roundRect(4, 4, 504, 248, 40);
  g.fill();
  g.fillStyle = '#e4572e';
  g.beginPath();
  g.arc(110, 128, 78, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#fff8ec';
  g.font = 'bold 64px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('CF', 110, 132);
  g.fillStyle = '#2b1a10';
  g.textAlign = 'left';
  g.font = 'bold 46px system-ui, sans-serif';
  g.fillText('ChaoFan', 210, 96);
  g.fillText('Corner', 210, 146);
  g.font = '28px system-ui, sans-serif';
  g.fillStyle = '#7a5a40';
  g.fillText(line2, 212, 200);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
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
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
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
