from extractor.__main__ import plain, sheet_entry
from extractor.unity import frame_from_spritesm


def test_frame_reads_lower_left_pixel_as_bottom_edge_from_the_top():
    tree = {"lowerLeftPixel": {"x": 32.0, "y": 64.0}, "pixelDimensions": {"x": 32.0, "y": 32.0},
            "offset": {"x": 0.0, "y": 15.0, "z": 0.0}}
    assert frame_from_spritesm(tree) == {"x": 32, "y_top": 32, "w": 32, "h": 32, "offset_y": 15.0}


def test_sheet_entry_counts_the_grid():
    frame = {"x": 0, "y_top": 0, "w": 32, "h": 32, "offset_y": 15.0}
    assert sheet_entry("sprites/a.png", 1024, 512, frame) == {
        "file": "sprites/a.png", "frameW": 32, "frameH": 32, "offsetY": 15.0, "cols": 32, "rows": 16}


def test_plain_rounds_unity_floats_only():
    assert plain(0.10000000149011612) == 0.1
    assert plain(3) == 3
