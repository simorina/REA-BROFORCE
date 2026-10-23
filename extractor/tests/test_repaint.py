from PIL import Image

from extractor.catalog import SPRITES, TEXTURES
from extractor.repaint import HULL_MAP, PALETTE_MAP, PUTIN_HAIR, PUTIN_MAP, RECIPES, RU_FLAG, TRUMP_MAP, TURRET_MAP, repaint, stealth
from extractor.repaint import CHE_GUN_MAP, CHE_MAP, CHE_STAR, EPSTEIN_MAP, SAMUEL_GUN_MAP, TEMPLE_MAP
from extractor.repaint import FLAME_GREEN, FLAME_RED, FLAME_WHITE, MELONI_GUN_MAP, MELONI_MAP
from extractor.repaint import PLASMA_CYAN, PLASMA_DEEP, PLASMA_WHITE, plasma


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
    sprite_keys = {s.key for s in SPRITES} | {t.key for t in TEXTURES}  # a recipe repaints a sprite or a texture
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
    assert [(r.key, r.source) for r in RECIPES][6:8] == [("epstein", "bro_base"), ("block_temple", "block_brick")]


def test_dirty_harrys_revolver_hand_and_sleeve_take_samuels_skin_and_suit():
    img = Image.new("RGBA", (3, 1))
    img.putpixel((0, 0), (0xCF, 0x8C, 0x71, 255))  # hand
    img.putpixel((1, 0), (0x5F, 0x5A, 0x56, 255))  # sleeve
    img.putpixel((2, 0), (0x0E, 0x0E, 0x0E, 255))  # the revolver stays black
    out = repaint(img, SAMUEL_GUN_MAP)
    assert out.getpixel((0, 0)) == (0x8A, 0x58, 0x40, 255)
    assert out.getpixel((1, 0)) == (0x26, 0x14, 0x18, 255)
    assert out.getpixel((2, 0)) == (0x0E, 0x0E, 0x0E, 255)
    assert any(r.key == "revolver_gun" and r.source == "dirty_harry_gun" for r in RECIPES)


def test_brodocks_red_hair_and_beard_turn_dark_and_his_headband_black():
    img = Image.new("RGBA", (3, 1))
    img.putpixel((0, 0), (0xFF, 0x6D, 0x03, 255))  # hair / beard
    img.putpixel((1, 0), (0x30, 0x3A, 0x21, 255))  # headband
    img.putpixel((2, 0), (0x54, 0x65, 0x3A, 255))  # the olive fatigues stay
    out = repaint(img, CHE_MAP)
    assert out.getpixel((0, 0))[:3] == CHE_MAP[(0xFF, 0x6D, 0x03)] and sum(out.getpixel((0, 0))[:3]) < 200
    assert out.getpixel((1, 0))[:3] == CHE_MAP[(0x30, 0x3A, 0x21)]
    assert out.getpixel((2, 0)) == (0x54, 0x65, 0x3A, 255)
    assert any(r.key == "che" and r.source == "bro_brodock" for r in RECIPES)


def test_the_red_star_goes_on_the_front_of_the_headband_in_every_frame():
    band = (0x30, 0x3A, 0x21)
    img = Image.new("RGBA", (64, 32))
    for x in (10, 11, 12, 13):
        img.putpixel((x, 14), (*band, 255))  # frame 0: the band runs 10-13, he faces right
    for x in (40, 41, 42):
        img.putpixel((x, 15), (*band, 255))  # frame 1: 40-42
    out = repaint(img, CHE_MAP, star=CHE_STAR)
    assert out.getpixel((13, 14))[:3] == CHE_STAR.color
    assert out.getpixel((42, 15))[:3] == CHE_STAR.color
    assert out.getpixel((12, 14))[:3] == CHE_MAP[band]


def test_rambros_bare_arms_on_the_m60_take_ches_olive_sleeves():
    img = Image.new("RGBA", (2, 1))
    img.putpixel((0, 0), (0xCF, 0x8C, 0x71, 255))
    img.putpixel((1, 0), (0x1E, 0x1E, 0x1E, 255))  # the gun stays
    out = repaint(img, CHE_GUN_MAP)
    assert out.getpixel((0, 0)) == (0x54, 0x65, 0x3A, 255)
    assert out.getpixel((1, 0)) == (0x1E, 0x1E, 0x1E, 255)
    assert any(r.key == "m60_gun" and r.source == "rambro_gun" for r in RECIPES)


