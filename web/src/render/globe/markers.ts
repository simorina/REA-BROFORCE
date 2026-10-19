/**
 * A territory's terror icon on the world map, ported from Broforce's WMIcon: a red disc with a number, drawn by the
 * UI camera over the territory's centre; when the territory turns to the far side of the globe the disc gives way to
 * an arrow round the globe's rim. Positions are in the UI camera's units, from the screen's centre, y up.
 */
export const UI_HALF_HEIGHT = 48; // the UI camera's orthographicSize: the screen is 96 units tall
export const ICON_UNITS = 8; // the icon's and the arrow's SpriteSM width and height
export const ARROW_BORDER = 3.5; // WMIcon.ArrowBorderDistance: kept this far in from the screen's edges
const ARROW_DISTANCE_FACTOR = 1.3; // the scene's WMIcon.ArrowDistanceFactor: the arrows' ring at ZoomOut, in half-heights
const ARROW_DISTANCE_IN = 3.2; // ... and zoomed in
export const FRONT_DOT = 0.3; // the territory faces the camera while dot(camera, centre) is over this

export interface IconPlace {
  x: number;
  y: number;
  front: boolean; // the disc and its number; otherwise the arrow
  angle: number; // the arrow's turn in degrees, anticlockwise (Unity's z)
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const sign = (v: number) => (v >= 0 ? 1 : -1); // Mathf.Sign: 0 counts as positive

/** WMIcon.Update: `view` is the territory centre's viewport point mapped to -1..1 (y up). */
export function placeIcon(view: { x: number; y: number }, front: boolean, aspect: number, fov: number): IconPlace {
  const right = UI_HALF_HEIGHT * aspect - ARROW_BORDER;
  const top = UI_HALF_HEIGHT - ARROW_BORDER;
  if (front) {
    return { x: clamp(view.x * UI_HALF_HEIGHT * aspect, -right, right), y: clamp(view.y * UI_HALF_HEIGHT, -top, top), front, angle: 0 };
  }
  const k = fov / -12 + 2.5;
  const distance = ARROW_DISTANCE_FACTOR + (ARROW_DISTANCE_IN - ARROW_DISTANCE_FACTOR) * clamp(k * k, 0, 1);
  const len = Math.hypot(view.x * aspect, view.y) || 1;
  const ny = view.y / len;
  const nx = sign(view.x) * Math.sqrt(Math.max(0, 1 - ny * ny));
  const x = nx >= 0 ? Math.min(nx * UI_HALF_HEIGHT * distance, right) : Math.max(nx * UI_HALF_HEIGHT * distance, -right);
  const y = ny >= 0 ? Math.min(ny * UI_HALF_HEIGHT * distance, top) : Math.max(ny * UI_HALF_HEIGHT * distance, -top);
  return { x, y, front, angle: (Math.atan2(y, x) * 180) / Math.PI + 90 };
}

export interface IconSpring {
  scale: number;
  vel: number;
}

/** WMIcon.Appear: from a tenth of its size. */
export const popIcon = (): IconSpring => ({ scale: 0.1, vel: 1 });

/** WMIcon.Bounce: squashed and kicked. */
export const bounceIcon = (s: IconSpring): IconSpring => ({ scale: s.scale * 0.8, vel: 5 });

/** WMIcon.Update's spring toward full size. */
export function stepIcon(s: IconSpring, dt: number): IconSpring {
  const t = clamp(dt, 0, 0.0334);
  const scale = s.scale + t * s.vel;
  const vel = (s.vel + (1 - scale) * t * 120) * (1 - t * 7);
  return { scale, vel };
}
