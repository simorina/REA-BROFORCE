import hashlib
import json

from PIL import Image

from extractor.manifest import OutputWriter


def test_writes_json_and_records_its_sha256(tmp_path):
    w = OutputWriter(str(tmp_path))
    w.write_json("values.json", {"a": 1}, "test")
    data = (tmp_path / "values.json").read_bytes()
    assert w.entries["values.json"] == {"sha256": hashlib.sha256(data).hexdigest(), "source": "test"}


def test_png_goes_into_its_subfolder(tmp_path):
    w = OutputWriter(str(tmp_path))
    w.write_png("sprites/x.png", Image.new("RGBA", (2, 2), (255, 0, 0, 255)), "test")
    assert Image.open(tmp_path / "sprites" / "x.png").getpixel((1, 1)) == (255, 0, 0, 255)
    assert "sprites/x.png" in w.entries


def test_manifest_is_written_only_by_finish(tmp_path):
    w = OutputWriter(str(tmp_path))
    w.write_json("b.json", [], "s")
    w.write_json("a.json", [], "s")
    assert not (tmp_path / "manifest.json").exists()
    w.finish({"dataDir": "X"})
    manifest = json.loads((tmp_path / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["version"] == 1
    assert manifest["dataDir"] == "X"
    assert list(manifest["files"]) == ["a.json", "b.json"]
