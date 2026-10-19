import type { LevelTheme } from '../engine/level';
import { helicopterFrame } from './animation';

/** The world map's own art (ours, not Broforce's globe): sea, land, the route, the missions and the helicopter. */
export const MAP_W = 400;
export const MAP_H = 225;

type Spot = { x: number; y: number };

export interface MapMission {
  spot: Spot; // fractions of the map
  theme: LevelTheme;
  missionId: string;
  name: string;
  state: 'done' | 'next' | 'locked';
}

export interface MapScene {
  missions: MapMission[];
  selected: number;
  heli: { x: number; y: number; facing: 1 | -1; landed: boolean };
}

export interface HeliArt {
  image: CanvasImageSource;
  frameW: number;
  frameH: number;
}

/** A wobbly closed outline around (cx, cy), the same for the same seed; every point within 0.75-1.25 of the radii. */
export function blobPoints(cx: number, cy: number, rx: number, ry: number, seed: number, n = 48): Spot[] {
  const out: Spot[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 1 + 0.12 * Math.sin(3 * a + seed) + 0.08 * Math.sin(5 * a + seed * 2) + 0.05 * Math.sin(9 * a + seed * 3);
    out.push({ x: cx + rx * r * Math.cos(a), y: cy + ry * r * Math.sin(a) });
  }
  return out;
}

const px = (s: Spot): Spot => ({ x: s.x * MAP_W, y: s.y * MAP_H });

function shape(ctx: CanvasRenderingContext2D, pts: Spot[], fill: string | CanvasGradient, stroke?: string): void {
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function sea(ctx: CanvasRenderingContext2D, time: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, MAP_H);
  g.addColorStop(0, '#0d2a44');
  g.addColorStop(1, '#174a6e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, MAP_W, MAP_H);
  // a military grid, and the swell drifting by
  ctx.strokeStyle = 'rgba(160, 210, 255, 0.08)';
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= MAP_W; x += 25) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, MAP_H);
    ctx.stroke();
  }
  for (let y = 0; y <= MAP_H; y += 25) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(MAP_W, y);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(200, 235, 255, 0.18)';
  ctx.lineWidth = 0.75;
  for (let i = 0; i < 26; i++) {
    const x = ((i * 67 + time * 6) % (MAP_W + 20)) - 10;
    const y = (i * 41) % MAP_H;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 5, y);
    ctx.stroke();
  }
}