def test_ellen_ripbro_becomes_meloni_blonde_in_a_navy_suit_and_dark_shoes():
    img = Image.new("RGBA", (6, 1))
    for x, rgb in enumerate([(0x21, 0x14, 0x0A), (0xD7, 0xD2, 0xBC), (0x26, 0x93, 0xD2), (0xDB, 0xE7, 0xED), (0x96, 0x2E, 0x35),
                             (0xC3, 0x86, 0x6D)]):  # hair, top, trousers, sneaker, sneaker stripe, skin
        img.putpixel((x, 0), (*rgb, 255))
    out = repaint(img, MELONI_MAP)
    r, g, b, _ = out.getpixel((0, 0))
    assert r > 180 and g > 140 and b < 120  # blonde
    for x in (1, 2):
        r, g, b, _ = out.getpixel((x, 0))
        assert b > r and b > g and r + g + b < 300  # navy
    assert sum(out.getpixel((3, 0))[:3]) < 200 and sum(out.getpixel((4, 0))[:3]) < 200  # dark shoes
    assert out.getpixel((5, 0)) == (0xC3, 0x86, 0x6D, 255)  # her skin stays
    assert any(r.key == "meloni" and r.source == "bro_ellen" for r in RECIPES)


def test_ba_broracus_hands_on_the_flamethrower_take_melonis_skin():
    img = Image.new("RGBA", (2, 1))
    img.putpixel((0, 0), (0x68, 0x47, 0x2C, 255))  # B.A.'s hand
    img.putpixel((1, 0), (0x1E, 0x1E, 0x1E, 255))  # the flamethrower stays
    out = repaint(img, MELONI_GUN_MAP)
    assert out.getpixel((0, 0)) == (0xC3, 0x86, 0x6D, 255)
    assert out.getpixel((1, 0)) == (0x1E, 0x1E, 0x1E, 255)
    assert any(r.key == "flamethrower_gun" and r.source == "ba_gun" for r in RECIPES)


def test_the_flames_burn_in_the_tricolour_hottest_lightest():
    hot, mid, cool = (0xFF, 0xE2, 0x00), (0xFF, 0x90, 0x00), (0xFF, 0x3E, 0x00)
    assert FLAME_GREEN(mid) == (0x00, 0x92, 0x46) and FLAME_RED(mid) == (0xCE, 0x2B, 0x37)  # the flag's green and red
    assert FLAME_WHITE(hot) == (0xFF, 0xFF, 0xFF)
    for tone in (FLAME_GREEN, FLAME_WHITE, FLAME_RED):
        assert sum(tone(hot)) > sum(tone(mid)) > sum(tone(cool))
    img = Image.new("RGBA", (1, 1), (*hot, 200))
    assert repaint(img, {}, tone=FLAME_GREEN).getpixel((0, 0))[3] == 200
    pairs = {(r.key, r.source) for r in RECIPES}
    assert {("flame_green", "flame_1"), ("flame_white", "flame_2"), ("flame_red", "flame_3")} <= pairs


def test_satans_laser_burns_in_tesla_blue_round_a_white_core():
    orange, yellow, white, ember = (0xFF, 0x60, 0x00), (0xFF, 0xE0, 0x00), (0xFF, 0xFF, 0xFF), (0x40, 0x00, 0x00)
    assert (plasma(orange), plasma(yellow), plasma(white)) == (PLASMA_DEEP, PLASMA_CYAN, PLASMA_WHITE)
    for rgb in (orange, (0xFF, 0xA0, 0x00), yellow, (0xFF, 0xF0, 0x80)):
        r, g, b = plasma(rgb)
        assert b == 0xFF and r < g  # blue, never fire
    assert sum(plasma(white)) > sum(plasma((0xFF, 0xF0, 0x80))) > sum(plasma(yellow)) > sum(plasma(orange))
    assert max(plasma(ember)) < 0x50 and plasma((0, 0, 0)) == (0, 0, 0)  # the drop's dark edge stays dark
    img = Image.new("RGBA", (1, 1), (*yellow, 90))
    assert repaint(img, {}, tone=plasma).getpixel((0, 0)) == (*PLASMA_CYAN, 90)
    pairs = {(r.key, r.source) for r in RECIPES}
    assert {("plasma_beam", "laser_beam_src"), ("plasma_flare", "laser_bits_src")} <= pairs
    textures = {t.key: (t.texture, t.frame) for t in TEXTURES}
    assert textures["laser_beam_src"] == ("laserBeam", (32, 128)) and textures["laser_bits_src"] == ("laserBeamBits", (256, 256))
