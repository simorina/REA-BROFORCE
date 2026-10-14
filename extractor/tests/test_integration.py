import json
import os

import pytest
from PIL import Image

from extractor.__main__ import run

DATA = os.environ.get(
    "BROFORCE_DATA", r"C:\Program Files (x86)\Steam\steamapps\common\Broforce\Broforce_beta_Data")
pytestmark = pytest.mark.skipif(not os.path.isdir(DATA), reason="Broforce is not installed here")


def test_extracts_sprites_values_and_the_repaint(tmp_path):
    run(DATA, str(tmp_path))
    manifest = json.loads((tmp_path / "manifest.json").read_text(encoding="utf-8"))
    assert "sprites/brolusconi.png" in manifest["files"]
    values = json.loads((tmp_path / "values.json").read_text(encoding="utf-8"))
    assert values["bro_base"]["_jumpForce"] == 260.0
    assert values["bro_base"]["speed"] == 110.0
    assert values["bro_base"]["originalSpecialAmmo"] == 4
    assert values["mook"]["health"] == 3
    assert values["bomb"]["range"] == 28.0
    assert values["block_barrel"]["range"] == 50.0
    sheets = json.loads((tmp_path / "sheets.json").read_text(encoding="utf-8"))
    assert sheets["brolusconi"]["frameW"] == 32 and sheets["brolusconi"]["cols"] == 32
    assert sheets["helicopter"]["frameW"] == 96 and sheets["helicopter"]["cols"] == 21
    assert sheets["explosion"]["frameW"] == 64 and sheets["explosion"]["cols"] == 16
    assert Image.open(tmp_path / "sprites" / "block_dirt.png").size == (16, 16)
