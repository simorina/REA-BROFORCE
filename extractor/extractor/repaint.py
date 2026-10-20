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


# Double Bro Seven -> Trump: a dark navy suit, the white shirt kept, the red flower kept as the tie,
# blond-orange hair, orange tan
TRUMP_MAP: dict[RGB, RGB] = {
    (0x20, 0x20, 0x20): (0x16, 0x1B, 0x2E),
    (0x2B, 0x2D, 0x2F): (0x20, 0x27, 0x40),
    (0x1F, 0x1D, 0x1D): (0x11, 0x15, 0x24),
    (0x20, 0x13, 0x06): (0xC8, 0x8A, 0x2E),
    (0x3E, 0x2B, 0x1A): (0xF0, 0xC0, 0x5A),
    (0x2C, 0x1A, 0x09): (0xDB, 0xA4, 0x44),
    (0xCF, 0x8C, 0x71): (0xE8, 0x8C, 0x4A),
    (0xE9, 0xA6, 0x8C): (0xF5, 0xA8, 0x64),
    (0xAA, 0x73, 0x5D): (0xC0, 0x6A, 0x30),
    (0xA8, 0x86, 0x78): (0xC8, 0x84, 0x58),
}


def stealth(rgb: RGB) -> RGB:
    """The Harrier is painted (1196 colours), so it is toned rather than mapped: greys go dark slate, and the bluish
    cockpit glass is kept."""
    r, g, b = rgb
    if b > r + 40 and b > 150:
        return rgb
    v = round((0.3 * r + 0.59 * g + 0.11 * b) * 0.42 + 10)
    return (v, v, min(255, v + 6))


# Double Bro Seven -> Epstein: silver hair, pale skin, the tuxedo turned into a grey sweater (the flower with it)
EPSTEIN_SWEATER: RGB = (0x7A, 0x80, 0x8C)
EPSTEIN_MAP: dict[RGB, RGB] = {
    (0x20, 0x20, 0x20): EPSTEIN_SWEATER,
    (0x2B, 0x2D, 0x2F): (0x8C, 0x93, 0xA0),
    (0x1F, 0x1D, 0x1D): (0x68, 0x6E, 0x7A),
    (0x7F, 0x11, 0x00): EPSTEIN_SWEATER,
    (0x20, 0x13, 0x06): (0xA8, 0xA8, 0xAC),
    (0x3E, 0x2B, 0x1A): (0xD0, 0xD0, 0xD4),
    (0x2C, 0x1A, 0x09): (0xB8, 0xB8, 0xBC),
    (0xCF, 0x8C, 0x71): (0xE8, 0xB8, 0xA0),
    (0xE9, 0xA6, 0x8C): (0xF4, 0xCC, 0xB4),
    (0xAA, 0x73, 0x5D): (0xC8, 0x98, 0x82),
    (0xA8, 0x86, 0x78): (0xC0, 0xA0, 0x90),
}

# WallBrick1 -> the island's temple: white bricks, blue mortar and shadows
TEMPLE_MAP: dict[RGB, RGB] = {
    (120, 113, 80): (0xE8, 0xEC, 0xF0),
    (157, 149, 110): (0xFF, 0xFF, 0xFF),
    (88, 83, 58): (0x4A, 0x7C, 0xC8),
    (76, 70, 37): (0x2E, 0x5A, 0xA8),
}

# Dirty Brorry's revolver hand -> Samuel's: his skin, and the sleeve of his dark suit (the revolver stays as it is)
SAMUEL_GUN_MAP: dict[RGB, RGB] = {
    (0xCF, 0x8C, 0x71): (0x8A, 0x58, 0x40),
    (0xB5, 0x7C, 0x65): (0x70, 0x44, 0x30),
    (0x5F, 0x5A, 0x56): (0x26, 0x14, 0x18),
    (0x70, 0x6B, 0x67): (0x3A, 0x22, 0x26),
    (0x80, 0x7B, 0x77): (0x4A, 0x2E, 0x32),
}

# Col James Brodock -> Che Guevara: his red hair and beard dark brown, his headband the black of a beret
CHE_MAP: dict[RGB, RGB] = {
    (0xFF, 0x6D, 0x03): (0x3A, 0x2A, 0x1E),
    (0xCE, 0x57, 0x03): (0x2C, 0x20, 0x17),
    (0xBD, 0x50, 0x03): (0x22, 0x18, 0x11),
    (0x69, 0x23, 0x19): (0x1A, 0x12, 0x0D),
    (0x30, 0x3A, 0x21): (0x14, 0x14, 0x16),
}
# Rambro's bare arms on his M60 -> Che's olive sleeves
CHE_GUN_MAP: dict[RGB, RGB] = {
    (0xCF, 0x8C, 0x71): (0x54, 0x65, 0x3A),
    (0xE9, 0xA6, 0x8C): (0x6B, 0x76, 0x4B),
    (0xD7, 0x94, 0x79): (0x5F, 0x6E, 0x42),
}


@dataclass(frozen=True)
class Star:
    """In every frame, the pixel of the `band` colour furthest forward (sprites face right) becomes the star."""
    band: RGB
    color: RGB
    frame: int = 32


CHE_STAR = Star(band=(0x30, 0x3A, 0x21), color=(0xD4, 0x20, 0x20))

