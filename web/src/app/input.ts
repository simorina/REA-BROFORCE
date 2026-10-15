import { NO_CONTROLS, type Controls } from '../engine/types';

export const KEY_BINDINGS: Record<string, keyof Controls> = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  KeyZ: 'jump', Space: 'jump',
  KeyX: 'fire', KeyJ: 'fire',
  KeyC: 'special', KeyK: 'special',
  ShiftLeft: 'dash', ShiftRight: 'dash',
  KeyF: 'gesture', KeyL: 'gesture',
};

export function controlsFromKeys(down: ReadonlySet<string>): Controls {
  const c: Controls = { ...NO_CONTROLS };
  for (const code of down) {
    const control = KEY_BINDINGS[code];
    if (control) c[control] = true;
  }
  return c;
}

export class Keyboard {
  private readonly down = new Set<string>();
  private readonly tapped = new Set<string>(); // pressed since the last snapshot, so a quick tap still counts
  private target: EventTarget | null = null;

  private readonly onDown = (e: Event) => {
    const code = (e as KeyboardEvent).code;
    if (code in KEY_BINDINGS) {
      this.down.add(code);
      this.tapped.add(code);
      e.preventDefault();
    }
  };

  private readonly onUp = (e: Event) => {
    this.down.delete((e as KeyboardEvent).code);
  };

  private readonly onBlur = () => {
    this.down.clear();
    this.tapped.clear();
  };

  attach(target: EventTarget): void {
    this.target = target;
    target.addEventListener('keydown', this.onDown);
    target.addEventListener('keyup', this.onUp);
    target.addEventListener('blur', this.onBlur);
  }

  detach(): void {
    this.target?.removeEventListener('keydown', this.onDown);
    this.target?.removeEventListener('keyup', this.onUp);
    this.target?.removeEventListener('blur', this.onBlur);
    this.target = null;
    this.down.clear();
    this.tapped.clear();
  }

  /** Keys held now, plus any pressed and released since the previous snapshot. */
  snapshot(): Controls {
    const keys = this.tapped.size > 0 ? new Set([...this.down, ...this.tapped]) : this.down;
    this.tapped.clear();
    return controlsFromKeys(keys);
  }
}
