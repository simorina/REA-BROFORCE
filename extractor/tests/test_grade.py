from PIL import Image

from extractor.grade import lut_filter, grade


def _strip(fn) -> Image.Image:
    """An Amplify Color LUT strip: 32 slices of 32x32 side by side, blue across slices, red across, green up."""
    img = Image.new("RGB", (1024, 32))
    for b in range(32):
        for g in range(32):
            for r in range(32):
                img.putpixel((b * 32 + r, 31 - g), fn(r * 255 // 31, g * 255 // 31, b * 255 // 31))
    return img


def test_the_blank_preset_leaves_colours_as_they_are():
    f = lut_filter(_strip(lambda r, g, b: (r, g, b)))
    img = Image.new("RGBA", (3, 1))
    for i, c in enumerate([(0, 0, 0, 255), (200, 40, 90, 255), (255, 255, 255, 255)]):
        img.putpixel((i, 0), c)
    out = grade(img, f)
    for i in range(3):
        assert all(abs(a - b) <= 2 for a, b in zip(out.getpixel((i, 0)), img.getpixel((i, 0))))


def test_reads_green_from_the_bottom_row_up_and_keeps_alpha():
    f = lut_filter(_strip(lambda r, g, b: (g, 0, 0)))  # puts green into red
    img = Image.new("RGBA", (2, 1))
    img.putpixel((0, 0), (0, 255, 0, 255))
    img.putpixel((1, 0), (0, 0, 0, 40))
    out = grade(img, f)
    assert out.getpixel((0, 0))[0] >= 250 and out.getpixel((0, 0))[1] == 0
    assert out.getpixel((1, 0)) == (0, 0, 0, 40)
