import { VIEW_H, VIEW_W } from '../engine/camera';
import {
  BUBBLE_TIME, EXTRACTION_TIME, FLAG_RAISE_TIME, INVULNERABLE_FLASH, SHAKE_AMOUNT, SHAKE_TIME, TILE,
} from '../engine/constants';
import type { ParallaxDoodad } from '../engine/level';
import { getColumn, getRow } from '../engine/map';
import type { Tank } from '../engine/tank';
import type { BlockKind, Projectile, Unit, UnitKind } from '../engine/types';
import type { Effect, GameEvent, World } from '../engine/world';
import { loopFrame, prisonerFrame, tankHullFrame, turretFrame, unitFrame } from './animation';
import type { Assets, SheetKey } from './assets';
import { Effects } from './fx/controller';
import { particleFrame } from './fx/particles';
import { drawParticle, type PixelBuffer } from './fx/pixelShader';
import { puffRect } from './fx/puffs';
import { bubbleFrame, bubbleOffsetY, stillBubble } from './bubbles';
import type { RGBA } from './fxdata';
import { GrassWobble } from './grass';
import { clampBubbleLeft } from './layout';
import { parallaxCentre, placeBackground, type BgInstance } from './parallax';

const ENEMY_SHEETS: Record<Exclude<UnitKind, 'bro'>, SheetKey> = {
  mook: 'mook', mook_suicide: 'mook_suicide', mook_bazooka: 'mook_bazooka', mook_scout: 'mook_scout',
};
const BLOCK_SHEETS: Record<BlockKind, SheetKey> = {
  dirt: 'block_dirt', brick: 'block_brick', steel: 'block_steel', barrel: 'block_barrel',
};
const WHITE_TEXTURE = 'sprites/fx/white.png';
const quant = (v: number): number => Math.round(Math.min(1, Math.max(0, v)) * 31) / 31;

