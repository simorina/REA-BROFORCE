"""Amplify Color grading: ColorShiftController grades the BackgroundCamera with a LUT per level theme."""
from PIL import Image, ImageFilter

SIZE = 32  # the LUT strips are 32 slices of 32x32 (1024x32)


def lut_filter(strip: Image.Image) -> ImageFilter.Color3DLUT:
    """A LUT strip as a trilinear 3D lookup: blue picks the slice, red runs across it, green runs up it."""
    strip = strip.convert("RGB")
    table = []
    for b in range(SIZE):
        for g in range(SIZE):
            for r in range(SIZE):
                p = strip.getpixel((b * SIZE + r, SIZE - 1 - g))
                table += [p[0] / 255, p[1] / 255, p[2] / 255]
    return ImageFilter.Color3DLUT(SIZE, table)


def grade(img: Image.Image, lut: ImageFilter.Color3DLUT) -> Image.Image:
    """The image through the LUT, its alpha untouched."""
    img = img.convert("RGBA")
    out = img.convert("RGB").filter(lut).convert("RGBA")
    out.putalpha(img.getchannel("A"))
    return out