/** The mainland the missions share, and Epstein's island off its coast. */
function land(ctx: CanvasRenderingContext2D, missions: MapMission[], time: number): void {
  // A large continent spanning the first 6 missions
  const main = blobPoints(175, 108, 160, 78, 1.7);
  const g = ctx.createLinearGradient(20, 0, 340, 0);
  g.addColorStop(0, '#d9b46a');
  g.addColorStop(0.20, '#c9a85e');
  g.addColorStop(0.35, '#4c7a32');
  g.addColorStop(0.50, '#557e3a');
  g.addColorStop(0.65, '#4c7a32');
  g.addColorStop(0.80, '#c9a85e');
  g.addColorStop(1, '#2f5e26');
  shape(ctx, main, g, '#e8d39a');

  for (const m of missions) {
    const c = px(m.spot);
    if (m.theme === 'desert') {
      // dunes
      ctx.strokeStyle = 'rgba(140, 100, 40, 0.5)';
      ctx.lineWidth = 1;
      for (const [dx, dy] of [[-30, -14], [-12, 16], [14, -22], [-40, 10], [22, 12]]) {
        ctx.beginPath();
        ctx.arc(c.x + dx, c.y + dy, 7, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      }
    } else if (m.theme === 'burning') {
      // the jungle on fire: flickering flames and smoke
      for (let i = 0; i < 9; i++) {
        const a = i * 2.4;
        const fx = c.x + Math.cos(a) * (10 + (i % 3) * 9);
        const fy = c.y + Math.sin(a) * (6 + (i % 4) * 5);
        const flick = 0.5 + 0.5 * Math.sin(time * 9 + i * 1.7);
        ctx.fillStyle = `rgba(255, ${Math.round(90 + flick * 110)}, 30, ${0.55 + flick * 0.4})`;
        ctx.fillRect(fx - 1.5, fy - 2 - flick * 2, 3, 3 + flick * 2);
        const rise = (time * 8 + i * 7) % 24;
        ctx.fillStyle = `rgba(60, 50, 50, ${0.35 * (1 - rise / 24)})`;
        ctx.beginPath();
        ctx.arc(fx + rise * 0.3, fy - 4 - rise, 2 + rise * 0.12, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (m.missionId === 'island') {
      // the island: a beach around the jungle, the temple on its hill
      shape(ctx, blobPoints(c.x + 2, c.y - 2, 38, 26, 4.2), '#e3cf8f', '#f3e6b8');
      shape(ctx, blobPoints(c.x + 2, c.y - 3, 30, 19, 4.9), '#2f7a35');
      ctx.fillStyle = '#eef3f8';
      ctx.fillRect(c.x + 10, c.y - 13, 9, 4);
      ctx.fillStyle = '#3b6fc4';
      ctx.fillRect(c.x + 12, c.y - 16, 5, 3);
    } else if (m.missionId === 'harbor') {
      // harbor: docks and cranes
      ctx.strokeStyle = 'rgba(80, 70, 60, 0.7)';
      ctx.lineWidth = 1.5;
      // pier lines
      for (const dy of [-8, 0, 8]) {
        ctx.beginPath();
        ctx.moveTo(c.x - 14, c.y + dy);
        ctx.lineTo(c.x + 14, c.y + dy);
        ctx.stroke();
      }
      // crane
      ctx.strokeStyle = 'rgba(100, 90, 80, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(c.x + 6, c.y + 10);
      ctx.lineTo(c.x + 6, c.y - 16);
      ctx.lineTo(c.x + 18, c.y - 16);
      ctx.stroke();
      // containers
      for (const [dx, dy, col] of [[-10, 2, '#c84'], [-6, 2, '#48c'], [-10, -4, '#4a6'], [-6, -4, '#ca4']] as const) {
        ctx.fillStyle = col;
        ctx.fillRect(c.x + dx, c.y + dy, 6, 4);
      }
    } else if (m.missionId === 'tower') {
      // skyscraper silhouette
      ctx.fillStyle = 'rgba(50, 55, 70, 0.85)';
      ctx.fillRect(c.x - 5, c.y - 22, 12, 26);
      // windows
      ctx.fillStyle = 'rgba(255, 230, 120, 0.7)';
      const flicker = Math.sin(time * 2) * 0.3 + 0.7;
      for (let wy = -18; wy < 2; wy += 5) {
        for (let wx = -3; wx < 5; wx += 4) {
          ctx.globalAlpha = flicker + Math.sin(time * 3 + wx + wy) * 0.2;
          ctx.fillRect(c.x + wx, c.y + wy, 2, 3);
        }
      }
      ctx.globalAlpha = 1;
      // antenna
      ctx.strokeStyle = 'rgba(200, 200, 200, 0.6)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(c.x + 1, c.y - 22);
      ctx.lineTo(c.x + 1, c.y - 28);
      ctx.stroke();
      // blinking light
      const blink = Math.sin(time * 4) > 0.3 ? 1 : 0.2;
      ctx.fillStyle = `rgba(255, 40, 40, ${blink})`;
      ctx.beginPath();
      ctx.arc(c.x + 1, c.y - 28, 1.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (m.missionId === 'airstrip') {
      // runway markings
      ctx.strokeStyle = 'rgba(200, 200, 200, 0.6)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.moveTo(c.x - 20, c.y);
      ctx.lineTo(c.x + 20, c.y);
      ctx.stroke();
      ctx.setLineDash([]);
      // runway edge lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(c.x - 20, c.y - 4);
      ctx.lineTo(c.x + 20, c.y - 4);
      ctx.moveTo(c.x - 20, c.y + 4);
      ctx.lineTo(c.x + 20, c.y + 4);
      ctx.stroke();
      // hangar
      ctx.fillStyle = 'rgba(80, 80, 90, 0.7)';
      ctx.beginPath();
      ctx.moveTo(c.x - 8, c.y - 8);
      ctx.lineTo(c.x + 8, c.y - 8);
      ctx.lineTo(c.x + 10, c.y - 3);
      ctx.lineTo(c.x - 10, c.y - 3);
      ctx.closePath();
      ctx.fill();
    } else if (m.missionId === 'temple') {
      // cave entrance with torch glow
      ctx.fillStyle = 'rgba(30, 25, 20, 0.8)';
      ctx.beginPath();
      ctx.arc(c.x, c.y, 10, Math.PI * 0.85, Math.PI * 0.15, true);
      ctx.lineTo(c.x + 9, c.y + 5);
      ctx.lineTo(c.x - 9, c.y + 5);
      ctx.closePath();
      ctx.fill();
      // torch glow
      const glow = 0.5 + 0.5 * Math.sin(time * 6);
      ctx.fillStyle = `rgba(255, 140, 30, ${0.3 + glow * 0.3})`;
      ctx.beginPath();
      ctx.arc(c.x - 7, c.y - 2, 3 + glow * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(c.x + 7, c.y - 2, 3 + glow * 2, 0, Math.PI * 2);
      ctx.fill();
      // temple pillars
      ctx.fillStyle = 'rgba(200, 190, 170, 0.7)';
      ctx.fillRect(c.x - 8, c.y - 6, 2, 8);
      ctx.fillRect(c.x + 6, c.y - 6, 2, 8);
    } else {
      // fallback: generic jungle spot
      shape(ctx, blobPoints(c.x, c.y, 16, 12, 3.5), '#3f7a35');
    }
  }
}

/** The route from mission to mission: solid where the bro has been, dashed ahead. */
function route(ctx: CanvasRenderingContext2D, missions: MapMission[]): void {
  for (let i = 1; i < missions.length; i++) {
    const a = px(missions[i - 1].spot);
    const b = px(missions[i].spot);
    const flown = missions[i].state !== 'locked';
    ctx.setLineDash(flown ? [] : [3, 3]);
    ctx.strokeStyle = flown ? 'rgba(255, 214, 90, 0.9)' : 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo((a.x + b.x) / 2, Math.min(a.y, b.y) - 22, b.x, b.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function markers(ctx: CanvasRenderingContext2D, scene: MapScene, time: number): void {
  scene.missions.forEach((m, i) => {
    const c = px(m.spot);
    const selected = i === scene.selected;
    if (selected) {
      const pulse = (time * 1.4) % 1;
      ctx.strokeStyle = `rgba(255, 60, 40, ${1 - pulse})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 5 + pulse * 10, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = m.state === 'done' ? '#3fbf4f' : m.state === 'next' ? '#e8402a' : '#7d8794';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (m.state === 'done') {
      // a planted flag
      ctx.fillStyle = '#ddd';
      ctx.fillRect(c.x - 0.5, c.y - 13, 1, 10);
      ctx.fillStyle = '#c62828';
      ctx.fillRect(c.x + 0.5, c.y - 13, 6, 4);
    }
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const label = `${i + 1}. ${m.name}`;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    const w = ctx.measureText(label).width + 6;
    ctx.fillRect(c.x - w / 2, c.y + 7, w, 10);
    ctx.fillStyle = selected ? '#ffd65a' : m.state === 'locked' ? '#aab' : '#fff';
    ctx.fillText(label, c.x, c.y + 8.5);
  });
}

/** Broforce's helicopter on its idle frame for the way it flies, its rotor a blur above, bobbing while it waits. */
function helicopter(ctx: CanvasRenderingContext2D, scene: MapScene, art: HeliArt | null, time: number): void {
  const h = scene.heli;
  const c = px(h);
  const bob = h.landed ? Math.sin(time * 3) * 1.2 : 0;
  const w = art ? art.frameW / 2 : 48;
  const ht = art ? art.frameH / 2 : 32;
  const x = c.x;
  const y = c.y - 20 + bob;
  ctx.save();
  ctx.translate(x, y);
  if (art) ctx.drawImage(art.image, helicopterFrame(h.facing) * art.frameW, 0, art.frameW, art.frameH, -w / 2, -ht / 2, w, ht);
  // the rotor, spinning
  const span = 20 + Math.abs(Math.sin(time * 40)) * 8;
  ctx.fillStyle = 'rgba(40, 40, 40, 0.55)';
  ctx.fillRect(-span / 2 - 2, -ht / 2 + 4, span, 1.5);
  ctx.restore();
}

export function drawWorldMap(ctx: CanvasRenderingContext2D, scale: number, scene: MapScene, art: HeliArt | null, time: number): void {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingEnabled = false;
  sea(ctx, time);
  land(ctx, scene.missions, time);
  route(ctx, scene.missions);
  markers(ctx, scene, time);
  helicopter(ctx, scene, art, time);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