export class Renderer {
  private viewX = 0; // camera centre plus shake, for this frame
  private viewY = 0;
  readonly effects: Effects;
  private readonly background: BgInstance[];
  private readonly grass = new GrassWobble();
  private readonly tints = new Map<string, HTMLCanvasElement>();
  private shaderCanvas: HTMLCanvasElement | null = null; // the PixelExplosion layer, one pixel per world unit
  private shaderImage: ImageData | null = null;

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly assets: Assets,
    private readonly scale: number,
    private readonly playerSheet: () => SheetKey, // the current bro's
    parallax: readonly ParallaxDoodad[] = [],
    rng: () => number = Math.random,
  ) {
    this.effects = new Effects(assets.effects, rng, assets.shuriken);
    this.background = placeBackground(assets.background, parallax, rng);
  }

  private sheetOf = (kind: UnitKind): string => (kind === 'bro' ? this.playerSheet() : ENEMY_SHEETS[kind]);

  /** Feeds a step's events to the effects (EffectsController's call sites). */
  onEvent(e: GameEvent): void {
    this.effects.onEvent(e, this.sheetOf);
  }

  /** dt is 0 while paused: the frame is redrawn as it was, without shake. */
  render(w: World, dt: number): void {
    let shake = 0;
    if (dt > 0) {
      this.effects.step(dt, w.map, { x: w.camera.x, y: w.camera.y, halfW: VIEW_W / 2, halfH: VIEW_H / 2 }, w.time);
      for (const u of [w.player, ...w.enemies]) {
        this.effects.trackUnit(u, dt);
        this.grass.push(w.grass, u);
      }
      this.grass.step(dt);
      shake = w.effects.reduce((s, e) => (e.kind === 'shake' && e.age >= 0 ? Math.max(s, 1 - e.age / SHAKE_TIME) : s), 0);
    }
    this.viewX = w.camera.x + (Math.random() * 2 - 1) * SHAKE_AMOUNT * shake;
    this.viewY = w.camera.y + (Math.random() * 2 - 1) * SHAKE_AMOUNT * shake;
    const { ctx } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    this.drawBackground();
    this.drawRangePops(); // ExplosionRangePop sits at z 12: behind the blocks and units
    this.drawBlocks(w);
    // MookDoor: the dark inside (z 15), mooks walking out of it (z 14), then the frame (z 10) in front of them
    this.drawDoors(w, 'inside');
    for (const e of w.enemies) if (e.exitDoor) this.drawUnit(e, w.time);
    this.drawDoors(w, 'frame');
    this.drawGrass(w, 'backing');
    this.drawCheckpoints(w);
    this.drawFlag(w);
    this.drawPrisoners(w);
    for (const k of w.tanks) this.drawTank(k);
    for (const e of w.enemies) if (!e.exitDoor) this.drawUnit(e, w.time);
    const boarded = w.state === 'extracting' && w.extractionTime >= EXTRACTION_TIME / 2;
    if (!boarded && !w.driving) this.drawUnit(w.player, w.time);
    this.drawGibs();
    this.drawParticles();
    this.drawPuffs();
    this.drawShaderEffects(w.time);
    this.drawFlames();
    this.drawGrass(w, 'blades');
    for (const p of w.projectiles) this.drawProjectile(p, w.time);
    for (const e of w.effects) this.drawEffect(e, w);
    for (const e of w.enemies) this.drawBubble(e);
    if (w.state === 'extracting') this.drawHelicopter(w);
  }

  private sx(x: number): number {
    return (x - (this.viewX - VIEW_W / 2)) * this.scale;
  }

  private sy(y: number): number {
    return (this.viewY + VIEW_H / 2 - y) * this.scale;
  }

  /** An image multiplied by a colour (Unity's vertex colour on the particle and Puff shaders). */
  private tinted(file: string, color: RGBA): CanvasImageSource {
    const img = this.assets.files[file];
    if (color[0] >= 0.999 && color[1] >= 0.999 && color[2] >= 0.999) return img;
    const key = `${file}|${quant(color[0])}|${quant(color[1])}|${quant(color[2])}`;
    let c = this.tints.get(key);
    if (!c) {
      c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext('2d')!;
      g.drawImage(img, 0, 0);
      g.globalCompositeOperation = 'multiply';
      g.fillStyle = `rgb(${quant(color[0]) * 255}, ${quant(color[1]) * 255}, ${quant(color[2]) * 255})`;
      g.fillRect(0, 0, c.width, c.height);
      g.globalCompositeOperation = 'destination-in';
      g.drawImage(img, 0, 0);
      this.tints.set(key, c);
    }
    return c;
  }

  /** Draws a w x h world-unit rectangle of an image centred on (x, y), optionally flipped and rotated. */
  private quad(img: CanvasImageSource, rect: readonly number[], x: number, y: number, w: number, h: number, flip = 1,
    angleDeg = 0, alpha = 1): void {
    const { ctx, scale: s } = this;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.translate(this.sx(x), this.sy(y));
    if (angleDeg) ctx.rotate((-angleDeg * Math.PI) / 180);
    if (flip < 0) ctx.scale(-1, 1);
    ctx.drawImage(img, rect[0], rect[1], rect[2], rect[3], (-w / 2) * s, (-h / 2) * s, w * s, h * s);
    ctx.restore();
  }

  /** The Desert theme's sky, clouds and hills (ParallaxFollow). */
  private drawBackground(): void {
    const cam = { x: this.viewX, y: this.viewY };
    for (const b of this.background) {
      const img = this.assets.files[b.sprite.file];
      const c = parallaxCentre(b, cam);
      if (Math.abs(c.x - cam.x) > VIEW_W / 2 + b.sprite.w / 2 || Math.abs(c.y - cam.y) > VIEW_H / 2 + b.sprite.h / 2) continue;
      this.quad(img, [0, 0, img.width, img.height], c.x, c.y, b.sprite.w, b.sprite.h);
    }
  }

  /** Draws frame (col, row) of a sheet centred on world (x, y); `image` swaps in another texture of the same layout. */
  private sprite(key: SheetKey, col: number, row: number, x: number, y: number, flip = false, angle = 0,
    image: CanvasImageSource = this.assets.images[key]): void {
    const info = this.assets.sheets[key];
    const w = info.frameW * this.scale;
    const h = info.frameH * this.scale;
    const { ctx } = this;
    ctx.save();
    ctx.translate(this.sx(x), this.sy(y));
    if (angle) ctx.rotate(angle);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(image, col * info.frameW, row * info.frameH, info.frameW, info.frameH, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  /** DoodadMookDoor's inside ("Door Behind") or frame, with the destroyed materials once it has blown up. */
  private drawDoors(w: World, part: 'inside' | 'frame'): void {
    const fx = this.assets.effects.door;
    for (const d of w.doors) {
      if (Math.abs(d.x - this.viewX) > VIEW_W / 2 + 32) continue;
      const sp = part === 'inside' ? (d.wrecked ? fx.insideDestroyed : fx.inside) : d.wrecked ? fx.frameDestroyed : fx.frame;
      const img = this.assets.files[sp.file];
      this.quad(img, [0, 0, img.width, img.height], d.x + sp.offset[0], d.y + sp.offset[1], sp.w, sp.h);
    }
  }

  /** ExplosionRangePop: a white ring as big as the blast, for a frame or two. */
  private drawRangePops(): void {
    const def = this.assets.effects.rangePop;
    const img = this.assets.files[def.file];
    for (const r of this.effects.rangePops) {
      if (r.appear > 0) continue;
      this.quad(img, [r.col * def.rect[2], def.rect[1], def.rect[2], def.rect[3]], r.x + def.offset[0], r.y + def.offset[1], def.w, def.h);
    }
  }

  /**
   * The ParticleSystem effects (shader explosions, fire trails), shaded like Unlit/PixelExplosion into a
   * buffer of world pixels that is then scaled up onto the screen.
   */
  private drawShaderEffects(time: number): void {
    const list = this.effects.shuriken;
    if (list.length === 0) return;
    const width = VIEW_W + 2;
    const height = VIEW_H + 2;
    if (!this.shaderCanvas) {
      this.shaderCanvas = document.createElement('canvas');
      this.shaderCanvas.width = width;
      this.shaderCanvas.height = height;
      this.shaderImage = new ImageData(width, height);
    }
    const image = this.shaderImage as ImageData;
    image.data.fill(0);
    const left = Math.floor(this.viewX - VIEW_W / 2);
    const top = Math.ceil(this.viewY + VIEW_H / 2) + 1;
    const buf: PixelBuffer = { data: image.data, width, height, left, top };
    const textures = this.assets.shaderTextures;
    for (const fx of list) {
      for (const { p, mat } of fx.drawList()) drawParticle(buf, p, mat, textures[mat.mainTex], textures[mat.ramp], time);
    }
    const g = this.shaderCanvas.getContext('2d');
    if (!g) return;
    g.putImageData(image, 0, 0);
    const { ctx, scale: s } = this;
    ctx.drawImage(this.shaderCanvas, this.sx(left), this.sy(top), width * s, height * s);
  }

  /** FlickerFader flames: a burning mook's, and the door's fire when it blows up. */
  private drawFlames(): void {
    for (const f of this.effects.flames) {
      if (f.delay > 0 || f.index >= f.def.frames) continue;
      const img = this.assets.files[f.def.file];
      this.quad(img, [f.index * f.def.frameW, 0, f.def.frameW, f.def.frameH], f.x + f.def.offset[0], f.y + f.def.offset[1], f.def.w, f.def.h);
    }
  }

  private drawBlocks(w: World): void {
    const c0 = getColumn(this.viewX - VIEW_W / 2) - 1;
    const c1 = getColumn(this.viewX + VIEW_W / 2) + 1;
    const r0 = getRow(this.viewY - VIEW_H / 2) - 1;
    const r1 = getRow(this.viewY + VIEW_H / 2) + 1;
    const fx = this.assets.effects.blocks;
    for (let c = c0; c <= c1; c++) {
      for (let r = r0; r <= r1; r++) {
        const b = w.map.get(c, r);
        if (!b) continue;
        this.sprite(BLOCK_SHEETS[b.kind], 0, 0, c * TILE, r * TILE);
        // Block.Bloody: the block's blood spray on each face blood landed on (Desert Earth uses the brick's)
        const sides = this.effects.decals.get(b);
        if (!sides) continue;
        const sprays = Object.keys(fx[b.kind].blood).length > 0 ? fx[b.kind].blood : fx.brick.blood;
        for (const side of sides) {
          const spray = sprays[side];
          if (!spray) continue;
          const img = this.assets.files[spray.file];
          const a = (spray.angle * Math.PI) / 180;
          const ox = spray.offset[0] * Math.cos(a) - spray.offset[1] * Math.sin(a);
          const oy = spray.offset[0] * Math.sin(a) + spray.offset[1] * Math.cos(a);
          this.quad(img, [0, 0, img.width, img.height], c * TILE + ox, r * TILE + oy, spray.w, spray.h, 1, spray.angle);
        }
      }
    }
  }

  /** DoodadGrass: the backing behind units, the blades in front, bent by WobbleSprite. */
  private drawGrass(w: World, part: 'backing' | 'blades'): void {
    const g = this.assets.effects.grass;
    const { ctx, scale: s } = this;
    for (const doodad of w.grass) {
      if (doodad.destroyed || Math.abs(doodad.x - this.viewX) > VIEW_W / 2 + 16) continue;
      const cy = doodad.y + TILE / 2;
      const sprites = part === 'backing' ? [g.backing] : g.blades;
      sprites.forEach((sp, i) => {
        const img = this.assets.files[sp.file];
        const shear = this.grass.shear(doodad, part === 'backing' ? -1 : i) * sp.intensity;
        const x = doodad.x + sp.offset[0];
        const y = cy + sp.offset[1];
        ctx.save();
        ctx.translate(this.sx(x), this.sy(y));
        // SpriteBase: the top vertices move by shearAmount * width
        ctx.transform(1, 0, -(shear * sp.w) / sp.h, 1, 0, 0);
        ctx.drawImage(img, sp.rect[0], sp.rect[1], sp.rect[2], sp.rect[3], (-sp.w / 2) * s, (-sp.h / 2) * s, sp.w * s, sp.h * s);
        ctx.restore();
      });
    }
  }

  /** Flash brightness for a unit: InvulnerabilityFlash for the bro, a fuse warning for a suicide mook. */
  private brightness(u: Unit, time: number): number {
    if (u.invulnerable > 0) return (0.5 + Math.sin(time * INVULNERABLE_FLASH) * 0.23) / 0.5;
    const ai = u.ai;
    if (u.kind === 'mook_suicide' && ai && !ai.exploded && (ai.litFuse || u.dead)) {
      const left = u.dead ? ai.deathFuse : ai.suicideTimer;
      const period = Math.max(0.04, Math.min(0.25, left / 6));
      return Math.floor(time / period) % 2 === 0 ? 2.2 : 1;
    }
    return 1;
  }

  private drawUnit(u: Unit, time: number): void {
    if (u.gibbed) return;
    const key = u.kind === 'bro' ? this.playerSheet() : ENEMY_SHEETS[u.kind];
    const f = unitFrame(u);
    const b = this.brightness(u, time);
    if (b !== 1) this.ctx.filter = `brightness(${b.toFixed(2)})`;
    // ScoutMook: the disarmed material once it is anything but idle or suspicious
    const mental = u.ai?.mental;
    const disarmed = u.kind === 'mook_scout' && mental !== undefined && mental !== 'idle' && mental !== 'suspicious';
    const image = disarmed ? this.assets.files[this.assets.effects.scoutDisarmed] : undefined;
    // SpriteSM offset: the 32x32 frame is centred offsetY above the feet.
    this.sprite(key, f.col, f.row, u.x, u.y + this.assets.sheets[key].offsetY, u.facing < 0, 0, image);
    if (b !== 1) this.ctx.filter = 'none';
  }

  /** TankBroTank's hull with the turret on top (bobbing a pixel while it rolls), flashing in its death countdown. */
  private drawTank(k: Tank): void {
    const hull = tankHullFrame(k);
    const top = turretFrame(k.turret);
    const y = k.y + this.assets.sheets.tank_ru.offsetY;
    const bob = k.onGround && Math.abs(k.xI) > 1 && Math.floor(k.bob / 2) % 2 === 0 ? 1 : 0; // TankBroTank.AnimateRunning
    const flash = k.countdown >= 0 && k.countdown % 2 === 1;
    if (flash) this.ctx.filter = 'brightness(2.2)';
    this.sprite('tank_ru', hull.col, hull.row, k.x, y, k.facing < 0);
    this.sprite('turret_ru', top.col, top.row, k.x, y + bob, k.facing < 0);
    if (flash) this.ctx.filter = 'none';
  }

  private drawGibs(): void {
    for (const g of this.effects.gibs) {
      if (g.w <= 0 || g.h <= 0) continue;
      const img = this.assets.images[g.sheet as SheetKey] ?? this.assets.files[g.sheet];
      if (img) this.quad(img, g.def.rect, g.x, g.y, g.w, g.h, g.flip, g.r);
    }
  }

  private drawParticles(): void {
    const { ctx, scale: s } = this;
    for (const p of this.effects.particles.list) {
      const size = p.size * s;
      if (p.def.texture === WHITE_TEXTURE) {
        ctx.globalAlpha = Math.max(0, Math.min(1, p.color[3]));
        ctx.fillStyle = `rgb(${p.color[0] * 255}, ${p.color[1] * 255}, ${p.color[2] * 255})`;
        ctx.fillRect(Math.round(this.sx(p.x) - size / 2), Math.round(this.sy(p.y) - size / 2), Math.max(1, size), Math.max(1, size));
        continue;
      }
      const img = this.tinted(p.def.texture, p.color);
      const base = this.assets.files[p.def.texture];
      const [tx, ty] = p.def.tiles;
      const tw = base.width / tx;
      const th = base.height / ty;
      const f = particleFrame(p);
      this.quad(img, [(f % tx) * tw, Math.floor(f / tx) * th, tw, th], p.x, p.y, p.size, p.size, 1, 0, p.color[3]);
    }
    ctx.globalAlpha = 1;
  }

  private drawPuffs(): void {
    for (const p of this.effects.puffs) {
      if (p.delay > 0) continue;
      const img = this.tinted(p.def.file, p.color);
      const bx = p.follow ? p.follow.x : 0;
      const by = p.follow ? p.follow.y : 0;
      this.quad(img, puffRect(p), bx + p.x + p.def.offset[0] * p.flip, by + p.y + p.def.offset[1], p.def.w, p.def.h, p.flip, 0, p.color[3]);
    }
  }

  /** A mook's ReactionBubble: the original "!" / "?" animation, popping up then folding away. */
  private drawBubble(u: Unit): void {
    const ai = u.ai;
    if (ai && ai.rambro > 0 && !u.dead) {
      // the scout's Rambro face: a still bubble that tweens in, holds, and rises away
      const def = this.assets.effects.bubbles.rambro;
      const b = stillBubble(def, ai.rambroLife - ai.rambro, ai.rambroLife);
      const img = this.assets.files[def.file];
      if (b) this.quad(img, def.rect, u.x + def.pos[0], u.y + def.pos[1] + b.offsetY, def.w, def.h, 1, 0, b.alpha);
    }
    const kind = ai?.bubble;
    if (!kind || u.dead) return;
    const def = this.assets.effects.bubbles[kind];
    const age = BUBBLE_TIME - (u.ai?.bubbleTime ?? 0);
    const frame = bubbleFrame(def, age);
    if (frame < 0) return;
    const img = this.assets.files[def.file];
    this.quad(img, [frame * def.rect[2], def.rect[1], def.rect[2], def.rect[3]], u.x + def.pos[0],
      u.y + def.pos[1] + bubbleOffsetY(def, age), def.w, def.h);
  }

  private drawCheckpoints(w: World): void {
    const pole = this.assets.sheets.flagpole;
    for (const cp of w.checkpoints) {
      this.sprite('flagpole', 0, 0, cp.x, cp.y + pole.frameH / 2);
      if (!cp.activated) continue;
      const k = Math.min(1, (w.time - cp.raisedAt) / FLAG_RAISE_TIME);
      this.sprite('flag', loopFrame(w.time, 0.08, this.assets.sheets.flag.cols), 0, cp.x + 8, cp.y + 8 + (pole.frameH - 16) * k);
    }
  }

  private drawFlag(w: World): void {
    const pole = this.assets.sheets.flagpole;
    this.sprite('flagpole', 0, 0, w.flag.x, w.flag.y + pole.frameH / 2);
    this.sprite('flag', loopFrame(w.time, 0.08, this.assets.sheets.flag.cols), 0, w.flag.x + 8, w.flag.y + pole.frameH - 8);
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
      case 'shell':
        this.sprite('tank_shell', 0, 0, p.x, p.y, false, angle);
        break;
      case 'bigRocket':
        this.sprite('tank_rocket', loopFrame(time, 0.05, this.assets.sheets.tank_rocket.cols), 0, p.x, p.y, p.xI < 0);
        break;
      case 'body':
        // the grabbed mook in its falling pose, spinning
        this.sprite(ENEMY_SHEETS[p.body ?? 'mook'], 4, 0, p.x, p.y, p.xI < 0, time * 14 * Math.sign(p.xI || 1));
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
    if (e.kind === 'speech') this.drawSpeech(e.text ?? '', w.player.x, w.player.y + 36);
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
