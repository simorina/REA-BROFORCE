/** The matryoshka's two half shells flying apart when it opens: our own art, like the football. */
export interface Shell {
  x: number;
  y: number;
  xI: number;
  yI: number;
  age: number;
  side: -1 | 1; // which half
}

export const SHELL_LIFE = 0.6;
const SHELL_GRAVITY = 600;

export function openShells(x: number, y: number): Shell[] {
  return ([-1, 1] as const).map((side) => ({ x, y, xI: side * 70, yI: 120, age: 0, side }));
}

export function stepShells(shells: Shell[], dt: number): Shell[] {
  for (const s of shells) {
    s.age += dt;
    s.yI -= SHELL_GRAVITY * dt;
    s.x += s.xI * dt;
    s.y += s.yI * dt;
  }
  return shells.filter((s) => s.age < SHELL_LIFE);
}
