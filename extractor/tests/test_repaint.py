from PIL import Image

from extractor.catalog import SPRITES
from extractor.repaint import PALETTE_MAP, PUTIN_HAIR, PUTIN_MAP, RECIPES, repaint


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
    assert [(r.key, r.source) for r in RECIPES] == [("brolusconi", "bro_base"), ("putin", "bro_lee")]
