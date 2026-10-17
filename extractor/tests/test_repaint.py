from PIL import Image

from extractor.catalog import SPRITES
from extractor.repaint import HULL_MAP, PALETTE_MAP, PUTIN_HAIR, PUTIN_MAP, RECIPES, RU_FLAG, TRUMP_MAP, TURRET_MAP, repaint, stealth
from extractor.repaint import EPSTEIN_MAP, TEMPLE_MAP


def test_maps_known_colours_and_keeps_alpha():
    img = Image.new("RGBA", (2, 1))
    img.putpixel((0, 0), (0x20, 0x20, 0x20, 255))   # tuxedo
    img.putpixel((1, 0), (0x7F, 0x11, 0x00, 128))   # red flower
    out = repaint(img)
    assert out.getpixel((0, 0)) == (0x1F, 0x2A, 0x4A, 255)
    assert out.getpixel((1, 0)) == (0x1E, 0x3A, 0x8A, 128)


def test_leaves_outline_and_transparent_pixels_alone():
    img = Image.new("RGBA", (2, 1))
    img.putpixel((0, 0), (0, 0, 0, 255))
    img.putpixel((1, 0), (0x20, 0x20, 0x20, 0))
    out = repaint(img)
    assert out.getpixel((0, 0)) == (0, 0, 0, 255)
    assert out.getpixel((1, 0)) == (0x20, 0x20, 0x20, 0)


def test_does_not_modify_the_input():
    img = Image.new("RGBA", (1, 1), (0x20, 0x20, 0x20, 255))
    repaint(img)
    assert img.getpixel((0, 0)) == (0x20, 0x20, 0x20, 255)


def test_palette_targets_are_distinct_from_sources():
    for src, dst in PALETTE_MAP.items():
        assert src != dst


BASE, SHADE = (0x16, 0x16, 0x16, 255), (0x00, 0x00, 0x00, 255)
SHOE, SOCK = (0x0E, 0x0E, 0x0E, 255), (0xF1, 0xF2, 0xF6, 255)


def bro_frame():
    """A 32x32 frame: a hair top with a black side, and trousers with black shading over a sock and a shoe."""
    img = Image.new("RGBA", (32, 32))
    for x in range(10, 14):
        img.putpixel((x, 2), BASE)
        img.putpixel((x, 20), BASE)
        img.putpixel((x, 21), SHADE)
    img.putpixel((9, 3), SHADE)
    img.putpixel((10, 22), SOCK)
    img.putpixel((10, 23), SHOE)
    return img


def test_hair_mask_tells_hair_from_trousers():
    out = repaint(bro_frame(), PUTIN_MAP, PUTIN_HAIR)
    assert out.getpixel((11, 2)) == (*PUTIN_HAIR.hair, 255)
    assert out.getpixel((9, 3)) == (*PUTIN_HAIR.hair_shade, 255)
    assert out.getpixel((11, 20)) == (*PUTIN_HAIR.trousers, 255)
    assert out.getpixel((11, 21)) == SHADE  # the trousers' black shading is kept
    assert out.getpixel((10, 22)) == SOCK and out.getpixel((10, 23)) == SHOE


def test_hair_regions_stop_at_frame_edges():
    img = Image.new("RGBA", (64, 32))
    img.putpixel((31, 5), BASE)  # left frame: touches nothing -> hair
    img.putpixel((32, 5), BASE)  # right frame: next to a sock -> trousers
    img.putpixel((33, 6), SOCK)
    out = repaint(img, PUTIN_MAP, PUTIN_HAIR)
    assert out.getpixel((31, 5)) == (*PUTIN_HAIR.hair, 255)
    assert out.getpixel((32, 5)) == (*PUTIN_HAIR.trousers, 255)


def test_putin_skin_is_pale_and_brolusconi_ignores_it():
    img = Image.new("RGBA", (1, 1), (0xEE, 0xB8, 0x91, 255))
    assert repaint(img, PUTIN_MAP, PUTIN_HAIR).getpixel((0, 0)) == (0xF4, 0xC9, 0xB4, 255)
    assert repaint(img).getpixel((0, 0)) == (0xEE, 0xB8, 0x91, 255)


def test_recipes_repaint_extracted_sheets_into_new_keys():
    keys = [r.key for r in RECIPES]
    sprite_keys = {s.key for s in SPRITES}
    assert len(keys) == len(set(keys))
    assert all(r.source in sprite_keys for r in RECIPES)
    assert not set(keys) & sprite_keys
    assert [(r.key, r.source) for r in RECIPES][:2] == [("brolusconi", "bro_base"), ("putin", "bro_lee")]


