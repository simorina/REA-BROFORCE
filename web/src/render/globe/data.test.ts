import { describe, expect, it } from 'vitest';
import { groupArrays, parseGlobe, type GlobeGroup } from './data';

const minimal = {
  radius: 5, camera: { height: 16.68, fovOut: 30, fovIn: 18, near: 0.3, far: 18, background: [0, 0.05, 0.1] },
  fog: { color: [0.25, 0.4, 0.65], start: 12.93, end: 14.5 }, light: { towards: [0, 1, 0], intensity: 0.5 },
  lightmap: { file: 'worldmap/lightmap.png' }, helicopter3d: { heightOffGround: 5.9, angularMoveSpeed: 25 },
  materials: [], groups: [], territories: { usa: { centre: [0, 0, 5.2], landing: [0, 0.1, 5] } }, glows: [],
  models: { helicopter: [], flag: [] }, modelFrames: { helicopter: Array(16).fill(0) }, icons: { terror: 'a.png', arrow: 'b.png' },
};

describe('the world map data (game-data/worldmap)', () => {
  it('reads globe.json and names what is missing', () => {
    expect(parseGlobe(minimal).radius).toBe(5);
    const { territories: _, ...noTerritories } = minimal;
    expect(() => parseGlobe(noTerritories)).toThrow('territories');
    const { glows: __, ...noGlows } = minimal;
    expect(() => parseGlobe(noGlows)).toThrow('glows'); // globe.json from before the camera's glows: re-extract
    expect(() => parseGlobe('<!doctype html>')).toThrow();
  });

  it("slices a group's arrays out of globe.bin at their offsets", () => {
    const bin = new ArrayBuffer(64);
    const f = new Float32Array(bin);
    f.set([1, 2, 3, 4, 5, 6], 0); // two vertices' positions
    new Uint32Array(bin, 24, 3).set([0, 1, 1]);
    new Uint8Array(bin, 36, 8).set([255, 0, 0, 255, 0, 255, 0, 255]);
    const g: GlobeGroup = { material: 0, lightmapped: false, vertexCount: 2, indexCount: 3, position: 0, normal: 0, uv: 0, uv2: null, index: 24, color: 36 };
    const a = groupArrays(bin, g);
    expect(Array.from(a.position)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(a.uv.length).toBe(4);
    expect(a.uv2).toBeNull();
    expect(Array.from(a.index)).toEqual([0, 1, 1]);
    expect(Array.from(a.color!)).toEqual([255, 0, 0, 255, 0, 255, 0, 255]);
  });
});
