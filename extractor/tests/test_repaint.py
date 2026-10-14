from PIL import Image

from extractor.repaint import PALETTE_MAP, repaint


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
