"""Bro repaints: deterministic colour remaps of an original bro's body sheet.

Brolusconi repaints Double Bro Seven (palette measured from 00Bro7_anim, 29 colours). Putin repaints BroLee
(13 colours), whose hair and trousers share one black, so a hair mask tells them apart first. Colours not
listed are kept.
"""
from dataclasses import dataclass

from PIL import Image

RGB = tuple[int, int, int]

PALETTE_MAP: dict[RGB, RGB] = {
    # tuxedo -> navy suit
    (0x20, 0x20, 0x20): (0x1F, 0x2A, 0x4A),
    (0x2B, 0x2D, 0x2F): (0x2A, 0x37, 0x5E),
    (0x1F, 0x1D, 0x1D): (0x18, 0x21, 0x3B),
    # brown hair -> slicked near-black with a shine
    (0x20, 0x13, 0x06): (0x14, 0x0E, 0x0A),
    (0x3E, 0x2B, 0x1A): (0x3A, 0x30, 0x2A),
    (0x2C, 0x1A, 0x09): (0x1E, 0x16, 0x10),
    # skin -> tan
    (0xCF, 0x8C, 0x71): (0xD8, 0x8A, 0x52),
    (0xE9, 0xA6, 0x8C): (0xF0, 0xA8, 0x6C),
    (0xAA, 0x73, 0x5D): (0xAE, 0x68, 0x3A),
    (0xA8, 0x86, 0x78): (0xB0, 0x80, 0x5C),
    # red flower -> blue tie
    (0x7F, 0x11, 0x00): (0x1E, 0x3A, 0x8A),
    (0x6B, 0x17, 0x0B): (0x17, 0x2E, 0x6E),
    (0xA1, 0x04, 0x03): (0x2D, 0x4F, 0xB0),
    (0x95, 0x26, 0x1A): (0x26, 0x45, 0x9C),
    (0xA4, 0x0E, 0x0C): (0x2D, 0x4F, 0xB0),
}

# BroLee's tan skin -> pale pink
PUTIN_MAP: dict[RGB, RGB] = {
    (0xEE, 0xB8, 0x91): (0xF4, 0xC9, 0xB4),
    (0xD7, 0xA1, 0x7F): (0xE0, 0xAD, 0x98),
    (0xC3, 0x86, 0x6D): (0xC8, 0x93, 0x82),
    (0xAA, 0x73, 0x5D): (0xA9, 0x77, 0x69),
    (0xAA, 0x7C, 0x5D): (0xAD, 0x80, 0x6E),
}


@dataclass(frozen=True)
class HairMask:
    """Splits a colour shared by hair and trousers. In each frame, a region of `base` + `shade` pixels
    (8-connected, grown from a `base` pixel) that touches a `feet` pixel is trousers; any other is hair."""
    base: RGB
    shade: RGB
    feet: frozenset
    hair: RGB
    hair_shade: RGB
    trousers: RGB
    frame: int = 32


# BroLee: hair top and trousers #161616, black sides/back of the head, belt and trouser shading, shoes #0E0E0E,
# socks #F1F2F6 -> ash-brown hair with darker sides, olive trousers (black shading, shoes and socks kept)
PUTIN_HAIR = HairMask(
    base=(0x16, 0x16, 0x16), shade=(0x00, 0x00, 0x00), feet=frozenset({(0x0E, 0x0E, 0x0E), (0xF1, 0xF2, 0xF6)}),
    hair=(0xA8, 0x8B, 0x6A), hair_shade=(0x6B, 0x54, 0x40), trousers=(0x4B, 0x53, 0x20),
)


# TankBroTank: the grey hull and turret plates -> military olive
OLIVE: dict[RGB, RGB] = {
    (0x80, 0x81, 0x78): (0x8A, 0x94, 0x60),
    (0x67, 0x68, 0x5F): (0x6B, 0x75, 0x47),
    (0x4F, 0x4F, 0x47): (0x53, 0x5C, 0x37),
    (0x42, 0x42, 0x3B): (0x44, 0x4C, 0x2C),
    (0x31, 0x31, 0x2C): (0x34, 0x3A, 0x22),
}
HULL_MAP: dict[RGB, RGB] = {
    **OLIVE,
    (0x3B, 0x3B, 0x3B): (0x3C, 0x44, 0x28),
    (0x36, 0x35, 0x35): (0x37, 0x3E, 0x26),
    (0x3D, 0x3D, 0x3D): (0x3E, 0x46, 0x29),
}
TURRET_MAP: dict[RGB, RGB] = dict(OLIVE)


