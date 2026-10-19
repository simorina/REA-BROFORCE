/**
 * The world map's camera and helicopter, ported from Broforce's WorldCamera and Helicopter3D: directions from the
 * globe's centre in three.js space (right-handed: Unity's z flipped), angles in radians.
 */
export type Vec3 = readonly [number, number, number];

export const ZOOM_LIMIT = Math.PI / 2;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export function normalize(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

/** WorldCamera.EaseOutExpo */
export const easeOutExpo = (t: number): number => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));

export const angleBetween = (a: Vec3, b: Vec3): number => Math.acos(clamp(dot(normalize(a), normalize(b)), -1, 1));

/** Vector3.Slerp on unit vectors. */
export function slerp(a: Vec3, b: Vec3, t: number): Vec3 {
  const omega = angleBetween(a, b);
  if (omega < 1e-6) return normalize(a);
  const s = Math.sin(omega);
  const ka = Math.sin((1 - t) * omega) / s;
  const kb = Math.sin(t * omega) / s;
  return normalize([a[0] * ka + b[0] * kb, a[1] * ka + b[1] * kb, a[2] * ka + b[2] * kb]);
}

/** Latitude (up the y axis) and longitude (Unity's atan2(x, z), z flipped back). */
export function latLon(d: Vec3): { lat: number; lon: number } {
  const n = normalize(d);
  return { lat: Math.asin(clamp(n[1], -1, 1)), lon: Math.atan2(n[0], -n[2]) };
}

export function fromLatLon(lat: number, lon: number): Vec3 {
  return [Math.cos(lat) * Math.sin(lon), Math.sin(lat), -Math.cos(lat) * Math.cos(lon)];
}

/** WorldCamera.SmoothZoom: fieldOfView = Lerp(ZoomOut, ZoomIn, sin(currentZoom)), unclamped past ZoomOut. */
export const zoomFov = (zoom: number, fovOut: number, fovIn: number): number => fovOut + (fovIn - fovOut) * Math.sin(zoom);

/** WorldCamera.RunZoom: in at half speed while the helicopter waits, out at full speed once it has flown off. */
export const stepZoom = (zoom: number, zoomingIn: boolean, dt: number): number =>
  clamp(zoom + (zoomingIn ? dt * 0.5 : -dt), -ZOOM_LIMIT, ZOOM_LIMIT);

/** WorldCamera.GetHelicopterPosition: over the helicopter, its latitude halved as the view widens to ZoomOut. */
export function cameraDir(heli: Vec3, fov: number, fovOut: number, fovIn: number): Vec3 {
  const k = 0.5 * clamp((fov - fovIn) / (fovOut - fovIn), 0, 1);
  const { lat, lon } = latLon(heli);
  return fromLatLon(lat - k * lat, lon);
}

/** Helicopter3D's landing: TransportArriveAt three seconds after it starts down. */
export const LANDING_SECONDS = 3;

/** How far from the centre the landing helicopter is: from its height down to the landing zone over two seconds. */
export const landingRadius = (t: number, height: number, ground: number): number => height + (ground - height) * clamp(t * 0.5, 0, 1);

export interface Flight {
  from: Vec3;
  to: Vec3;
  duration: number;
}

/** A hop from one point of the globe to another along the great circle at `degPerSecond` (Helicopter3D.angularMoveSpeed). */
export function flight(from: Vec3, to: Vec3, degPerSecond: number): Flight {
  const angle = angleBetween(from, to);
  return { from: normalize(from), to: normalize(to), duration: angle < 1e-6 ? 0 : (angle * 180) / Math.PI / degPerSecond };
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Where the helicopter is `t` seconds into the hop, which way it heads (tangent to the globe), and whether it has landed. */
export function flightAt(f: Flight, t: number): { dir: Vec3; heading: Vec3; done: boolean } {
  const k = f.duration > 0 ? clamp(t / f.duration, 0, 1) : 1;
  const dir = slerp(f.from, f.to, smooth(k));
  const ahead = f.duration > 0 ? slerp(f.from, f.to, Math.min(1, smooth(k) + 1e-3)) : f.to;
  let heading: Vec3 = [ahead[0] - dir[0], ahead[1] - dir[1], ahead[2] - dir[2]];
  const along = dot(heading, dir);
  heading = [heading[0] - along * dir[0], heading[1] - along * dir[1], heading[2] - along * dir[2]];
  if (Math.hypot(...heading) < 1e-9) {
    // at the very end: keep heading along the great circle, from the start toward the end
    const back = slerp(f.from, f.to, Math.max(0, smooth(k) - 1e-3));
    heading = [dir[0] - back[0], dir[1] - back[1], dir[2] - back[2]];
  }
  return { dir, heading: normalize(heading), done: k >= 1 };
}