def test_tank_greys_become_olive():
    img = Image.new("RGBA", (2, 1))
    img.putpixel((0, 0), (0x67, 0x68, 0x5F, 255))
    img.putpixel((1, 0), (0x3B, 0x3B, 0x3B, 255))
    assert repaint(img, TURRET_MAP).getpixel((0, 0)) == (0x6B, 0x75, 0x47, 255)
    assert repaint(img, HULL_MAP).getpixel((1, 0)) == (0x3C, 0x44, 0x28, 255)


def test_the_turret_flag_becomes_the_russian_tricolour_in_every_frame():
    blue, red, white = (0x49, 0x78, 0xB9, 255), (0x8F, 0x32, 0x32, 255), (0xB8, 0xB3, 0xAF, 255)
    img = Image.new("RGBA", (96, 48))
    for fx in (0, 48):
        for y in range(22, 27):
            for x in range(17, 23):
                img.putpixel((fx + x, y), (blue, red, white)[(x + y) % 3])
    img.putpixel((5, 5), blue)  # the same blue outside the flag stays
    out = repaint(img, TURRET_MAP, decal=RU_FLAG)
    for fx in (0, 48):
        assert [out.getpixel((fx + 18, y))[:3] for y in range(22, 27)] == list(RU_FLAG.stripes)
    assert out.getpixel((5, 5)) == blue


def test_tank_recipes():
    assert [(r.key, r.source) for r in RECIPES][2:4] == [("tank_ru", "tank_hull"), ("turret_ru", "tank_turret")]


def test_trump_keeps_the_red_tie_and_gets_blond_hair_and_orange_skin():
    img = Image.new("RGBA", (3, 1))
    img.putpixel((0, 0), (0x7F, 0x11, 0x00, 255))  # the red flower: kept as the tie
    img.putpixel((1, 0), (0x3E, 0x2B, 0x1A, 255))  # hair
    img.putpixel((2, 0), (0xE9, 0xA6, 0x8C, 255))  # skin
    out = repaint(img, TRUMP_MAP)
    assert out.getpixel((0, 0)) == (0x7F, 0x11, 0x00, 255)
    assert out.getpixel((1, 0)) == (*TRUMP_MAP[(0x3E, 0x2B, 0x1A)], 255)
    assert out.getpixel((2, 0)) == (*TRUMP_MAP[(0xE9, 0xA6, 0x8C)], 255)


def test_stealth_darkens_the_harrier_but_keeps_its_cockpit_glass():
    grey, glass = (0x97, 0x9B, 0x9C), (0x81, 0xBA, 0xE2)
    assert max(stealth(grey)) < 0x60
    assert stealth(glass) == glass
    img = Image.new("RGBA", (2, 1))
    img.putpixel((0, 0), (*grey, 200))
    img.putpixel((1, 0), (*glass, 255))
    out = repaint(img, {}, tone=stealth)
    assert out.getpixel((0, 0)) == (*stealth(grey), 200)
    assert out.getpixel((1, 0)) == (*glass, 255)


def test_trump_and_jet_recipes():
    assert [(r.key, r.source) for r in RECIPES][4:6] == [("trump", "bro_base"), ("jet_us", "jet_harrier")]


def test_epstein_gets_silver_hair_and_a_grey_sweater_without_the_flower():
    img = Image.new("RGBA", (3, 1))
    img.putpixel((0, 0), (0x3E, 0x2B, 0x1A, 255))  # hair
    img.putpixel((1, 0), (0x20, 0x20, 0x20, 255))  # the tuxedo
    img.putpixel((2, 0), (0x7F, 0x11, 0x00, 255))  # the red flower
    out = repaint(img, EPSTEIN_MAP)
    assert min(out.getpixel((0, 0))[:3]) > 0xA0  # silver
    assert out.getpixel((1, 0)) == (*EPSTEIN_MAP[(0x20, 0x20, 0x20)], 255)
    assert out.getpixel((2, 0)) == out.getpixel((1, 0))  # gone into the sweater


def test_the_temple_bricks_are_white_with_blue_mortar():
    img = Image.new("RGBA", (2, 1))
    img.putpixel((0, 0), (120, 113, 80, 255))  # WallBrick1's face
    img.putpixel((1, 0), (76, 70, 37, 255))  # its mortar
    out = repaint(img, TEMPLE_MAP)
    assert min(out.getpixel((0, 0))[:3]) > 0xD0
    r, g, b, _ = out.getpixel((1, 0))
    assert b > r + 60


def test_island_recipes():
    assert [(r.key, r.source) for r in RECIPES][6:] == [("epstein", "bro_base"), ("block_temple", "block_brick")]