@dataclass(frozen=True)
class Decal:
    """Repaints a fixed rectangle of every frame (the turret's flag) as horizontal stripes, one colour per row.
    Only pixels of the `sources` colours change, so the outline around the flag is kept."""
    x: int
    y: int
    w: int
    h: int
    sources: frozenset
    stripes: tuple
    frame: int = 48


# The turret's US flag (6x5 at 17,22; its lower rows sit at 16 in the recoil and cannon frames) -> white-blue-red
RU_FLAG = Decal(
    x=16, y=22, w=7, h=5,
    sources=frozenset({(0x49, 0x78, 0xB9), (0x8F, 0x32, 0x32), (0xB8, 0xB3, 0xAF)}),
    stripes=((0xEE, 0xEE, 0xEE), (0xEE, 0xEE, 0xEE), (0x1F, 0x4F, 0xB0), (0xC8, 0x22, 0x1F), (0xC8, 0x22, 0x1F)),
)


@dataclass(frozen=True)
class Recipe:
    key: str                  # output sheet: sprites/<key>.png
    source: str               # catalog SpriteRef key of the sheet it repaints
    palette: dict
    hair: HairMask | None = None
    decal: Decal | None = None


RECIPES = (
    Recipe("brolusconi", "bro_base", PALETTE_MAP),
    Recipe("putin", "bro_lee", PUTIN_MAP, PUTIN_HAIR),
    Recipe("tank_ru", "tank_hull", HULL_MAP),
    Recipe("turret_ru", "tank_turret", TURRET_MAP, decal=RU_FLAG),
)


def _split_hair(px, width: int, height: int, mask: HairMask) -> tuple[set, set]:
    """(hair pixels, trousers pixels) of every base/shade region; a region never crosses a frame edge."""
    hair: set = set()
    trousers: set = set()
    seen: set = set()

    def colour(x, y):
        r, g, b, a = px[x, y]
        return (r, g, b) if a else None

    for fy in range(0, height, mask.frame):
        for fx in range(0, width, mask.frame):
            x1, y1 = min(fx + mask.frame, width), min(fy + mask.frame, height)
            for y in range(fy, y1):
                for x in range(fx, x1):
                    if (x, y) in seen or colour(x, y) != mask.base:
                        continue
                    region, stack, feet = [], [(x, y)], False
                    seen.add((x, y))
                    while stack:
                        cx, cy = stack.pop()
                        region.append((cx, cy))
                        for nx in (cx - 1, cx, cx + 1):
                            for ny in (cy - 1, cy, cy + 1):
                                if not (fx <= nx < x1 and fy <= ny < y1):
                                    continue
                                c = colour(nx, ny)
                                if c in mask.feet:
                                    feet = True
                                elif (nx, ny) not in seen and c in (mask.base, mask.shade):
                                    seen.add((nx, ny))
                                    stack.append((nx, ny))
                    (trousers if feet else hair).update(region)
    return hair, trousers


def repaint(img: Image.Image, mapping: dict = PALETTE_MAP, hair: HairMask | None = None,
            decal: Decal | None = None) -> Image.Image:
    out = img.convert("RGBA").copy()
    px = out.load()
    width, height = out.size
    hair_px, trousers_px = _split_hair(px, width, height, hair) if hair else (set(), set())
    for y in range(height):
        for x in range(width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            new = mapping.get((r, g, b))
            if hair and (x, y) in hair_px:
                new = hair.hair if (r, g, b) == hair.base else hair.hair_shade
            elif hair and (x, y) in trousers_px and (r, g, b) == hair.base:
                new = hair.trousers
            if new is not None:
                px[x, y] = (*new, a)
    if decal:
        src = img.convert("RGBA").load()
        for fy in range(0, height - decal.h + 1, decal.frame):
            for fx in range(0, width - decal.w + 1, decal.frame):
                for dy in range(decal.h):
                    for dx in range(decal.w):
                        x, y = fx + decal.x + dx, fy + decal.y + dy
                        if x >= width or y >= height:
                            continue
                        r, g, b, a = src[x, y]
                        if a and (r, g, b) in decal.sources:
                            px[x, y] = (*decal.stripes[dy], a)
    return out