# Ellen Ripbro -> Giorgia Meloni: her dark curls blonde, the khaki top and blue trousers a navy suit, the white and red
# sneakers dark shoes (her skin stays)
MELONI_MAP: dict[RGB, RGB] = {
    (0x21, 0x14, 0x0A): (0xC9, 0xA0, 0x4A),
    (0x46, 0x2A, 0x13): (0xEE, 0xD4, 0x8A),
    (0xD7, 0xD2, 0xBC): (0x2B, 0x3A, 0x63),
    (0xA6, 0x98, 0x7B): (0x1D, 0x28, 0x46),
    (0x26, 0x93, 0xD2): (0x26, 0x33, 0x54),
    (0x26, 0x7D, 0xBA): (0x22, 0x2E, 0x4D),
    (0x27, 0x5B, 0x96): (0x1B, 0x24, 0x40),
    (0xDB, 0xE7, 0xED): (0x2A, 0x2A, 0x30),
    (0x96, 0x2E, 0x35): (0x14, 0x14, 0x18),
}
# B.A. Broracus's hands on his flamethrower -> hers
MELONI_GUN_MAP: dict[RGB, RGB] = {
    (0x68, 0x47, 0x2C): (0xC3, 0x86, 0x6D),
    (0x71, 0x4E, 0x31): (0xD7, 0x94, 0x79),
    (0x7E, 0x58, 0x38): (0xE9, 0xA6, 0x8C),
}


def flame_tone(cool: RGB, mid: RGB, hot: RGB):
    """Broforce's flames are pure red-to-yellow (R 255, B 0): their green says how hot a pixel is, from #FF3E00 to
    #FFE200. The tone keeps that heat and paints it from `cool` through `mid` to `hot`."""
    def tone(rgb: RGB) -> RGB:
        t = max(0.0, min(1.0, (rgb[1] - 0x3E) / (0xE2 - 0x3E)))
        a, b, k = (cool, mid, t * 2) if t < 0.5 else (mid, hot, t * 2 - 1)
        return tuple(round(a[i] + (b[i] - a[i]) * k) for i in range(3))
    return tone


# the tricolour: the flag's green (#009246) and red (#CE2B37) at mid heat
FLAME_GREEN = flame_tone((0x05, 0x5A, 0x2A), (0x00, 0x92, 0x46), (0x9B, 0xE8, 0x8A))
FLAME_WHITE = flame_tone((0x9A, 0xA6, 0xB8), (0xDD, 0xE2, 0xEA), (0xFF, 0xFF, 0xFF))
FLAME_RED = flame_tone((0x7A, 0x0B, 0x14), (0xCE, 0x2B, 0x37), (0xFF, 0x5A, 0x5A))  # its hottest still red, not salmon


@dataclass(frozen=True)
class Recipe:
    key: str                  # output sheet: sprites/<key>.png
    source: str               # catalog SpriteRef or TextureRef key of the sheet it repaints
    palette: dict
    hair: HairMask | None = None
    decal: Decal | None = None
    tone: object = None       # a function RGB -> RGB applied to every opaque pixel
    star: Star | None = None


RECIPES = (
    Recipe("brolusconi", "bro_base", PALETTE_MAP),
    Recipe("putin", "bro_lee", PUTIN_MAP, PUTIN_HAIR),
    Recipe("tank_ru", "tank_hull", HULL_MAP),
    Recipe("turret_ru", "tank_turret", TURRET_MAP, decal=RU_FLAG),
    Recipe("trump", "bro_base", TRUMP_MAP),
    Recipe("jet_us", "jet_harrier", {}, tone=stealth),
    Recipe("epstein", "bro_base", EPSTEIN_MAP),
    Recipe("block_temple", "block_brick", TEMPLE_MAP),
    Recipe("revolver_gun", "dirty_harry_gun", SAMUEL_GUN_MAP),
    Recipe("che", "bro_brodock", CHE_MAP, star=CHE_STAR),
    Recipe("m60_gun", "rambro_gun", CHE_GUN_MAP),
    Recipe("meloni", "bro_ellen", MELONI_MAP),
    Recipe("flamethrower_gun", "ba_gun", MELONI_GUN_MAP),
    Recipe("flame_green", "flame_1", {}, tone=FLAME_GREEN),
    Recipe("flame_white", "flame_2", {}, tone=FLAME_WHITE),
    Recipe("flame_red", "flame_3", {}, tone=FLAME_RED),
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
            decal: Decal | None = None, tone=None, star: Star | None = None) -> Image.Image:
    out = img.convert("RGBA").copy()
    px = out.load()
    width, height = out.size
    hair_px, trousers_px = _split_hair(px, width, height, hair) if hair else (set(), set())
    for y in range(height):
        for x in range(width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if tone is not None:
                px[x, y] = (*tone((r, g, b)), a)
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
    if star:
        src = img.convert("RGBA").load()
        for fy in range(0, height, star.frame):
            for fx in range(0, width, star.frame):
                band = [(x, y) for y in range(fy, min(fy + star.frame, height)) for x in range(fx, min(fx + star.frame, width))
                        if src[x, y][3] and src[x, y][:3] == star.band]
                if band:
                    x, y = max(band, key=lambda p: (p[0], -p[1]))
                    px[x, y] = (*star.color, src[x, y][3])
    return out
