import type { Grass } from '../engine/world';
import type { Unit } from '../engine/types';

interface Wobble {
  top: number; // WobbleSprite.topXOffset
  windXI: number;
  ignore: number;
}

const MAX_WIND = 100; // WobbleSprite.maxWindXi

/** WobbleSprite: units pushing through long grass set it swinging like a damped spring. */
export class GrassWobble {
  private readonly states = new Map<Grass, Wobble>();

  private state(g: Grass): Wobble {
    let s = this.states.get(g);
    if (!s) this.states.set(g, (s = { top: 0, windXI: 0, ignore: 0 }));
    return s;
  }

  /** WobbleSprite.UpdateWindXI(unit) for every tuft the unit is in. */
  push(grass: readonly Grass[], u: Unit): void {
    for (const g of grass) {
      if (g.destroyed || Math.abs(u.x - g.x) > 16 || u.y < g.y - 16 || u.y > g.y + 32) continue;
      const s = this.state(g);
      if (Math.abs(u.xI) > Math.abs(s.windXI) && (s.ignore <= 0 || Math.abs(s.windXI) < 10)) {
        s.ignore = 0.3;
        s.windXI = Math.max(-MAX_WIND, Math.min(MAX_WIND, u.xI));
      }
    }
  }

  step(t: number): void {
    for (const s of this.states.values()) {
      if (s.ignore > 0) s.ignore -= t;
      s.windXI -= s.top * t * 100;
      const before = s.top;
      s.top += s.windXI * t;
      if (Math.sign(before) !== Math.sign(s.top)) {
        s.windXI *= 0.4;
        if (Math.abs(s.windXI) < 0.1) {
          s.windXI = 0;
          s.top = 0;
        }
      }
    }
  }

  /** topXOffset of a tuft (the renderer multiplies it by each sprite's intensity). */
  shear(g: Grass, _sprite: number): number {
    return this.states.get(g)?.top ?? 0;
  }
}
