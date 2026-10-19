import { describe, expect, it } from 'vitest';
import {
  angleBetween, cameraDir, easeOutExpo, flight, flightAt, fromLatLon, landingRadius, LANDING_SECONDS, latLon, slerp, stepZoom,
  zoomFov, ZOOM_LIMIT,
  type Vec3,
} from './orbit';

const near = (a: Vec3, b: Vec3, eps = 1e-6) => a.every((v, i) => Math.abs(v - b[i]) < eps);
const len = (v: Vec3) => Math.hypot(...v);

describe('the world map camera (WorldCamera)', () => {
  it('eases out exponentially, from 0 to 1 (EaseOutExpo)', () => {
    expect(easeOutExpo(0)).toBe(0);
    expect(easeOutExpo(1)).toBe(1);
    expect(easeOutExpo(0.5)).toBeCloseTo(1 - 2 ** -5);
  });

  it('turns a direction toward another along the globe (Vector3.Slerp)', () => {
    expect(near(slerp([1, 0, 0], [0, 1, 0], 0), [1, 0, 0])).toBe(true);
    expect(near(slerp([1, 0, 0], [0, 1, 0], 1), [0, 1, 0])).toBe(true);
    const mid = slerp([1, 0, 0], [0, 1, 0], 0.5);
    expect(near(mid, [Math.SQRT1_2, Math.SQRT1_2, 0])).toBe(true);
    expect(len(mid)).toBeCloseTo(1);
    expect(near(slerp([0, 0, 1], [0, 0, 1], 0.3), [0, 0, 1])).toBe(true);
  });

  it('reads latitude and longitude off a direction, and back', () => {
    expect(latLon([0, 1, 0]).lat).toBeCloseTo(Math.PI / 2);
    const d = fromLatLon(0.4, -1.2);
    expect(latLon(d).lat).toBeCloseTo(0.4);
    expect(latLon(d).lon).toBeCloseTo(-1.2);
    expect(len(d)).toBeCloseTo(1);
  });

  it('zooms between its two fields of view through the sine of its zoom (SmoothZoom), out to 42 past ZoomOut', () => {
    expect(zoomFov(0, 30, 18)).toBe(30);
    expect(zoomFov(ZOOM_LIMIT, 30, 18)).toBeCloseTo(18);
    expect(zoomFov(-ZOOM_LIMIT, 30, 18)).toBeCloseTo(42);
  });

  it('zooms in slowly while the helicopter waits and out twice as fast once it flies off (RunZoom)', () => {
    expect(stepZoom(0, true, 0.2)).toBeCloseTo(0.1);
    expect(stepZoom(0, false, 0.2)).toBeCloseTo(-0.2);
    expect(stepZoom(1.5, true, 1)).toBe(ZOOM_LIMIT);
    expect(stepZoom(-1.5, false, 1)).toBe(-ZOOM_LIMIT);
  });

  it('looks straight down on the helicopter zoomed in, and from half its latitude zoomed out (GetHelicopterPosition)', () => {
    const heli = fromLatLon(0.8, 0.3);
    expect(near(cameraDir(heli, 18, 30, 18), heli)).toBe(true);
    const out = latLon(cameraDir(heli, 30, 30, 18));
    expect(out.lat).toBeCloseTo(0.4);
    expect(out.lon).toBeCloseTo(0.3);
  });
});

describe("the helicopter's flight (Helicopter3D.angularMoveSpeed)", () => {
  it('takes the angle over its angular speed, and goes the whole way', () => {
    const f = flight([1, 0, 0], [0, 0, -1], 25);
    expect(f.duration).toBeCloseTo(90 / 25);
    expect(angleBetween(f.from, f.to)).toBeCloseTo(Math.PI / 2);
    const end = flightAt(f, f.duration + 1);
    expect(near(end.dir, [0, 0, -1])).toBe(true);
    expect(end.done).toBe(true);
  });

  it('is halfway at half time and heads toward where it is going', () => {
    const f = flight([1, 0, 0], [0, 0, -1], 25);
    const mid = flightAt(f, f.duration / 2);
    expect(angleBetween(mid.dir, f.from)).toBeCloseTo(Math.PI / 4, 1);
    expect(mid.done).toBe(false);
    expect(mid.heading[2]).toBeLessThan(0); // toward -z
    expect(Math.abs(mid.dir[0] * mid.heading[0] + mid.dir[1] * mid.heading[1] + mid.dir[2] * mid.heading[2])).toBeLessThan(1e-6);
  });

  it('a flight to where it already is ends at once', () => {
    const f = flight([0, 1, 0], [0, 1, 0], 25);
    expect(f.duration).toBe(0);
    expect(flightAt(f, 0).done).toBe(true);
  });
});

describe("the helicopter setting down (Helicopter3D's landing)", () => {
  it('drops from its height to the landing zone over two seconds, and the mission starts after three', () => {
    expect(landingRadius(0, 5.9, 5.15)).toBeCloseTo(5.9);
    expect(landingRadius(1, 5.9, 5.15)).toBeCloseTo(5.525);
    expect(landingRadius(2, 5.9, 5.15)).toBeCloseTo(5.15);
    expect(landingRadius(5, 5.9, 5.15)).toBeCloseTo(5.15);
    expect(LANDING_SECONDS).toBe(3);
  });
});
