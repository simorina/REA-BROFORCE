import { EXTRACTION_TIME, SHAKE_AMOUNT, SHAKE_TIME, TILE } from '../engine/constants';
import { getColumn, getRow } from '../engine/map';
import type { BlockKind, Projectile, Unit, UnitKind } from '../engine/types';
import type { Effect, World } from '../engine/world';
import { loopFrame, prisonerFrame, stripFrame, unitFrame } from './animation';
import type { Assets, SheetKey } from './assets';
import { VIEW_H, VIEW_W, followCamera, type Camera } from './camera';
import { clampBubbleLeft } from './layout';

const ENEMY_SHEETS: Record<Exclude<UnitKind, 'bro'>, SheetKey> = {
  mook: 'mook', mook_suicide: 'mook_suicide', mook_bazooka: 'mook_bazooka',
};
const BLOCK_SHEETS: Record<BlockKind, SheetKey> = {
  dirt: 'block_dirt', brick: 'block_brick', steel: 'block_steel', barrel: 'block_barrel',
};
const SKY = '#7fb2e5';

export class Renderer {
  readonly camera: Camera = { x: 0, y: 0 };
  private snapped = false;
  private shakeX = 0;
  private shakeY = 0;

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly assets: Assets,
    private readonly scale: number,
    private readonly playerSheet: SheetKey,
  ) {}

  render(w: World, dt: number): void {
    const target = w.state === 'extracting' ? w.flag : w.player;
    followCamera(this.camera, target, w.map, this.snapped ? dt : 1);
    this.snapped = true;
    w.cameraTop = this.camera.y + VIEW_H / 2;
    const shake = w.effects.reduce((s, e) => (e.kind === 'explosion' ? Math.max(s, 1 - e.age / SHAKE_TIME) : s), 0);
    this.shakeX = (Math.random() * 2 - 1) * SHAKE_AMOUNT * shake;
    this.shakeY = (Math.random() * 2 - 1) * SHAKE_AMOUNT * shake;
    const { ctx } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = SKY;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    this.drawBlocks(w);
    this.drawFlag(w);
    this.drawPrisoners(w);
    for (const e of w.enemies) this.drawUnit(e);
    const boarded = w.state === 'extracting' && w.extractionTime >= EXTRACTION_TIME / 2;
    if (!boarded) this.drawUnit(w.player);
    for (const p of w.projectiles) this.drawProjectile(p, w.time);
    for (const e of w.effects) this.drawEffect(e, w);
    if (w.state === 'extracting') this.drawHelicopter(w);
  }

  private sx(x: number): number {
    return (x - (this.camera.x + this.shakeX - VIEW_W / 2)) * this.scale;
  }

  private sy(y: number): number {
    return (this.camera.y + this.shakeY + VIEW_H / 2 - y) * this.scale;
  }

  /** Draws frame (col, row) of a sheet centred on world (x, y). */
  private sprite(key: SheetKey, col: number, row: number, x: number, y: number, flip = false, angle = 0): void {
    const info = this.assets.sheets[key];
    const w = info.frameW * this.scale;
    const h = info.frameH * this.scale;
    const { ctx } = this;
    ctx.save();
    ctx.translate(this.sx(x), this.sy(y));
    if (angle) ctx.rotate(angle);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(this.assets.images[key], col * info.frameW, row * info.frameH, info.frameW, info.frameH, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  private drawBlocks(w: World): void {
    const c0 = getColumn(this.camera.x - VIEW_W / 2) - 1;
    const c1 = getColumn(this.camera.x + VIEW_W / 2) + 1;
    const r0 = getRow(this.camera.y - VIEW_H / 2) - 1;
    const r1 = getRow(this.camera.y + VIEW_H / 2) + 1;
    for (let c = c0; c <= c1; c++) {
      for (let r = r0; r <= r1; r++) {
        const b = w.map.get(c, r);
        if (b) this.sprite(BLOCK_SHEETS[b.kind], 0, 0, c * TILE, r * TILE);
      }
    }
  }

  private drawUnit(u: Unit): void {
    if (u.kind === 'mook_suicide' && u.ai?.mode === 'exploded') return;
    const key = u.kind === 'bro' ? this.playerSheet : ENEMY_SHEETS[u.kind];
    const f = unitFrame(u);
    // SpriteSM offset: the 32x32 frame is centred offsetY above the feet.
    this.sprite(key, f.col, f.row, u.x, u.y + this.assets.sheets[key].offsetY, u.facing < 0);
  }

  private drawFlag(w: World): void {
    const pole = this.assets.sheets.flagpole;
    this.sprite('flagpole', 0, 0, w.flag.x, w.flag.y + pole.frameH / 2);
    this.sprite('flag', 0, 0, w.flag.x + 8, w.flag.y + pole.frameH - 8);
  }

  private drawPrisoners(w: World): void {
    for (const p of w.prisoners) {
      if (p.freed) continue;
      this.sprite('prisoner', prisonerFrame(w.time), 0, p.x, p.y + this.assets.sheets.prisoner.offsetY);
      this.sprite('cage', 0, 0, p.x, p.y + 16);
    }
  }

  private drawProjectile(p: Projectile, time: number): void {
    const angle = Math.atan2(-p.yI, Math.abs(p.xI)) * Math.sign(p.xI || 1);
    switch (p.kind) {
      case 'bullet':
        this.sprite('bullet', loopFrame(time, 0.05, this.assets.sheets.bullet.cols), 0, p.x, p.y, p.xI < 0);
        break;
      case 'rocket':
        this.sprite('rocket', 0, 0, p.x, p.y, p.xI < 0);
        break;
      case 'bomb':
        this.sprite('bomb', 0, 0, p.x, p.y, false, angle);
        break;
      case 'marker':
        this.sprite('marker', 0, 0, p.x, p.y + 4);
        break;
      case 'football':
        this.drawFootball(p, time);
        break;
    }
  }

  /** The football is our own art: a white ball with spinning black patches. */
  private drawFootball(p: Projectile, time: number): void {
    const { ctx } = this;
    const r = 3.5 * this.scale;
    ctx.save();
    ctx.translate(this.sx(p.x), this.sy(p.y));
    ctx.rotate(time * 12 * Math.sign(p.xI || 1));
    ctx.fillStyle = '#f4f1e8';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = this.scale;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.fillRect(-this.scale, -this.scale, this.scale * 2, this.scale * 2);
    ctx.fillRect(r * 0.5, -r * 0.6, this.scale, this.scale);
    ctx.fillRect(-r * 0.9, r * 0.3, this.scale, this.scale);
    ctx.restore();
  }

  private drawEffect(e: Effect, w: World): void {
    if (e.kind === 'speech') {
      this.drawSpeech(e.text ?? '', w.player.x, w.player.y + 36);
      return;
    }
    const key = e.kind === 'explosion' ? 'explosion' : 'explosion_small';
    this.sprite(key, stripFrame(e.age, e.duration, this.assets.sheets[key].cols), 0, e.x, e.y);
  }

  private drawSpeech(text: string, x: number, y: number): void {
    const { ctx } = this;
    const s = this.scale;
    ctx.save();
    ctx.font = `bold ${7 * s}px ui-monospace, Consolas, monospace`;
    const width = ctx.measureText(text).width + 8 * s;
    const height = 14 * s;
    const left = clampBubbleLeft(this.sx(x), width, ctx.canvas.width);
    const top = this.sy(y) - height;
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = s;
    ctx.beginPath();
    ctx.roundRect(left, top, width, height, 3 * s);
    ctx.moveTo(this.sx(x) - 3 * s, top + height);
    ctx.lineTo(this.sx(x), top + height + 5 * s);
    ctx.lineTo(this.sx(x) + 3 * s, top + height);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#000';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, left + 4 * s, top + height / 2);
    ctx.restore();
  }

  private drawHelicopter(w: World): void {
    const half = EXTRACTION_TIME / 2;
    const arrive = Math.min(1, w.extractionTime / half);
    const leave = Math.max(0, w.extractionTime - half);
    const x = w.flag.x - 220 * (1 - arrive);
    const y = w.flag.y + 48 + 72 * (1 - arrive) + leave * 120;
    this.sprite('helicopter', loopFrame(w.time, 0.03, this.assets.sheets.helicopter.cols), 0, x, y);
  }
}
