# Broforce: Brolusconi — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A playable browser remake of one Broforce level, starring the custom bro Silvio Brolusconi, built from the user's own Broforce install.

**Architecture:** A Python extractor (UnityPy) reads the Steam install read-only and writes `game-data/` (sprite sheets, frame grids, prefab values, the Brolusconi repaint). A React + Vite + TypeScript app serves `game-data/` as its public folder. The game itself is a browser-free TypeScript engine (fixed 60 Hz step, tile map, ported movement, explosions, projectiles, AI) drawn on one canvas; React only renders menus and the HUD.

**Tech Stack:** Python 3.12, UnityPy 1.25.4, Pillow, pytest · Node 22.23, React 18.3.1, Vite 6.0.7, TypeScript 5.7.2, Vitest 2.1.8.

**Spec:** `docs/superpowers/specs/2026-10-14-brolusconi-remake-design.md`

## Global Constraints

- Project root: `C:\Users\rinal\Desktop\REA-BROFORCE` (Git Bash: `/c/Users/rinal/Desktop/REA-BROFORCE`). All paths below are relative to it.
- Broforce data dir: `C:\Program Files (x86)\Steam\steamapps\common\Broforce\Broforce_beta_Data` — read only, never written.
- `decompiled/`, `game-data/` and `analysis/` hold Free Lives material: listed in `.gitignore`, never committed or published. No original pixels in the repo.
- World units are pixels, y points up, tile = 16 (`Map.TileSize`), cell `c` is centred on `x = c*16`.
- Every value ported from the game cites its source (class/method) in a comment next to it; design values (not from the game) are grouped and labelled as such.
- Engine code (`web/src/engine/`) never touches the DOM, so all of it runs under Vitest's node environment.
- UI copy is Italian. The voice line is exactly `Siete solo dei poveri comunisti!`.
- Commits are local only (no remote, no push). Each commit message ends with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- `game-data/` missing or stale — including Vite's SPA fallback answering `/sheets.json` with `index.html` — must show the "Mancano i dati del gioco" screen, never a crash. Test: Task 12, `loadData rejects HTML served for JSON`.
- A backgrounded tab resumed after seconds must not run hundreds of steps or tunnel units through walls. Test: Task 13, `advance clamps long frames`.
- Barrel chain reactions must terminate with each barrel exploding exactly once. Test: Task 11, `barrels chain-explode once each`.
- Map edges: units stop at the side edges, but airstrike bombs that start outside the map must still fly in. Tests: Task 6, `cannot leave the map through its side edges`; Task 11, `the airstrike brings five bombs`.
- Held keys: holding the special throws once; losing window focus releases every key. Tests: Task 11, `special fires once per press`; Task 13, `blur releases held keys`.

---

### Task 1: Repository bootstrap and the Brolusconi repaint

**Files:**
- Create: `.gitignore`
- Create: `extractor/requirements.txt`
- Create: `extractor/extractor/__init__.py`
- Create: `extractor/extractor/repaint.py`
- Test: `extractor/tests/test_repaint.py`

**Interfaces:**
- Consumes: nothing.
- Produces: `extractor.repaint.repaint(img: PIL.Image.Image, mapping: dict = PALETTE_MAP) -> PIL.Image.Image` (new RGBA image; input untouched) and `PALETTE_MAP: dict[tuple[int,int,int], tuple[int,int,int]]`.

- [ ] **Step 1: Initialise git with the asset-protecting `.gitignore`**

Create `.gitignore`:

```gitignore
# Free Lives material: never commit or publish
decompiled/
game-data/
analysis/
# tooling
extractor/.venv/
**/__pycache__/
.pytest_cache/
web/node_modules/
web/dist/
```

Run:

```bash
cd /c/Users/rinal/Desktop/REA-BROFORCE && git init && git status --short
```

Expected: only `.gitignore` and `docs/` listed — no `decompiled/` or `analysis/`.

- [ ] **Step 2: Create the extractor environment**

Create `extractor/requirements.txt`:

```text
UnityPy==1.25.4
Pillow>=10
pytest>=8
```

Create `extractor/extractor/__init__.py`:

```python
"""Extracts Broforce sprites and prefab values for the Brolusconi remake."""
```

Run:

```bash
cd /c/Users/rinal/Desktop/REA-BROFORCE/extractor && python -m venv .venv && .venv/Scripts/python -m pip install -q -r requirements.txt && .venv/Scripts/python -c "import UnityPy; print(UnityPy.__version__)"
```

Expected: `1.25.4`

- [ ] **Step 3: Write the failing repaint tests**

Create `extractor/tests/test_repaint.py`:

```python
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
```

- [ ] **Step 4: Run the tests to see them fail**

Run: `cd /c/Users/rinal/Desktop/REA-BROFORCE/extractor && .venv/Scripts/python -m pytest -q tests/test_repaint.py`
Expected: FAIL — `ModuleNotFoundError: No module named 'extractor.repaint'`

- [ ] **Step 5: Implement the repaint**

Create `extractor/extractor/repaint.py`:

```python
"""Brolusconi: a deterministic colour-to-colour remap of Double Bro Seven's body sheet.

The source palette was measured from 00Bro7_anim (29 colours). Colours not
listed here (black outline, white shirt, gadget effects) are kept.
"""
from PIL import Image

PALETTE_MAP: dict[tuple[int, int, int], tuple[int, int, int]] = {
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


def repaint(img: Image.Image, mapping: dict = PALETTE_MAP) -> Image.Image:
    out = img.convert("RGBA").copy()
    px = out.load()
    width, height = out.size
    for y in range(height):
        for x in range(width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            new = mapping.get((r, g, b))
            if new is not None:
                px[x, y] = (*new, a)
    return out
```

- [ ] **Step 6: Run the tests to see them pass**

Run: `cd /c/Users/rinal/Desktop/REA-BROFORCE/extractor && .venv/Scripts/python -m pytest -q tests/test_repaint.py`
Expected: `4 passed`

- [ ] **Step 7: Commit**

```bash
cd /c/Users/rinal/Desktop/REA-BROFORCE && git add .gitignore docs extractor/requirements.txt extractor/extractor extractor/tests && git commit -m "$(cat <<'EOF'
extractor: project bootstrap and Brolusconi palette repaint

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Extraction catalog and output writer

**Files:**
- Create: `extractor/extractor/catalog.py`
- Create: `extractor/extractor/manifest.py`
- Test: `extractor/tests/test_catalog.py`
- Test: `extractor/tests/test_manifest.py`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `catalog.SpriteRef(key, script, gameobject, whole_sheet, frame=None)`, `catalog.TextureRef(key, texture)`, `catalog.ValuesRef(key, script, gameobject, fields)`; tuples `SPRITES`, `TEXTURES`, `VALUES`, `BUNDLES`, `UNIT_FIELDS`.
  - `manifest.OutputWriter(out_dir)` with `write_png(rel, image, source)`, `write_json(rel, obj, source)`, `finish(meta: dict)`, and `entries: dict[str, dict]`.
  - Output keys used by the web app (Task 12): sprites `brolusconi, mook, mook_suicide, mook_bazooka, prisoner, cage, helicopter, bullet, rocket, bomb, marker, block_dirt, block_brick, block_steel, block_barrel, flagpole, flag, explosion, explosion_small`; values `bro_base, mook, mook_suicide, mook_bazooka, bullet, rocket_mook, bomb, marker, suicide_blast, block_dirt, block_brick, block_steel, block_barrel`.

- [ ] **Step 1: Write the failing tests**

Create `extractor/tests/test_catalog.py`:

```python
from extractor.catalog import SPRITES, TEXTURES, UNIT_FIELDS, VALUES

SPRITE_KEYS = ("bro_base", "mook", "mook_suicide", "mook_bazooka", "prisoner", "cage", "helicopter",
               "bullet", "rocket", "bomb", "marker", "block_dirt", "block_brick", "block_steel",
               "block_barrel", "flagpole", "flag", "explosion", "explosion_small")
VALUE_KEYS = ("bro_base", "mook", "mook_suicide", "mook_bazooka", "bullet", "rocket_mook", "bomb",
              "marker", "suicide_blast", "block_dirt", "block_brick", "block_steel", "block_barrel")


def test_output_keys_are_unique():
    sprite_keys = [s.key for s in SPRITES] + [t.key for t in TEXTURES]
    assert len(sprite_keys) == len(set(sprite_keys))
    value_keys = [v.key for v in VALUES]
    assert len(value_keys) == len(set(value_keys))


def test_everything_the_game_draws_is_extracted():
    keys = {s.key for s in SPRITES} | {t.key for t in TEXTURES}
    assert set(SPRITE_KEYS) <= keys


def test_everything_the_game_simulates_is_extracted():
    assert set(VALUE_KEYS) <= {v.key for v in VALUES}


def test_units_read_all_movement_fields():
    for ref in VALUES:
        if ref.key in ("bro_base", "mook", "mook_suicide", "mook_bazooka"):
            assert ref.fields == UNIT_FIELDS
```

Create `extractor/tests/test_manifest.py`:

```python
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
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `cd /c/Users/rinal/Desktop/REA-BROFORCE/extractor && .venv/Scripts/python -m pytest -q tests/test_catalog.py tests/test_manifest.py`
Expected: FAIL — `ModuleNotFoundError: No module named 'extractor.catalog'`

- [ ] **Step 3: Implement the catalog**

Create `extractor/extractor/catalog.py`:

```python
"""What to extract. Prefab names and scripts were found with REA + UnityPy (see docs/findings.md)."""
from dataclasses import dataclass


@dataclass(frozen=True)
class SpriteRef:
    key: str                 # output name: sprites/<key>.png
    script: str              # MonoBehaviour class on the prefab
    gameobject: str          # prefab GameObject name (first match wins)
    whole_sheet: bool        # True: whole animation sheet; False: crop the prefab's SpriteSM frame
    frame: tuple[int, int, int, int] | None = None  # (x, y_top, w, h) for prefabs without SpriteSM


@dataclass(frozen=True)
class TextureRef:
    key: str
    texture: str             # exact Texture2D name; frames are square (side = texture height)


@dataclass(frozen=True)
class ValuesRef:
    key: str
    script: str
    gameobject: str
    fields: tuple[str, ...]


BUNDLES = ("networkobjects.assetbundle", "sharedtextures.assetbundle", "sharedassets.assetbundle")

UNIT_FIELDS = ("speed", "_jumpForce", "health", "fireRate", "maxFallSpeed", "canWallClimb", "canDash",
               "originalSpecialAmmo")
BULLET_FIELDS = ("damage", "life")
ROCKET_FIELDS = ("damage", "range", "blastForce", "blastForceExtraY", "life")
GRENADE_FIELDS = ("bounceM", "frictionM")

SPRITES = (
    SpriteRef("bro_base", "DoubleBroSeven", "DoubleBroSeven", True),
    SpriteRef("mook", "MookTrooper", "ZMook", True),
    SpriteRef("mook_suicide", "MookSuicide", "ZMookSuicide", True),
    SpriteRef("mook_bazooka", "MookBazooka", "ZMookBazooka", True),
    SpriteRef("prisoner", "RescueBro", "Hobro", True),
    SpriteRef("cage", "Cage", "CageBig", True),
    SpriteRef("helicopter", "Helicopter", "Helicopter", True),
    SpriteRef("rocket", "Rocket", "Rocket", False),
    SpriteRef("bomb", "RocketBombardment", "Rocket Bombardment", False),
    SpriteRef("marker", "GrenadeAirstrike", "Grenade Airstrike", False),
    SpriteRef("block_dirt", "DirtBlock", "Desert Earth", False),
    SpriteRef("block_brick", "BrickBlock", "WallBrick1", False, frame=(0, 0, 16, 16)),
    SpriteRef("block_steel", "SteelBlock", "SteelBlock", False),
    SpriteRef("block_barrel", "BarrelBlock", "Barrel 1", False),
    SpriteRef("flagpole", "CheckPoint", "FlagPole", False),
)

TEXTURES = (
    TextureRef("bullet", "Bullet Enemy"),
    TextureRef("flag", "AmericanFlagTiny"),
    TextureRef("explosion", "ExplosionBallFlame"),
    TextureRef("explosion_small", "ExplosionSmallBall"),
)

VALUES = (
    ValuesRef("bro_base", "DoubleBroSeven", "DoubleBroSeven", UNIT_FIELDS),
    ValuesRef("mook", "MookTrooper", "ZMook", UNIT_FIELDS),
    ValuesRef("mook_suicide", "MookSuicide", "ZMookSuicide", UNIT_FIELDS),
    ValuesRef("mook_bazooka", "MookBazooka", "ZMookBazooka", UNIT_FIELDS),
    ValuesRef("bullet", "Projectile", "Bullet", BULLET_FIELDS),
    ValuesRef("rocket_mook", "RocketSeeking", "Rocket Mook Bazooka", ROCKET_FIELDS),
    ValuesRef("bomb", "RocketBombardment", "Rocket Bombardment", ROCKET_FIELDS),
    ValuesRef("marker", "GrenadeAirstrike", "Grenade Airstrike", GRENADE_FIELDS),
    ValuesRef("suicide_blast", "MookSuicide", "ZMookSuicide", ("range", "blastForce")),
    ValuesRef("block_dirt", "DirtBlock", "Desert Earth", ("health",)),
    ValuesRef("block_brick", "BrickBlock", "WallBrick1", ("health",)),
    ValuesRef("block_steel", "SteelBlock", "SteelBlock", ("health",)),
    ValuesRef("block_barrel", "BarrelBlock", "Barrel 1", ("health", "range")),
)
```

- [ ] **Step 4: Implement the output writer**

Create `extractor/extractor/manifest.py`:

```python
"""Writes extractor outputs and a manifest (sha256 + source per file). The manifest is written last."""
import hashlib
import io
import json
import os

from PIL import Image


class OutputWriter:
    def __init__(self, out_dir: str):
        self.out_dir = out_dir
        self.entries: dict[str, dict] = {}
        os.makedirs(out_dir, exist_ok=True)

    def _record(self, rel: str, data: bytes, source: str) -> None:
        path = os.path.join(self.out_dir, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as fh:
            fh.write(data)
        self.entries[rel.replace(os.sep, "/")] = {"sha256": hashlib.sha256(data).hexdigest(), "source": source}

    def write_png(self, rel: str, image: Image.Image, source: str) -> None:
        buf = io.BytesIO()
        image.save(buf, format="PNG")
        self._record(rel, buf.getvalue(), source)

    def write_json(self, rel: str, obj, source: str) -> None:
        self._record(rel, json.dumps(obj, indent=2, sort_keys=True).encode("utf-8"), source)

    def finish(self, meta: dict) -> None:
        manifest = {"version": 1, **meta, "files": dict(sorted(self.entries.items()))}
        with open(os.path.join(self.out_dir, "manifest.json"), "w", encoding="utf-8") as fh:
            json.dump(manifest, fh, indent=2)
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `cd /c/Users/rinal/Desktop/REA-BROFORCE/extractor && .venv/Scripts/python -m pytest -q`
Expected: `11 passed`

- [ ] **Step 6: Commit**

```bash
cd /c/Users/rinal/Desktop/REA-BROFORCE && git add extractor && git commit -m "$(cat <<'EOF'
extractor: extraction catalog and manifest writer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Unity reader, CLI and the real extraction

**Files:**
- Create: `extractor/extractor/unity.py`
- Create: `extractor/extractor/__main__.py`
- Test: `extractor/tests/test_frames.py`
- Test: `extractor/tests/test_integration.py`
- Generates (not committed): `game-data/`

**Interfaces:**
- Consumes: `catalog.*`, `OutputWriter`, `repaint` (Tasks 1–2).
- Produces:
  - `unity.AssetNotFound(Exception)`, `unity.load_env(streaming_assets: str)`, `unity.Prefabs(env)` with `values(script, gameobject, fields) -> dict`, `sprite(script, gameobject) -> (PIL.Image, frame | None)`, `texture(name) -> PIL.Image`; `unity.frame_from_spritesm(tree: dict) -> dict` returning `{"x", "y_top", "w", "h", "offset_y"}`.
  - `__main__.run(data_dir, out_dir)`, `__main__.main(argv) -> int`, `__main__.sheet_entry(file, width, height, frame) -> dict`, `__main__.plain(value)`.
  - `game-data/sheets.json`: `{ key: { file, frameW, frameH, offsetY, cols, rows } }` for every sprite key plus `brolusconi`.
  - `game-data/values.json`: `{ key: { prefab, script, <fields…> } }` for every values key.

- [ ] **Step 1: Write the failing tests**

Create `extractor/tests/test_frames.py`:

```python
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
```

Create `extractor/tests/test_integration.py`:

```python
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
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `cd /c/Users/rinal/Desktop/REA-BROFORCE/extractor && .venv/Scripts/python -m pytest -q tests/test_frames.py tests/test_integration.py`
Expected: FAIL — `ImportError` (no `extractor.__main__` / `extractor.unity`)

- [ ] **Step 3: Implement the Unity reader**

Create `extractor/extractor/unity.py`:

```python
"""Reads prefabs, sprites and textures from Broforce's asset bundles (read only)."""
import os

import UnityPy

from .catalog import BUNDLES


class AssetNotFound(Exception):
    pass


def load_env(streaming_assets: str):
    paths = [os.path.join(streaming_assets, name) for name in BUNDLES]
    missing = [p for p in paths if not os.path.isfile(p)]
    if missing:
        raise AssetNotFound(f"missing bundles: {missing}")
    return UnityPy.load(*paths)


def frame_from_spritesm(tree: dict) -> dict:
    """SpriteSM.lowerLeftPixel is the frame's bottom-left corner, measured from the top of the texture."""
    ll, dims = tree["lowerLeftPixel"], tree["pixelDimensions"]
    w, h = int(dims["x"]), int(dims["y"])
    return {"x": int(ll["x"]), "y_top": int(ll["y"]) - h, "w": w, "h": h, "offset_y": float(tree["offset"]["y"])}


def _component(ptr):
    return ptr.deref() if hasattr(ptr, "deref") else ptr.component


class Prefabs:
    """Index of MonoBehaviours by (script class, GameObject name); the first match wins."""

    def __init__(self, env):
        self._index: dict[tuple[str, str], tuple] = {}
        self._textures: dict[str, object] = {}
        for obj in env.objects:
            if obj.type.name == "Texture2D":
                try:
                    self._textures.setdefault(obj.peek_name(), obj)
                except Exception:
                    pass
            elif obj.type.name == "MonoBehaviour":
                try:
                    mb = obj.read()
                    script = mb.m_Script.read().m_ClassName
                    go = mb.m_GameObject.read()
                except Exception:
                    continue
                self._index.setdefault((script, go.m_Name), (obj, go))

    def _find(self, script: str, gameobject: str):
        try:
            return self._index[(script, gameobject)]
        except KeyError:
            raise AssetNotFound(f"prefab {gameobject!r} with script {script!r}") from None

    def values(self, script: str, gameobject: str, fields) -> dict:
        obj, _ = self._find(script, gameobject)
        tree = obj.read_typetree()
        missing = [f for f in fields if f not in tree]
        if missing:
            raise AssetNotFound(f"{gameobject!r}: fields {missing} not found on {script}")
        return {f: tree[f] for f in fields}

    def sprite(self, script: str, gameobject: str):
        _, go = self._find(script, gameobject)
        texture, frame = None, None
        for ptr in go.m_Components:
            comp = _component(ptr)
            if comp.type.name == "MeshRenderer" and texture is None:
                for mat_ptr in comp.read().m_Materials:
                    for _, tex_env in mat_ptr.read().m_SavedProperties.m_TexEnvs:
                        if tex_env.m_Texture.m_PathID and texture is None:
                            texture = tex_env.m_Texture.read()
            elif comp.type.name == "MonoBehaviour":
                try:
                    is_sprite = comp.read().m_Script.read().m_ClassName == "SpriteSM"
                except Exception:
                    is_sprite = False
                if is_sprite:
                    frame = frame_from_spritesm(comp.read_typetree())
        if texture is None:
            raise AssetNotFound(f"no texture on prefab {gameobject!r}")
        return texture.image.convert("RGBA"), frame

    def texture(self, name: str):
        try:
            return self._textures[name].read().image.convert("RGBA")
        except KeyError:
            raise AssetNotFound(f"texture {name!r}") from None
```

- [ ] **Step 4: Implement the CLI**

Create `extractor/extractor/__main__.py`:

```python
"""python -m extractor <Broforce_beta_Data dir> <out dir>"""
import argparse
import datetime
import os
import sys

from .catalog import SPRITES, TEXTURES, VALUES
from .manifest import OutputWriter
from .repaint import repaint
from .unity import AssetNotFound, Prefabs, load_env


def plain(value):
    return round(value, 4) if isinstance(value, float) else value


def sheet_entry(file: str, width: int, height: int, frame: dict) -> dict:
    return {"file": file, "frameW": frame["w"], "frameH": frame["h"], "offsetY": frame["offset_y"],
            "cols": width // frame["w"], "rows": height // frame["h"]}


def run(data_dir: str, out_dir: str) -> None:
    stale = os.path.join(out_dir, "manifest.json")
    if os.path.exists(stale):
        os.remove(stale)
    prefabs = Prefabs(load_env(os.path.join(data_dir, "StreamingAssets")))
    out = OutputWriter(out_dir)
    sheets: dict[str, dict] = {}
    for ref in SPRITES:
        image, frame = prefabs.sprite(ref.script, ref.gameobject)
        if ref.frame is not None:
            x, y_top, w, h = ref.frame
            frame = {"x": x, "y_top": y_top, "w": w, "h": h, "offset_y": 0.0}
        if frame is None:
            raise AssetNotFound(f"no SpriteSM frame for {ref.gameobject!r}; add a frame override in catalog.py")
        source = f"{ref.gameobject} ({ref.script})"
        file = f"sprites/{ref.key}.png"
        if ref.whole_sheet:
            out.write_png(file, image, source)
            sheets[ref.key] = sheet_entry(file, image.width, image.height, frame)
        else:
            crop = image.crop((frame["x"], frame["y_top"], frame["x"] + frame["w"], frame["y_top"] + frame["h"]))
            out.write_png(file, crop, source)
            sheets[ref.key] = sheet_entry(file, crop.width, crop.height, frame)
        if ref.key == "bro_base":
            out.write_png("sprites/brolusconi.png", repaint(image), f"repaint of {source}")
            sheets["brolusconi"] = {**sheets["bro_base"], "file": "sprites/brolusconi.png"}
    for ref in TEXTURES:
        image = prefabs.texture(ref.texture)
        file = f"sprites/{ref.key}.png"
        out.write_png(file, image, f"texture {ref.texture}")
        side = image.height
        sheets[ref.key] = sheet_entry(file, image.width, image.height, {"w": side, "h": side, "offset_y": 0.0})
    values = {}
    for ref in VALUES:
        fields = prefabs.values(ref.script, ref.gameobject, ref.fields)
        values[ref.key] = {"prefab": ref.gameobject, "script": ref.script,
                           **{k: plain(v) for k, v in fields.items()}}
    out.write_json("sheets.json", sheets, "SpriteSM frame grids")
    out.write_json("values.json", values, "prefab MonoBehaviour fields")
    out.finish({"generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(), "dataDir": data_dir})


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="extractor", description="Extract Broforce sprites and prefab values")
    parser.add_argument("data_dir", help="path to Broforce_beta_Data")
    parser.add_argument("out_dir", help="output folder, e.g. ../game-data")
    args = parser.parse_args(argv)
    try:
        run(args.data_dir, args.out_dir)
    except AssetNotFound as exc:
        print(f"extractor: {exc}", file=sys.stderr)
        return 1
    print(f"extractor: wrote {args.out_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `cd /c/Users/rinal/Desktop/REA-BROFORCE/extractor && .venv/Scripts/python -m pytest -q`
Expected: `15 passed` (the integration test runs against the real install; it takes a minute or two)

- [ ] **Step 6: Generate `game-data/` and check the repaint by eye**

Run:

```bash
cd /c/Users/rinal/Desktop/REA-BROFORCE/extractor && .venv/Scripts/python -m extractor "C:/Program Files (x86)/Steam/steamapps/common/Broforce/Broforce_beta_Data" ../game-data && ls ../game-data ../game-data/sprites
```

Expected: `extractor: wrote ../game-data`, then `manifest.json sheets.json sprites values.json` and 20 PNGs in `sprites/` (15 prefab sprites, 4 textures, `brolusconi.png`).

Then save a 4× zoom of Brolusconi's first 12 frames and view it:

```bash
cd /c/Users/rinal/Desktop/REA-BROFORCE/extractor && .venv/Scripts/python -I -c "
from PIL import Image
im = Image.open('../game-data/sprites/brolusconi.png').crop((0, 0, 384, 96))
im.resize((im.width * 4, im.height * 4), Image.NEAREST).save('../game-data/brolusconi-preview.png')"
```

Open `game-data/brolusconi-preview.png` (Read tool). Expected: navy suit, blue tie, white shirt, tan skin, near-black hair. If a colour is off, change only its target in `PALETTE_MAP` and rerun this step.

- [ ] **Step 7: Commit**

```bash
cd /c/Users/rinal/Desktop/REA-BROFORCE && git add extractor && git status --short && git commit -m "$(cat <<'EOF'
extractor: Unity prefab reader, CLI and integration test

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

Expected from `git status --short` before the commit: no `game-data/` entries.

---

### Task 4: Web scaffold, constants and game stats

**Files:**
- Create: `web/package.json`, `web/tsconfig.json`, `web/vite.config.ts`, `web/index.html`
- Create: `web/src/engine/constants.ts`
- Create: `web/src/engine/types.ts`
- Create: `web/src/engine/stats.ts`
- Create: `web/src/engine/testStats.ts`
- Test: `web/src/engine/stats.test.ts`

**Interfaces:**
- Consumes: the `values.json` shape from Task 3.
- Produces:
  - Every constant in `constants.ts` (names used verbatim by later tasks).
  - Types in `types.ts`: `Team`, `BlastTeam`, `BlockKind`, `UnitKind`, `ProjectileKind`, `Block`, `UnitStats`, `BulletStats`, `RocketStats`, `GrenadeStats`, `GameStats`, `AiState`, `Unit`, `Projectile`, `Controls`, `NO_CONTROLS`.
  - `parseValues(raw: Record<string, Record<string, unknown>>): GameStats` (throws `Error` naming the missing `key.field`).
  - Test fixtures `TEST_STATS: GameStats` and `RAW_VALUES` (real extracted numbers).

- [ ] **Step 1: Scaffold the Vite + React + TypeScript project**

Create `web/package.json`:

```json
{
  "name": "brolusconi",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "18.3.1",
    "react-dom": "18.3.1"
  },
  "devDependencies": {
    "@types/react": "18.3.18",
    "@types/react-dom": "18.3.5",
    "@vitejs/plugin-react": "4.3.4",
    "typescript": "5.7.2",
    "vite": "6.0.7",
    "vitest": "2.1.8"
  }
}
```

Create `web/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src", "vite.config.ts"]
}
```

Create `web/vite.config.ts`:

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// game-data/ (extracted locally, never committed) is served as the site root.
export default defineConfig({
  plugins: [react()],
  publicDir: '../game-data',
  test: { environment: 'node' },
});
```

Create `web/index.html`:

```html
<!doctype html>
<html lang="it">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Broforce: Brolusconi</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Run: `cd /c/Users/rinal/Desktop/REA-BROFORCE/web && npm install`
Expected: `added … packages`, no errors.

- [ ] **Step 2: Add the constants and types**

Create `web/src/engine/constants.ts`:

```ts
// Values ported from Broforce's decompiled Assembly-CSharp. Each cites its source; see docs/findings.md.
export const TILE = 16; // Map.TileSize
export const HALF_TILE = 8; // Map.HalfTileSize
export const GRAVITY = 1100; // TestVanDammeAnim.ApplyNormalGravity
export const FIXED_DT = 1 / 60;
export const ACCEL_M = 2; // TestVanDammeAnim.AddSpeedLeft/Right: speed * 2 * t
export const DASH_ACCEL_M = 4; // ... * 4 while dashing
export const LOW_SPEED_ACCEL_M = 2.6; // AddSpeed*: extra speed * 2.6 * t while |xI| < 50
export const LOW_SPEED_THRESHOLD = 50;
export const MIN_START_SPEED = 25; // AddSpeed*: xI snaps to ±25 when starting to run
export const DASH_SPEED_M = 1.33; // TestVanDammeAnim.dashSpeedM
export const GROUND_FRICTION_M = 10; // TestVanDammeAnim.frictionM
export const JUMP_GRACE = 0.1; // TestVanDammeAnim.Jump: realtimeSinceStartup - lastLandTime < 0.1
export const WALL_CLIMB_BOOST = 190; // TestVanDammeAnim.AnimateWallClimb: yI = 190 on frame 1
export const WALL_CLIMB_GRAVITY_M = 0.66; // TestVanDammeAnim.ApplyWallClimbingGravity
export const WALL_CLIMB_CYCLE = 8 * 0.033; // AnimateWallClimb: 8 frames at frameRate 0.033
export const UNIT_HALF_WIDTH = 6; // TestVanDammeAnim.halfWidth
export const UNIT_HEIGHT = 15; // Unit.headHeight
export const MOOK_BULLET_SPEED = 250; // Mook.UseFire
export const BAZOOKA_ROCKET_SPEED = 100; // MookBazooka.UseFire
export const BAZOOKA_FIRE_DELAY = 1.4; // MookBazooka.FireWeapon: fireDelay = 1.4
export const SIGHT_X = 300; // EnemyAI.sightRangeX
export const SIGHT_Y = 20; // EnemyAI.sightRangeY
export const MIN_KNOCK_DIST = 65; // Map.ExplodeUnits: distance clamped to 65 for knock-only
export const AIRSTRIKE_THROW = { x: 200, y: 150, ox: 8, oy: 8 }; // BroBase.UseSpecial
export const AIRSTRIKE_THROW_DUCK = { x: 30, y: 70, ox: 6, oy: 3 }; // BroBase.UseSpecial (ducking)
export const AIRSTRIKE_ROCKETS = [580, 540, 500, 460, 420]; // GrenadeAirstrike.Death y offsets
export const AIRSTRIKE_X_OFFSET = 480; // GrenadeAirstrike.Death: X - 480 - h
export const AIRSTRIKE_SPEED_MIN = 200; // GrenadeAirstrike.Death: 200 + random * 30
export const AIRSTRIKE_SPEED_RAND = 30;
export const SUICIDE_GROUND_DAMAGE = 10; // MookSuicide.MakeEffects: DamageGround(10, range)
export const SUICIDE_UNIT_DAMAGE = 9; // MookSuicide.MakeEffects: ExplodeUnits(9, range, range, blastForce * 40, 300)
export const SUICIDE_FORCE_M = 40;
export const SUICIDE_EXTRA_Y = 300;
export const SUICIDE_FUSE_MIN = 0.6; // MookSuicide.Start: deathCounter = 0.6 + random * 0.2
export const SUICIDE_FUSE_RAND = 0.2;
export const BARREL_GROUND_DAMAGE = 12; // BarrelBlock: DamageGround(12, range)
export const BARREL_UNIT_DAMAGE = 12; // BarrelBlock: ExplodeUnits(12, range * 1.2, range, ..., 200, 300)
export const BARREL_UNIT_RANGE_M = 1.2;
export const BARREL_FORCE = 200;
export const BARREL_EXTRA_Y = 300;
export const BARREL_Y_OFFSET = -6; // BarrelBlock: ExplodeUnits at Y - 6
export const RUN_FRAME_RATE = 0.025; // TestVanDammeAnim.runningFrameRate
export const JUMP_FRAME_RATE = 0.0334; // TestVanDammeAnim.AnimateDeath/Jumping frameRate
export const CLIMB_FRAME_RATE = 0.033; // TestVanDammeAnim.AnimateWallClimb

// Design values (not in the original game). Tuned in playtesting; listed in docs/findings.md.
export const FOOTBALL = {
  kickX: 220, kickY: 160, bounceM: 0.7, frictionM: 0.85, maxBounces: 3, fuse: 1.6,
  damage: 5, range: 32, blastForce: 20, blastForceExtraY: 300,
};
export const AIRSTRIKE_FUSE = 1.0;
export const LIVES_START = 3;
export const MOOK_BURST = 3;
export const MOOK_BURST_PAUSE = 1.0;
export const MOOK_REACTION = 0.4;
export const PATROL_TURN_TIME = 2.5;
export const LOST_SIGHT_TIME = 2.0;
export const SUICIDE_TRIGGER_DX = 20;
export const SUICIDE_TRIGGER_DY = 16;
export const PRISONER_RESCUE_DIST = 16;
export const FLAG_REACH = 12;
export const RESPAWN_DELAY = 1.5;
export const CORPSE_TIME = 3;
export const EXTRACTION_TIME = 3;
export const EXPLOSION_DURATION = 0.5;
export const SPEECH_DURATION = 2.2;
export const CAMERA_LERP = 6;
export const CAMERA_Y_OFFSET = 40;
export const SHAKE_TIME = 0.2;
export const SHAKE_AMOUNT = 2;
```

Create `web/src/engine/types.ts`:

```ts
export type Team = 'player' | 'enemy';
export type BlastTeam = Team | 'neutral';
export type BlockKind = 'dirt' | 'brick' | 'steel' | 'barrel';
export type UnitKind = 'bro' | 'mook' | 'mook_suicide' | 'mook_bazooka';
export type ProjectileKind = 'bullet' | 'rocket' | 'bomb' | 'football' | 'marker';

export interface Block {
  kind: BlockKind;
  health: number;
}

export interface UnitStats {
  speed: number;
  jumpForce: number;
  health: number;
  fireRate: number;
  maxFallSpeed: number;
  canWallClimb: boolean;
  canDash: boolean;
  specialAmmo: number;
}

export interface BulletStats {
  damage: number;
  life: number;
}

export interface RocketStats {
  damage: number;
  range: number;
  blastForce: number;
  blastForceExtraY: number;
  life: number;
}

export interface GrenadeStats {
  bounceM: number;
  frictionM: number;
}

export interface GameStats {
  units: Record<UnitKind, UnitStats>;
  bullet: BulletStats;
  rocketMook: RocketStats;
  bomb: RocketStats;
  marker: GrenadeStats;
  blocks: Record<BlockKind, { health: number }>;
  barrelRange: number;
  suicide: { range: number; blastForce: number };
}

export interface AiState {
  mode: 'idle' | 'alert' | 'charging' | 'exploded';
  reaction: number;
  burstLeft: number;
  cooldown: number;
  fuse: number;
  patrolTimer: number;
  lostSight: number;
}

export interface Unit {
  id: number;
  kind: UnitKind;
  team: Team;
  x: number; // feet position, world units
  y: number;
  xI: number; // velocity, named as in Broforce
  yI: number;
  facing: 1 | -1;
  health: number;
  stats: UnitStats;
  onGround: boolean;
  lastGroundedTime: number;
  wallClimbing: boolean;
  climbTimer: number;
  dashing: boolean;
  fireCooldown: number;
  dead: boolean;
  deadTime: number;
  animTime: number;
  ai: AiState | null;
}

export interface Projectile {
  id: number;
  kind: ProjectileKind;
  team: Team;
  x: number;
  y: number;
  xI: number;
  yI: number;
  life: number;
  bounces: number;
  dead: boolean;
}

export interface Controls {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
  fire: boolean;
  special: boolean;
  dash: boolean;
}

export const NO_CONTROLS: Controls = {
  left: false, right: false, up: false, down: false, jump: false, fire: false, special: false, dash: false,
};
```

- [ ] **Step 3: Write the fixtures and the failing stats test**

Create `web/src/engine/testStats.ts`:

```ts
import type { GameStats } from './types';

/** values.json as extracted from the real install (Task 3). */
export const RAW_VALUES: Record<string, Record<string, unknown>> = {
  bro_base: { speed: 110, _jumpForce: 260, health: 1, fireRate: 0.27, maxFallSpeed: -400, canWallClimb: 1, canDash: 1, originalSpecialAmmo: 4 },
  mook: { speed: 70, _jumpForce: 200, health: 3, fireRate: 0.17, maxFallSpeed: -400, canWallClimb: 0, canDash: 0, originalSpecialAmmo: 3 },
  mook_suicide: { speed: 70, _jumpForce: 200, health: 3, fireRate: 0.1, maxFallSpeed: -400, canWallClimb: 0, canDash: 0, originalSpecialAmmo: 3 },
  mook_bazooka: { speed: 70, _jumpForce: 200, health: 4, fireRate: 0.17, maxFallSpeed: -400, canWallClimb: 0, canDash: 0, originalSpecialAmmo: 3 },
  bullet: { damage: 1, life: 0.45 },
  rocket_mook: { damage: 10, range: 28, blastForce: 20, blastForceExtraY: 300, life: 3 },
  bomb: { damage: 10, range: 28, blastForce: 20, blastForceExtraY: 300, life: 5 },
  marker: { bounceM: 0.4, frictionM: 0.6 },
  suicide_blast: { range: 40, blastForce: 20 },
  block_dirt: { health: 5 },
  block_brick: { health: 5 },
  block_steel: { health: 500000 },
  block_barrel: { health: 1, range: 50 },
};

export const TEST_STATS: GameStats = {
  units: {
    bro: { speed: 110, jumpForce: 260, health: 1, fireRate: 0.27, maxFallSpeed: -400, canWallClimb: true, canDash: true, specialAmmo: 4 },
    mook: { speed: 70, jumpForce: 200, health: 3, fireRate: 0.17, maxFallSpeed: -400, canWallClimb: false, canDash: false, specialAmmo: 3 },
    mook_suicide: { speed: 70, jumpForce: 200, health: 3, fireRate: 0.1, maxFallSpeed: -400, canWallClimb: false, canDash: false, specialAmmo: 3 },
    mook_bazooka: { speed: 70, jumpForce: 200, health: 4, fireRate: 0.17, maxFallSpeed: -400, canWallClimb: false, canDash: false, specialAmmo: 3 },
  },
  bullet: { damage: 1, life: 0.45 },
  rocketMook: { damage: 10, range: 28, blastForce: 20, blastForceExtraY: 300, life: 3 },
  bomb: { damage: 10, range: 28, blastForce: 20, blastForceExtraY: 300, life: 5 },
  marker: { bounceM: 0.4, frictionM: 0.6 },
  blocks: { dirt: { health: 5 }, brick: { health: 5 }, steel: { health: 500000 }, barrel: { health: 1 } },
  barrelRange: 50,
  suicide: { range: 40, blastForce: 20 },
};
```

Create `web/src/engine/stats.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseValues } from './stats';
import { RAW_VALUES, TEST_STATS } from './testStats';

describe('parseValues', () => {
  it('maps values.json onto GameStats', () => {
    expect(parseValues(RAW_VALUES)).toEqual(TEST_STATS);
  });

  it('names the missing field', () => {
    const raw = { ...RAW_VALUES, bomb: { damage: 10 } };
    expect(() => parseValues(raw)).toThrow('bomb.range');
  });

  it('rejects non-numeric values', () => {
    const raw = { ...RAW_VALUES, bullet: { damage: 'x', life: 0.45 } };
    expect(() => parseValues(raw)).toThrow('bullet.damage');
  });
});
```

- [ ] **Step 4: Run the test to see it fail**

Run: `cd /c/Users/rinal/Desktop/REA-BROFORCE/web && npx vitest run src/engine/stats.test.ts`
Expected: FAIL — `Failed to resolve import "./stats"`

- [ ] **Step 5: Implement `parseValues`**

Create `web/src/engine/stats.ts`:

```ts
import type { GameStats, RocketStats, UnitStats } from './types';

type Raw = Record<string, Record<string, unknown>>;

function num(raw: Raw, key: string, field: string): number {
  const value = raw[key]?.[field];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`values.json: ${key}.${field} is missing or not a number`);
  }
  return value;
}

function unit(raw: Raw, key: string): UnitStats {
  return {
    speed: num(raw, key, 'speed'),
    jumpForce: num(raw, key, '_jumpForce'),
    health: num(raw, key, 'health'),
    fireRate: num(raw, key, 'fireRate'),
    maxFallSpeed: num(raw, key, 'maxFallSpeed'),
    canWallClimb: num(raw, key, 'canWallClimb') !== 0,
    canDash: num(raw, key, 'canDash') !== 0,
    specialAmmo: num(raw, key, 'originalSpecialAmmo'),
  };
}

function rocket(raw: Raw, key: string): RocketStats {
  return {
    damage: num(raw, key, 'damage'),
    range: num(raw, key, 'range'),
    blastForce: num(raw, key, 'blastForce'),
    blastForceExtraY: num(raw, key, 'blastForceExtraY'),
    life: num(raw, key, 'life'),
  };
}

export function parseValues(raw: Raw): GameStats {
  return {
    units: {
      bro: unit(raw, 'bro_base'),
      mook: unit(raw, 'mook'),
      mook_suicide: unit(raw, 'mook_suicide'),
      mook_bazooka: unit(raw, 'mook_bazooka'),
    },
    bullet: { damage: num(raw, 'bullet', 'damage'), life: num(raw, 'bullet', 'life') },
    rocketMook: rocket(raw, 'rocket_mook'),
    bomb: rocket(raw, 'bomb'),
    marker: { bounceM: num(raw, 'marker', 'bounceM'), frictionM: num(raw, 'marker', 'frictionM') },
    blocks: {
      dirt: { health: num(raw, 'block_dirt', 'health') },
      brick: { health: num(raw, 'block_brick', 'health') },
      steel: { health: num(raw, 'block_steel', 'health') },
      barrel: { health: num(raw, 'block_barrel', 'health') },
    },
    barrelRange: num(raw, 'block_barrel', 'range'),
    suicide: { range: num(raw, 'suicide_blast', 'range'), blastForce: num(raw, 'suicide_blast', 'blastForce') },
  };
}
```

- [ ] **Step 6: Run the tests and the typecheck**

Run: `cd /c/Users/rinal/Desktop/REA-BROFORCE/web && npx vitest run src/engine/stats.test.ts && npx tsc --noEmit`
Expected: `3 passed`; tsc prints nothing.

- [ ] **Step 7: Commit**

```bash
cd /c/Users/rinal/Desktop/REA-BROFORCE && git add web/package.json web/package-lock.json web/tsconfig.json web/vite.config.ts web/index.html web/src && git commit -m "$(cat <<'EOF'
web: scaffold, ported constants and game stats parsing

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Tile map

**Files:**
- Create: `web/src/engine/map.ts`
- Test: `web/src/engine/map.test.ts`

**Interfaces:**
- Consumes: `TILE`, `HALF_TILE`, `Block`, `BlockKind`, `GameStats`, `TEST_STATS` (Task 4).
- Produces: `getColumn(x)`, `getRow(y)`, `cellLeft(c)`, `cellBottom(r)`, `makeBlock(kind, stats): Block`, and `class TileMap(cols, rows)` with `inBounds`, `get(c, r)`, `set(c, r, block)`, `isSolid(c, r)`, `solidAt(x, y)`, `blockAt(x, y)`, `boxHitsSolid(left, bottom, right, top)`, `damage(c, r, amount): BlockKind | null`, `cellsInCircle(x, y, radius): Array<[number, number]>`.

- [ ] **Step 1: Write the failing tests**

Create `web/src/engine/map.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { TileMap, cellBottom, cellLeft, getColumn, getRow, makeBlock } from './map';
import { TEST_STATS } from './testStats';

function filled(cols: number, rows: number): TileMap {
  const m = new TileMap(cols, rows);
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) m.set(c, r, makeBlock('dirt', TEST_STATS));
  return m;
}

describe('grid conversion (Map.GetCollumn / Map.GetRow)', () => {
  it('centres cell c on x = c * 16', () => {
    expect(getColumn(0)).toBe(0);
    expect(getColumn(7.9)).toBe(0);
    expect(getColumn(8)).toBe(1);
    expect(getColumn(-8)).toBe(0);
    expect(getRow(23.9)).toBe(1);
    expect(getRow(24)).toBe(2);
    expect(cellLeft(1)).toBe(8);
    expect(cellBottom(2)).toBe(24);
  });
});

describe('TileMap', () => {
  it('stores blocks and rejects writes outside the grid', () => {
    const m = new TileMap(4, 3);
    m.set(1, 2, makeBlock('brick', TEST_STATS));
    expect(m.get(1, 2)).toEqual({ kind: 'brick', health: 5 });
    expect(() => m.set(4, 0, null)).toThrow(RangeError);
  });

  it('treats the side edges as walls and above/below as open air', () => {
    const m = new TileMap(4, 3);
    expect(m.isSolid(-1, 1)).toBe(true);
    expect(m.isSolid(4, 1)).toBe(true);
    expect(m.isSolid(1, -1)).toBe(false);
    expect(m.isSolid(1, 3)).toBe(false);
  });

  it('blockAt ignores the side walls (projectiles fly in from outside)', () => {
    const m = new TileMap(4, 3);
    expect(m.blockAt(-50, 10)).toBeNull();
  });

  it('destroys a block when its health reaches zero and reports the kind', () => {
    const m = new TileMap(2, 2);
    m.set(0, 0, makeBlock('dirt', TEST_STATS));
    expect(m.damage(0, 0, 4)).toBeNull();
    expect(m.damage(0, 0, 1)).toBe('dirt');
    expect(m.get(0, 0)).toBeNull();
  });

  it('steel survives heavy damage', () => {
    const m = new TileMap(1, 1);
    m.set(0, 0, makeBlock('steel', TEST_STATS));
    expect(m.damage(0, 0, 1000)).toBeNull();
  });

  it('finds blocks whose box touches a circle', () => {
    const m = filled(10, 10);
    expect(m.cellsInCircle(80, 80, 14)).toHaveLength(9); // cell (5,5) and its 8 neighbours
    expect(m.cellsInCircle(80, 80, 7)).toHaveLength(1);
  });

  it('boxHitsSolid treats the right and top edges as exclusive', () => {
    const m = new TileMap(5, 5);
    m.set(2, 0, makeBlock('dirt', TEST_STATS)); // spans x 24..40, y -8..8
    expect(m.boxHitsSolid(12, 8, 24, 23)).toBe(false);
    expect(m.boxHitsSolid(12, 7, 25, 23)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `cd /c/Users/rinal/Desktop/REA-BROFORCE/web && npx vitest run src/engine/map.test.ts`
Expected: FAIL — `Failed to resolve import "./map"`

- [ ] **Step 3: Implement the map**

Create `web/src/engine/map.ts`:

```ts
import { HALF_TILE, TILE } from './constants';
import type { Block, BlockKind, GameStats } from './types';

const EPS = 0.001;

// Map.GetCollumn / Map.GetRow: (int)((v + 8) * 0.0625). Math.floor matches for v >= -8.
export const getColumn = (x: number): number => Math.floor((x + HALF_TILE) / TILE);
export const getRow = (y: number): number => Math.floor((y + HALF_TILE) / TILE);
export const cellLeft = (c: number): number => c * TILE - HALF_TILE;
export const cellBottom = (r: number): number => r * TILE - HALF_TILE;

export function makeBlock(kind: BlockKind, stats: GameStats): Block {
  return { kind, health: stats.blocks[kind].health };
}

export class TileMap {
  private readonly cells: (Block | null)[];

  constructor(readonly cols: number, readonly rows: number) {
    this.cells = new Array<Block | null>(cols * rows).fill(null);
  }

  inBounds(c: number, r: number): boolean {
    return c >= 0 && c < this.cols && r >= 0 && r < this.rows;
  }

  get(c: number, r: number): Block | null {
    return this.inBounds(c, r) ? this.cells[r * this.cols + c] : null;
  }

  set(c: number, r: number, block: Block | null): void {
    if (!this.inBounds(c, r)) throw new RangeError(`cell ${c},${r} is outside ${this.cols}x${this.rows}`);
    this.cells[r * this.cols + c] = block;
  }

  /** For units: the side edges are walls; above the top and below the bottom is open air. */
  isSolid(c: number, r: number): boolean {
    if (c < 0 || c >= this.cols) return true;
    return this.get(c, r) !== null;
  }

  solidAt(x: number, y: number): boolean {
    return this.isSolid(getColumn(x), getRow(y));
  }

  /** For projectiles: only real blocks count, so airstrike bombs can fly in from outside the map. */
  blockAt(x: number, y: number): Block | null {
    return this.get(getColumn(x), getRow(y));
  }

  /** True if any solid cell overlaps the box; the right and top edges are exclusive. */
  boxHitsSolid(left: number, bottom: number, right: number, top: number): boolean {
    for (let c = getColumn(left); c <= getColumn(right - EPS); c++) {
      for (let r = getRow(bottom); r <= getRow(top - EPS); r++) {
        if (this.isSolid(c, r)) return true;
      }
    }
    return false;
  }

  /** Applies damage; returns the kind if the block was destroyed. */
  damage(c: number, r: number, amount: number): BlockKind | null {
    const block = this.get(c, r);
    if (!block) return null;
    block.health -= amount;
    if (block.health > 0) return null;
    this.cells[r * this.cols + c] = null;
    return block.kind;
  }

  /** Blocks whose 16x16 box intersects the circle (MapController.DamageGround's OverlapSphere). */
  cellsInCircle(x: number, y: number, radius: number): Array<[number, number]> {
    const out: Array<[number, number]> = [];
    for (let c = getColumn(x - radius); c <= getColumn(x + radius); c++) {
      for (let r = getRow(y - radius); r <= getRow(y + radius); r++) {
        if (!this.get(c, r)) continue;
        const nx = Math.min(Math.max(x, cellLeft(c)), cellLeft(c) + TILE);
        const ny = Math.min(Math.max(y, cellBottom(r)), cellBottom(r) + TILE);
        if ((nx - x) ** 2 + (ny - y) ** 2 < radius * radius) out.push([c, r]);
      }
    }
    return out;
  }
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `cd /c/Users/rinal/Desktop/REA-BROFORCE/web && npx vitest run src/engine/map.test.ts`
Expected: `8 passed`

- [ ] **Step 5: Commit**

```bash
cd /c/Users/rinal/Desktop/REA-BROFORCE && git add web/src/engine/map.ts web/src/engine/map.test.ts && git commit -m "$(cat <<'EOF'
engine: 16 px tile map with Broforce grid conversion

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Units and ported movement physics

**Files:**
- Create: `web/src/engine/units.ts`
- Create: `web/src/engine/physics.ts`
- Test: `web/src/engine/physics.test.ts`

**Interfaces:**
- Consumes: constants, types, `TileMap`, `makeBlock`, `cellLeft`, `cellBottom`, `getColumn`, `getRow`, `TEST_STATS`.
- Produces:
  - `makeUnit(id, kind, team, x, y, stats): Unit` (enemies start with an idle `AiState`, `patrolTimer: 2`), `damageUnit(u, amount): boolean` (true when this damage killed it), `knock(u, kx, ky)`.
  - `MoveIntent { dir: -1|0|1; jumpPressed; jumpHeld; dash }`, `NO_INTENT`, `unitHitsSolid(map, x, y)`, `touchesWall(u, dir, map)`, `stepUnit(u, intent, map, t, now)`.

- [ ] **Step 1: Write the failing tests**

Create `web/src/engine/physics.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { FIXED_DT } from './constants';
import { TileMap, makeBlock } from './map';
import { NO_INTENT, stepUnit, type MoveIntent } from './physics';
import { TEST_STATS } from './testStats';
import { makeUnit } from './units';
import type { Unit } from './types';

function floorMap(cols = 30, rows = 12): TileMap {
  const m = new TileMap(cols, rows);
  for (let c = 0; c < cols; c++) m.set(c, 0, makeBlock('dirt', TEST_STATS)); // floor top at y = 8
  return m;
}
const bro = (x = 80, y = 8): Unit => makeUnit(1, 'bro', 'player', x, y, TEST_STATS.units.bro);
function run(u: Unit, map: TileMap, intent: MoveIntent, frames: number, start = 0): number {
  let now = start;
  for (let i = 0; i < frames; i++) {
    now += FIXED_DT;
    stepUnit(u, intent, map, FIXED_DT, now);
  }
  return now;
}

describe('stepUnit (TestVanDammeAnim movement)', () => {
  it('stands still on the floor', () => {
    const u = bro();
    run(u, floorMap(), NO_INTENT, 60);
    expect(u.y).toBe(8);
    expect(u.onGround).toBe(true);
  });

  it('lands with its feet on top of the block below', () => {
    const u = bro(80, 40);
    run(u, floorMap(), NO_INTENT, 60);
    expect(u.y).toBeCloseTo(8, 6);
    expect(u.onGround).toBe(true);
  });

  it('jumps about jumpForce² / (2·gravity) high', () => {
    const u = bro();
    const map = floorMap();
    let now = run(u, map, { ...NO_INTENT, jumpPressed: true, jumpHeld: true }, 1);
    let apex = u.y;
    for (let i = 0; i < 60; i++) {
      now = run(u, map, NO_INTENT, 1, now);
      apex = Math.max(apex, u.y);
    }
    // analytic 260² / 2200 = 30.7; explicit Euler at 60 Hz peaks a little lower
    expect(apex - 8).toBeGreaterThan(27);
    expect(apex - 8).toBeLessThan(31.5);
  });

  it('caps the fall speed at maxFallSpeed', () => {
    const u = bro(80, 150);
    run(u, new TileMap(30, 12), NO_INTENT, 120);
    expect(u.yI).toBe(-400);
  });

  it('accelerates to its run speed and no further', () => {
    const u = bro();
    run(u, floorMap(60), { ...NO_INTENT, dir: 1 }, 60);
    expect(u.xI).toBe(110);
  });

  it('runs 1.33x faster while dashing', () => {
    const u = bro();
    run(u, floorMap(60), { ...NO_INTENT, dir: 1, dash: true }, 60);
    expect(u.xI).toBeCloseTo(146.3, 5);
  });

  it('ground friction stops it within half a second', () => {
    const u = bro();
    u.xI = 110;
    run(u, floorMap(60), NO_INTENT, 30);
    expect(Math.abs(u.xI)).toBeLessThan(1);
  });

  it('stops at a wall', () => {
    const map = floorMap();
    for (let r = 1; r <= 5; r++) map.set(8, r, makeBlock('dirt', TEST_STATS)); // wall face at x = 120
    const u = bro();
    run(u, map, { ...NO_INTENT, dir: 1 }, 60);
    expect(u.x).toBeCloseTo(114, 2);
    expect(u.xI).toBe(0);
  });

  it('cannot leave the map through its side edges', () => {
    const u = bro(10);
    run(u, floorMap(), { ...NO_INTENT, dir: -1 }, 60);
    expect(u.x).toBeGreaterThanOrEqual(-2.01); // left edge of column 0 is x = -8; half width 6
  });

  it('allows a jump within 0.1 s of leaving the ground', () => {
    const u = bro(80, 30);
    u.lastGroundedTime = 0.95;
    stepUnit(u, { ...NO_INTENT, jumpPressed: true, jumpHeld: true }, new TileMap(30, 12), FIXED_DT, 1.0);
    expect(u.yI).toBeGreaterThan(200);
  });

  it('refuses a late jump', () => {
    const u = bro(80, 30);
    u.lastGroundedTime = 0.8;
    stepUnit(u, { ...NO_INTENT, jumpPressed: true, jumpHeld: true }, new TileMap(30, 12), FIXED_DT, 1.0);
    expect(u.yI).toBeLessThan(0);
  });

  it('climbs a wall while holding jump against it', () => {
    const map = floorMap();
    for (let r = 1; r <= 11; r++) map.set(8, r, makeBlock('dirt', TEST_STATS));
    const u = bro(113.9, 40);
    run(u, map, { dir: 1, jumpPressed: false, jumpHeld: true, dash: false }, 60);
    expect(u.y).toBeGreaterThan(40 + 32); // ~4 boosts of 190 in 1 s climb about 90 units
  });

  it('mooks cannot wall-climb', () => {
    const map = floorMap();
    for (let r = 1; r <= 11; r++) map.set(8, r, makeBlock('dirt', TEST_STATS));
    const m = makeUnit(2, 'mook', 'enemy', 113.9, 40, TEST_STATS.units.mook);
    run(m, map, { dir: 1, jumpPressed: false, jumpHeld: true, dash: false }, 60);
    expect(m.y).toBeCloseTo(8, 6);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `cd /c/Users/rinal/Desktop/REA-BROFORCE/web && npx vitest run src/engine/physics.test.ts`
Expected: FAIL — `Failed to resolve import "./physics"`

- [ ] **Step 3: Implement units**

Create `web/src/engine/units.ts`:

```ts
import type { Team, Unit, UnitKind, UnitStats } from './types';

export function makeUnit(id: number, kind: UnitKind, team: Team, x: number, y: number, stats: UnitStats): Unit {
  return {
    id, kind, team, x, y, xI: 0, yI: 0,
    facing: team === 'player' ? 1 : -1,
    health: stats.health, stats,
    onGround: false, lastGroundedTime: -Infinity,
    wallClimbing: false, climbTimer: 0, dashing: false,
    fireCooldown: 0, dead: false, deadTime: 0, animTime: 0,
    ai: team === 'enemy'
      ? { mode: 'idle', reaction: 0, burstLeft: 0, cooldown: 0, fuse: 0, patrolTimer: 2, lostSight: 0 }
      : null,
  };
}

/** Returns true when this damage killed the unit. */
export function damageUnit(u: Unit, amount: number): boolean {
  if (u.dead || amount <= 0) return false;
  u.health -= amount;
  if (u.health > 0) return false;
  u.dead = true;
  u.deadTime = 0;
  u.wallClimbing = false;
  return true;
}

export function knock(u: Unit, kx: number, ky: number): void {
  u.xI += kx;
  u.yI += ky;
  u.onGround = false;
}
```

- [ ] **Step 4: Implement the physics**

Create `web/src/engine/physics.ts`:

```ts
import {
  ACCEL_M, DASH_ACCEL_M, DASH_SPEED_M, GRAVITY, GROUND_FRICTION_M, JUMP_GRACE, LOW_SPEED_ACCEL_M,
  LOW_SPEED_THRESHOLD, MIN_START_SPEED, TILE, UNIT_HALF_WIDTH, UNIT_HEIGHT, WALL_CLIMB_BOOST,
  WALL_CLIMB_CYCLE, WALL_CLIMB_GRAVITY_M,
} from './constants';
import { TileMap, cellBottom, cellLeft, getColumn, getRow } from './map';
import type { Unit } from './types';

export interface MoveIntent {
  dir: -1 | 0 | 1;
  jumpPressed: boolean;
  jumpHeld: boolean;
  dash: boolean;
}

export const NO_INTENT: MoveIntent = { dir: 0, jumpPressed: false, jumpHeld: false, dash: false };

const EPS = 0.001;

export function unitHitsSolid(map: TileMap, x: number, y: number): boolean {
  return map.boxHitsSolid(x - UNIT_HALF_WIDTH, y, x + UNIT_HALF_WIDTH, y + UNIT_HEIGHT);
}

export function touchesWall(u: Unit, dir: -1 | 1, map: TileMap): boolean {
  return unitHitsSolid(map, u.x + dir, u.y + 1);
}

/** TestVanDammeAnim.AddSpeedLeft/Right, plus ground friction when there's no input. */
function runHorizontal(u: Unit, dir: -1 | 0 | 1, t: number): void {
  if (dir === 0) {
    if (u.onGround) u.xI *= 1 - Math.min(1, t * GROUND_FRICTION_M);
    return;
  }
  u.facing = dir;
  const max = u.stats.speed * (u.dashing ? DASH_SPEED_M : 1);
  if (u.xI * dir < MIN_START_SPEED) u.xI = dir * MIN_START_SPEED;
  u.xI += dir * u.stats.speed * (u.dashing ? DASH_ACCEL_M : ACCEL_M) * t;
  if (u.xI * dir > max) u.xI = dir * max;
  else if (u.xI * dir < LOW_SPEED_THRESHOLD) u.xI += dir * u.stats.speed * LOW_SPEED_ACCEL_M * t;
}

function moveAndCollide(u: Unit, map: TileMap, t: number, now: number): void {
  const nx = u.x + u.xI * t;
  if (unitHitsSolid(map, nx, u.y)) {
    if (u.xI > 0) u.x = cellLeft(getColumn(nx + UNIT_HALF_WIDTH)) - UNIT_HALF_WIDTH - EPS;
    else if (u.xI < 0) u.x = cellLeft(getColumn(nx - UNIT_HALF_WIDTH)) + TILE + UNIT_HALF_WIDTH + EPS;
    u.xI = 0;
  } else {
    u.x = nx;
  }
  const ny = u.y + u.yI * t;
  if (unitHitsSolid(map, u.x, ny)) {
    if (u.yI <= 0) {
      u.y = cellBottom(getRow(ny)) + TILE;
      u.onGround = true;
      u.lastGroundedTime = now;
    } else {
      u.y = cellBottom(getRow(ny + UNIT_HEIGHT)) - UNIT_HEIGHT - EPS;
    }
    u.yI = 0;
  } else {
    u.y = ny;
  }
}

/**
 * One fixed step of TestVanDammeAnim-style movement. Simplified: no water, quicksand, ladders,
 * ziplines, parachutes, air dash or wall drag (see docs/findings.md).
 */
export function stepUnit(u: Unit, intent: MoveIntent, map: TileMap, t: number, now: number): void {
  u.animTime += t;
  u.onGround = u.yI <= 0 && unitHitsSolid(map, u.x, u.y - 0.5);
  if (u.onGround) {
    u.lastGroundedTime = now;
    if (u.yI < 0) u.yI = 0;
    u.dashing = intent.dash && u.stats.canDash && intent.dir !== 0;
  }
  runHorizontal(u, intent.dir, t);
  if (intent.jumpPressed && u.yI <= 0 && (u.onGround || now - u.lastGroundedTime < JUMP_GRACE)) {
    u.yI = u.stats.jumpForce;
    u.onGround = false;
    u.lastGroundedTime = -Infinity;
  }
  const climbing = !u.onGround && u.stats.canWallClimb && intent.dir !== 0 && intent.jumpHeld
    && touchesWall(u, intent.dir, map);
  if (climbing) {
    if (!u.wallClimbing) {
      u.wallClimbing = true;
      u.climbTimer = 0;
      if (u.yI < 5) u.yI = 5;
    }
    u.climbTimer -= t;
    if (u.climbTimer <= 0) {
      u.yI = Math.max(u.yI, WALL_CLIMB_BOOST);
      u.climbTimer += WALL_CLIMB_CYCLE;
    }
    u.yI -= GRAVITY * WALL_CLIMB_GRAVITY_M * t;
  } else {
    u.wallClimbing = false;
    if (!u.onGround) u.yI -= GRAVITY * t;
  }
  if (u.yI < u.stats.maxFallSpeed) u.yI = u.stats.maxFallSpeed;
  moveAndCollide(u, map, t, now);
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `cd /c/Users/rinal/Desktop/REA-BROFORCE/web && npx vitest run src/engine/physics.test.ts`
Expected: `13 passed`

- [ ] **Step 6: Commit**

```bash
cd /c/Users/rinal/Desktop/REA-BROFORCE && git add web/src/engine/units.ts web/src/engine/physics.ts web/src/engine/physics.test.ts && git commit -m "$(cat <<'EOF'
engine: units and movement ported from TestVanDammeAnim

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Explosions

**Files:**
- Create: `web/src/engine/explosions.ts`
- Test: `web/src/engine/explosions.test.ts`

**Interfaces:**
- Consumes: constants, `TileMap`, `damageUnit`, `knock`, `makeUnit`, `makeBlock`, types.
- Produces: `Blast { x; y; groundDamage; groundRange; unitDamage; unitRange; killRange; force; extraY; team: BlastTeam; big: boolean }`, `BlastResult { destroyed: Array<{ c; r; kind }>; killed: number[] }`, `rocketBlast(x, y, s: RocketStats, team: Team, big = true)`, `suicideBlast(x, y, s: { range; blastForce })`, `barrelBlast(x, y, range)`, `canDamage(blast: BlastTeam, unit: Team)`, `applyBlast(map, units, blast): BlastResult`.

- [ ] **Step 1: Write the failing tests**

Create `web/src/engine/explosions.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { applyBlast, barrelBlast, rocketBlast } from './explosions';
import { TileMap, makeBlock } from './map';
import { TEST_STATS } from './testStats';
import { makeUnit } from './units';

const rocket = TEST_STATS.rocketMook; // damage 10, range 28, blastForce 20, extraY 300
const mookAt = (x: number, y = 72) => makeUnit(2, 'mook', 'enemy', x, y, TEST_STATS.units.mook);
const broAt = (x: number, y = 72) => makeUnit(1, 'bro', 'player', x, y, TEST_STATS.units.bro);

describe('applyBlast (Rocket.MakeEffects + Map.ExplodeUnits + MapController.DamageGround)', () => {
  it('destroys dirt within half the range and spares steel', () => {
    const map = new TileMap(10, 10);
    map.set(5, 5, makeBlock('dirt', TEST_STATS));
    map.set(6, 5, makeBlock('steel', TEST_STATS));
    const res = applyBlast(map, [], rocketBlast(80, 80, rocket, 'player'));
    expect(res.destroyed).toEqual([{ c: 5, r: 5, kind: 'dirt' }]);
    expect(map.get(6, 5)?.kind).toBe('steel');
  });

  it('kills and knocks back an enemy inside the kill range', () => {
    const m = mookAt(100); // chest 20 units right of the blast
    const res = applyBlast(new TileMap(10, 10), [m], rocketBlast(80, 80, rocket, 'player'));
    expect(res.killed).toEqual([2]);
    expect(m.xI).toBeGreaterThan(0);
    expect(m.yI).toBeGreaterThan(0);
  });

  it("doesn't hurt the player with their own blast but still knocks them", () => {
    const p = broAt(90);
    applyBlast(new TileMap(10, 10), [p], rocketBlast(80, 80, rocket, 'player'));
    expect(p.dead).toBe(false);
    expect(p.xI).toBeGreaterThan(0);
  });

  it('an enemy rocket kills the bro', () => {
    const p = broAt(90);
    applyBlast(new TileMap(10, 10), [p], rocketBlast(80, 80, rocket, 'enemy'));
    expect(p.dead).toBe(true);
  });

  it('barrels hurt everyone, including the player', () => {
    const p = broAt(90);
    applyBlast(new TileMap(10, 10), [p], barrelBlast(85, 80, 50));
    expect(p.dead).toBe(true);
  });

  it('only knocks units between the kill range and the outer range', () => {
    const m = mookAt(115); // 35 away: outside killRange 28, inside unitRange 42
    applyBlast(new TileMap(10, 10), [m], rocketBlast(80, 80, rocket, 'player'));
    expect(m.health).toBe(3);
    expect(m.xI).toBeGreaterThan(0);
  });

  it('ignores units outside the range and dead units', () => {
    const far = mookAt(200);
    const dead = mookAt(85);
    dead.dead = true;
    applyBlast(new TileMap(10, 10), [far, dead], rocketBlast(80, 80, rocket, 'player'));
    expect(far.xI).toBe(0);
    expect(dead.xI).toBe(0);
  });

  it('a blast centred exactly on a unit keeps velocities finite', () => {
    const m = mookAt(80, 72.5); // chest at y = 80
    applyBlast(new TileMap(10, 10), [m], rocketBlast(80, 80, rocket, 'player'));
    expect(Number.isFinite(m.xI) && Number.isFinite(m.yI)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `cd /c/Users/rinal/Desktop/REA-BROFORCE/web && npx vitest run src/engine/explosions.test.ts`
Expected: FAIL — `Failed to resolve import "./explosions"`

- [ ] **Step 3: Implement explosions**

Create `web/src/engine/explosions.ts`:

```ts
import {
  BARREL_EXTRA_Y, BARREL_FORCE, BARREL_GROUND_DAMAGE, BARREL_UNIT_DAMAGE, BARREL_UNIT_RANGE_M,
  BARREL_Y_OFFSET, MIN_KNOCK_DIST, SUICIDE_EXTRA_Y, SUICIDE_FORCE_M, SUICIDE_GROUND_DAMAGE,
  SUICIDE_UNIT_DAMAGE, UNIT_HEIGHT,
} from './constants';
import type { TileMap } from './map';
import { damageUnit, knock } from './units';
import type { BlastTeam, BlockKind, RocketStats, Team, Unit } from './types';

export interface Blast {
  x: number;
  y: number;
  groundDamage: number;
  groundRange: number; // DamageGround uses a sphere of radius range * 0.5
  unitDamage: number;
  unitRange: number;
  killRange: number;
  force: number;
  extraY: number;
  team: BlastTeam;
  big: boolean; // which explosion sprite to draw
}

export interface BlastResult {
  destroyed: Array<{ c: number; r: number; kind: BlockKind }>;
  killed: number[];
}

/** Rocket.MakeEffects: DamageGround(damage, range); ExplodeUnits(range * 1.5, range, blastForce * 20, blastForceExtraY). */
export function rocketBlast(x: number, y: number, s: RocketStats, team: Team, big = true): Blast {
  return {
    x, y, groundDamage: s.damage, groundRange: s.range, unitDamage: s.damage, unitRange: s.range * 1.5,
    killRange: s.range, force: s.blastForce * 20, extraY: s.blastForceExtraY, team, big,
  };
}

/** MookSuicide.MakeEffects */
export function suicideBlast(x: number, y: number, s: { range: number; blastForce: number }): Blast {
  return {
    x, y, groundDamage: SUICIDE_GROUND_DAMAGE, groundRange: s.range, unitDamage: SUICIDE_UNIT_DAMAGE,
    unitRange: s.range, killRange: s.range, force: s.blastForce * SUICIDE_FORCE_M, extraY: SUICIDE_EXTRA_Y,
    team: 'enemy', big: true,
  };
}

/** BarrelBlock explosion: fired as playerNum 15, so it hurts everyone. */
export function barrelBlast(x: number, y: number, range: number): Blast {
  return {
    x, y: y + BARREL_Y_OFFSET, groundDamage: BARREL_GROUND_DAMAGE, groundRange: range,
    unitDamage: BARREL_UNIT_DAMAGE, unitRange: range * BARREL_UNIT_RANGE_M, killRange: range,
    force: BARREL_FORCE, extraY: BARREL_EXTRA_Y, team: 'neutral', big: true,
  };
}

/** Map.ExplodeUnits: enemies (playerNum < 0) are always hurt; players only by other teams. */
export function canDamage(blast: BlastTeam, unit: Team): boolean {
  return unit === 'enemy' || blast !== unit;
}

export function applyBlast(map: TileMap, units: readonly Unit[], b: Blast): BlastResult {
  const destroyed: BlastResult['destroyed'] = [];
  for (const [c, r] of map.cellsInCircle(b.x, b.y, b.groundRange * 0.5)) {
    const kind = map.damage(c, r, b.groundDamage);
    if (kind) destroyed.push({ c, r, kind });
  }
  const killed: number[] = [];
  for (const u of units) {
    if (u.dead) continue;
    let dx = u.x - b.x;
    const dy = u.y + UNIT_HEIGHT / 2 - b.y;
    if (Math.abs(dx) >= b.unitRange || Math.abs(dy) >= b.unitRange) continue;
    const d2 = dx * dx + dy * dy;
    if (d2 < b.killRange * b.killRange) {
      if (canDamage(b.team, u.team)) {
        const d = Math.max(Math.sqrt(d2), 1);
        let extraY = b.extraY;
        if (Math.abs(dx) < b.unitRange * 0.4) {
          dx *= 0.66;
          extraY *= 1.5;
        }
        knock(u, (dx / d) * b.force, (dy / d) * b.force + extraY);
        if (damageUnit(u, b.unitDamage)) killed.push(u.id);
      } else {
        const d = Math.max(Math.sqrt(d2), MIN_KNOCK_DIST);
        knock(u, (dx / d) * b.force, (dy / d) * b.force + b.extraY);
      }
    } else if (d2 < b.unitRange * b.unitRange) {
      const d = Math.max(Math.sqrt(d2), MIN_KNOCK_DIST);
      knock(u, (dx / d) * b.force, (dy / d) * b.force + b.extraY);
    }
  }
  return { destroyed, killed };
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `cd /c/Users/rinal/Desktop/REA-BROFORCE/web && npx vitest run src/engine/explosions.test.ts`
Expected: `8 passed`

- [ ] **Step 5: Commit**

```bash
cd /c/Users/rinal/Desktop/REA-BROFORCE && git add web/src/engine/explosions.ts web/src/engine/explosions.test.ts && git commit -m "$(cat <<'EOF'
engine: explosions ported from Rocket, MookSuicide, BarrelBlock and Map.ExplodeUnits

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Projectiles, the football and the airstrike

**Files:**
- Create: `web/src/engine/projectiles.ts`
- Test: `web/src/engine/projectiles.test.ts`

**Interfaces:**
- Consumes: constants, `TileMap` (`blockAt`, `damage`), `getColumn`, `getRow`, `rocketBlast`, `barrelBlast`, `Blast`, `damageUnit`, `makeUnit`, types.
- Produces: `ProjectileEvent = { type: 'explode'; blast: Blast } | { type: 'airstrike'; x: number; y: number }`, `ProjectileWorld { map; units; stats }`, `fireMookBullet(id, m, stats, rng)`, `fireBazookaRocket(id, m, stats, rng)`, `kickFootball(id, u)`, `throwMarker(id, u, ducking)`, `spawnAirstrike(nextId: () => number, x, y, cameraTop, stats, rng): Projectile[]`, `unitAt(units, x, y, notTeam): Unit | null`, `stepProjectile(p, w, t): ProjectileEvent[]`.

- [ ] **Step 1: Write the failing tests**

Create `web/src/engine/projectiles.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { FIXED_DT } from './constants';
import { TileMap, makeBlock } from './map';
import {
  fireMookBullet, kickFootball, spawnAirstrike, stepProjectile, throwMarker,
  type ProjectileEvent, type ProjectileWorld,
} from './projectiles';
import { TEST_STATS } from './testStats';
import { makeUnit } from './units';
import type { Projectile, Unit } from './types';

const world = (map = new TileMap(40, 10), units: Unit[] = []): ProjectileWorld => ({ map, units, stats: TEST_STATS });
function steps(p: Projectile, w: ProjectileWorld, n: number): ProjectileEvent[] {
  const events: ProjectileEvent[] = [];
  for (let i = 0; i < n && !p.dead; i++) events.push(...stepProjectile(p, w, FIXED_DT));
  return events;
}
function floorMap(cols = 40): TileMap {
  const m = new TileMap(cols, 10);
  for (let c = 0; c < cols; c++) m.set(c, 0, makeBlock('dirt', TEST_STATS));
  return m;
}
const mook = (x = 40, y = 40) => {
  const m = makeUnit(2, 'mook', 'enemy', x, y, TEST_STATS.units.mook);
  m.facing = 1;
  return m;
};
const bro = (x = 80, y = 8) => makeUnit(1, 'bro', 'player', x, y, TEST_STATS.units.bro);

describe('bullets (Mook.UseFire, Projectile)', () => {
  it('fly at 250 u/s and expire after their 0.45 s life', () => {
    const p = fireMookBullet(1, mook(), TEST_STATS, () => 0.5);
    expect(p.xI).toBe(250);
    steps(p, world(), 26);
    expect(p.dead).toBe(false);
    steps(p, world(), 2);
    expect(p.dead).toBe(true);
  });

  it('chip the block they hit', () => {
    const map = new TileMap(40, 10);
    map.set(5, 3, makeBlock('dirt', TEST_STATS)); // x 72..88, y 40..56; bullet flies at y 48
    const p = fireMookBullet(1, mook(), TEST_STATS, () => 0.5);
    steps(p, world(map), 30);
    expect(p.dead).toBe(true);
    expect(map.get(5, 3)?.health).toBe(4);
  });

  it('kill the bro and pass by other mooks', () => {
    const target = bro(100, 40);
    const friend = mook(70, 40);
    const p = fireMookBullet(1, mook(), TEST_STATS, () => 0.5);
    steps(p, world(new TileMap(40, 10), [friend, target]), 30);
    expect(friend.health).toBe(3);
    expect(target.dead).toBe(true);
  });

  it('blow up barrels', () => {
    const map = new TileMap(40, 10);
    map.set(5, 3, makeBlock('barrel', TEST_STATS));
    const p = fireMookBullet(1, mook(), TEST_STATS, () => 0.5);
    const events = steps(p, world(map), 30);
    expect(map.get(5, 3)).toBeNull();
    expect(events).toHaveLength(1);
    expect(events[0].type === 'explode' && events[0].blast.team).toBe('neutral');
  });
});

describe('football (design weapon)', () => {
  it('bounces off the floor and loses energy', () => {
    const ball = kickFootball(1, bro());
    const w = world(floorMap());
    while (ball.bounces === 0 && !ball.dead) stepProjectile(ball, w, FIXED_DT);
    expect(ball.yI).toBeGreaterThan(0);
    expect(ball.yI).toBeLessThan(160);
  });

  it('explodes on touching an enemy', () => {
    const ball = kickFootball(1, bro());
    Object.assign(ball, { x: 118, y: 14, xI: 50, yI: 0 });
    const events = stepProjectile(ball, world(floorMap(), [mook(120, 8)]), FIXED_DT);
    expect(events).toHaveLength(1);
    expect(events[0].type === 'explode' && events[0].blast.team).toBe('player');
  });

  it('explodes after its last bounce, before the fuse', () => {
    const ball = kickFootball(1, bro());
    Object.assign(ball, { x: 80, y: 40, xI: 0, yI: 0 });
    const events = steps(ball, world(floorMap()), 200);
    expect(events.some((e) => e.type === 'explode')).toBe(true);
    expect(ball.bounces).toBeGreaterThan(3);
    expect(ball.life).toBeGreaterThan(0);
  });
});

describe('airstrike (BroBase.UseSpecial + GrenadeAirstrike.Death)', () => {
  it('the marker calls the strike when its fuse runs out', () => {
    const marker = throwMarker(1, bro(), false);
    expect([marker.xI, marker.yI]).toEqual([200, 150]);
    const events = steps(marker, world(floorMap()), 61);
    expect(events).toEqual([{ type: 'airstrike', x: marker.x, y: marker.y }]);
  });

  it('ducking lobs the marker short', () => {
    const marker = throwMarker(1, bro(), true);
    expect([marker.xI, marker.yI]).toEqual([30, 70]);
  });

  it('spawns five bombs from the upper left at 45 degrees', () => {
    let id = 0;
    const bombs = spawnAirstrike(() => ++id, 500, 100, 100, TEST_STATS, () => 0);
    expect(bombs.map((b) => [b.x, b.y])).toEqual([[20, 680], [20, 640], [20, 600], [20, 560], [20, 520]]);
    expect(bombs.every((b) => b.xI === 200 && b.yI === -200 && b.team === 'player')).toBe(true);
    // each reaches y = 100 at x = 500 + (offset - 480): spread from x - 60 to x + 100
    expect(bombs.map((b) => b.x + (b.y - 100))).toEqual([600, 560, 520, 480, 440]);
  });

  it('bombs fly in from outside the map and explode on the ground', () => {
    let id = 0;
    const bombs = spawnAirstrike(() => ++id, 500, 100, 100, TEST_STATS, () => 0);
    const w = world(floorMap(60));
    const events = bombs.flatMap((b) => steps(b, w, 400));
    expect(events.filter((e) => e.type === 'explode')).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `cd /c/Users/rinal/Desktop/REA-BROFORCE/web && npx vitest run src/engine/projectiles.test.ts`
Expected: FAIL — `Failed to resolve import "./projectiles"`

- [ ] **Step 3: Implement projectiles**

Create `web/src/engine/projectiles.ts`:

```ts
import {
  AIRSTRIKE_FUSE, AIRSTRIKE_ROCKETS, AIRSTRIKE_SPEED_MIN, AIRSTRIKE_SPEED_RAND, AIRSTRIKE_THROW,
  AIRSTRIKE_THROW_DUCK, AIRSTRIKE_X_OFFSET, BAZOOKA_ROCKET_SPEED, FOOTBALL, GRAVITY, MOOK_BULLET_SPEED,
  TILE, UNIT_HALF_WIDTH, UNIT_HEIGHT,
} from './constants';
import { barrelBlast, rocketBlast, type Blast } from './explosions';
import { TileMap, getColumn, getRow } from './map';
import { damageUnit } from './units';
import type { GameStats, Projectile, ProjectileKind, RocketStats, Team, Unit } from './types';

export type ProjectileEvent = { type: 'explode'; blast: Blast } | { type: 'airstrike'; x: number; y: number };

export interface ProjectileWorld {
  map: TileMap;
  units: readonly Unit[];
  stats: GameStats;
}

const HIT_MARGIN = 2;
const FOOTBALL_BLAST: RocketStats = {
  damage: FOOTBALL.damage, range: FOOTBALL.range, blastForce: FOOTBALL.blastForce,
  blastForceExtraY: FOOTBALL.blastForceExtraY, life: FOOTBALL.fuse,
};

function make(id: number, kind: ProjectileKind, team: Team, x: number, y: number, xI: number, yI: number, life: number): Projectile {
  return { id, kind, team, x, y, xI, yI, life, bounces: 0, dead: false };
}

/** Mook.UseFire: from (x + facing * 10, y + 8) at 250, with a small random vertical spread. */
export function fireMookBullet(id: number, m: Unit, stats: GameStats, rng: () => number): Projectile {
  return make(id, 'bullet', m.team, m.x + m.facing * 10, m.y + 8, m.facing * MOOK_BULLET_SPEED,
    (Math.floor(rng() * 4) - 2) * 0.2, stats.bullet.life);
}

/** MookBazooka.UseFire: from (x + facing * 12, y + 8) at 100. Homing (RocketSeeking) is not ported. */
export function fireBazookaRocket(id: number, m: Unit, stats: GameStats, rng: () => number): Projectile {
  return make(id, 'rocket', m.team, m.x + m.facing * 12, m.y + 8, m.facing * BAZOOKA_ROCKET_SPEED,
    (Math.floor(rng() * 4) - 2) * 0.2, stats.rocketMook.life);
}

export function kickFootball(id: number, u: Unit): Projectile {
  return make(id, 'football', u.team, u.x + u.facing * 8, u.y + 8, u.facing * FOOTBALL.kickX, FOOTBALL.kickY, FOOTBALL.fuse);
}

/** BroBase.UseSpecial: the airstrike grenade; ducking lobs it short. */
export function throwMarker(id: number, u: Unit, ducking: boolean): Projectile {
  const p = ducking ? AIRSTRIKE_THROW_DUCK : AIRSTRIKE_THROW;
  return make(id, 'marker', u.team, u.x + u.facing * p.ox, u.y + p.oy, u.facing * p.x, p.y, AIRSTRIKE_FUSE);
}

/** GrenadeAirstrike.Death: five bombs from the upper left at 45°, landing from x - 60 to x + 100. */
export function spawnAirstrike(nextId: () => number, x: number, y: number, cameraTop: number, stats: GameStats, rng: () => number): Projectile[] {
  const h = Math.max(0, cameraTop - y);
  return AIRSTRIKE_ROCKETS.map((offset) => {
    const v = AIRSTRIKE_SPEED_MIN + rng() * AIRSTRIKE_SPEED_RAND;
    return make(nextId(), 'bomb', 'player', x - AIRSTRIKE_X_OFFSET - h, y + offset + h, v, -v, stats.bomb.life);
  });
}

export function unitAt(units: readonly Unit[], x: number, y: number, notTeam: Team): Unit | null {
  for (const u of units) {
    if (u.dead || u.team === notTeam) continue;
    if (Math.abs(x - u.x) <= UNIT_HALF_WIDTH + HIT_MARGIN && y >= u.y - HIT_MARGIN && y <= u.y + UNIT_HEIGHT + HIT_MARGIN) {
      return u;
    }
  }
  return null;
}

function hitBlock(p: Projectile, w: ProjectileWorld, damage: number, events: ProjectileEvent[]): void {
  const c = getColumn(p.x);
  const r = getRow(p.y);
  if (w.map.damage(c, r, damage) === 'barrel') {
    events.push({ type: 'explode', blast: barrelBlast(c * TILE, r * TILE, w.stats.barrelRange) });
  }
}

function bounce(p: Projectile, map: TileMap, t: number, bounceM: number, frictionM: number): void {
  p.yI -= GRAVITY * t;
  if (map.blockAt(p.x + p.xI * t, p.y)) {
    p.xI = -p.xI * bounceM;
    p.bounces++;
  } else {
    p.x += p.xI * t;
  }
  if (map.blockAt(p.x, p.y + p.yI * t)) {
    p.yI = -p.yI * bounceM;
    p.xI *= frictionM;
    p.bounces++;
  } else {
    p.y += p.yI * t;
  }
}

function explodeAt(p: Projectile, stats: RocketStats, big: boolean, events: ProjectileEvent[]): void {
  p.dead = true;
  events.push({ type: 'explode', blast: rocketBlast(p.x, p.y, stats, p.team, big) });
}

export function stepProjectile(p: Projectile, w: ProjectileWorld, t: number): ProjectileEvent[] {
  const events: ProjectileEvent[] = [];
  if (p.dead) return events;
  p.life -= t;
  switch (p.kind) {
    case 'bullet': {
      p.x += p.xI * t;
      p.y += p.yI * t;
      if (w.map.blockAt(p.x, p.y)) {
        hitBlock(p, w, w.stats.bullet.damage, events);
        p.dead = true;
        break;
      }
      const target = unitAt(w.units, p.x, p.y, p.team);
      if (target) {
        damageUnit(target, w.stats.bullet.damage);
        p.dead = true;
      } else if (p.life <= 0) {
        p.dead = true;
      }
      break;
    }
    case 'rocket':
    case 'bomb': {
      p.x += p.xI * t;
      p.y += p.yI * t;
      if (w.map.blockAt(p.x, p.y) || unitAt(w.units, p.x, p.y, p.team) || p.life <= 0) {
        explodeAt(p, p.kind === 'rocket' ? w.stats.rocketMook : w.stats.bomb, true, events);
      }
      break;
    }
    case 'football': {
      bounce(p, w.map, t, FOOTBALL.bounceM, FOOTBALL.frictionM);
      if (unitAt(w.units, p.x, p.y, p.team) || p.bounces > FOOTBALL.maxBounces || p.life <= 0) {
        explodeAt(p, FOOTBALL_BLAST, false, events);
      }
      break;
    }
    case 'marker': {
      bounce(p, w.map, t, w.stats.marker.bounceM, w.stats.marker.frictionM);
      if (p.life <= 0) {
        p.dead = true;
        events.push({ type: 'airstrike', x: p.x, y: p.y });
      }
      break;
    }
  }
  return events;
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `cd /c/Users/rinal/Desktop/REA-BROFORCE/web && npx vitest run src/engine/projectiles.test.ts`
Expected: `11 passed`

- [ ] **Step 5: Commit**

```bash
cd /c/Users/rinal/Desktop/REA-BROFORCE && git add web/src/engine/projectiles.ts web/src/engine/projectiles.test.ts && git commit -m "$(cat <<'EOF'
engine: bullets, rockets, the exploding football and the airstrike

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Mook AI

**Files:**
- Create: `web/src/engine/ai.ts`
- Test: `web/src/engine/ai.test.ts`

**Interfaces:**
- Consumes: constants, `TileMap`, `NO_INTENT`, `touchesWall`, `MoveIntent`, `stepUnit`, `makeUnit`, types.
- Produces: `AiContext { map; player: Unit | null; rng: () => number }`, `AiAction { intent: MoveIntent; fire: boolean; explode: boolean }`, `canSee(m, p, map): boolean`, `thinkMook(m, ctx, t): AiAction`. The caller spawns projectiles on `fire` and kills the suicide mook on `explode`.

- [ ] **Step 1: Write the failing tests**

Create `web/src/engine/ai.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { canSee, thinkMook } from './ai';
import { FIXED_DT } from './constants';
import { TileMap, makeBlock } from './map';
import { stepUnit } from './physics';
import { TEST_STATS } from './testStats';
import { makeUnit } from './units';
import type { UnitKind } from './types';

function scene(kind: UnitKind = 'mook') {
  const map = new TileMap(40, 10);
  for (let c = 0; c < 40; c++) map.set(c, 0, makeBlock('dirt', TEST_STATS));
  const mook = makeUnit(2, kind, 'enemy', 200, 8, TEST_STATS.units[kind]); // faces left (-1)
  const bro = makeUnit(1, 'bro', 'player', 120, 8, TEST_STATS.units.bro);
  return { map, mook, bro };
}
function shotTimes(kind: UnitKind, seconds: number): number[] {
  const { map, mook, bro } = scene(kind);
  const shots: number[] = [];
  let time = 0;
  for (let i = 0; i < seconds * 60; i++) {
    time += FIXED_DT;
    if (thinkMook(mook, { map, player: bro, rng: () => 0.5 }, FIXED_DT).fire) shots.push(time);
  }
  return shots;
}

describe('canSee (EnemyAI.sightRangeX/Y)', () => {
  it('sees a player in range, in front, with a clear line', () => {
    const { map, mook, bro } = scene();
    expect(canSee(mook, bro, map)).toBe(true);
  });

  it('is blocked by a wall', () => {
    const { map, mook, bro } = scene();
    map.set(10, 1, makeBlock('dirt', TEST_STATS));
    expect(canSee(mook, bro, map)).toBe(false);
  });

  it('ignores players beyond 300 across or 20 up', () => {
    const { map, mook, bro } = scene();
    bro.x = 200 - 301;
    expect(canSee(mook, bro, map)).toBe(false);
    bro.x = 120;
    bro.y = 8 + 21;
    expect(canSee(mook, bro, map)).toBe(false);
  });

  it("doesn't see behind its back", () => {
    const { map, mook, bro } = scene();
    mook.facing = 1;
    expect(canSee(mook, bro, map)).toBe(false);
  });
});

describe('thinkMook', () => {
  it('a trooper reacts, then fires bursts of 3 at its fireRate, then pauses', () => {
    const shots = shotTimes('mook', 3);
    expect(shots[0]).toBeGreaterThanOrEqual(0.4);
    expect(shots[1] - shots[0]).toBeCloseTo(0.17, 1);
    expect(shots[2] - shots[1]).toBeCloseTo(0.17, 1);
    expect(shots[3] - shots[2]).toBeGreaterThan(0.99);
  });

  it('a bazooka mook fires once every 1.4 s', () => {
    const shots = shotTimes('mook_bazooka', 3);
    expect(shots[1] - shots[0]).toBeCloseTo(1.4, 1);
  });

  it('idle mooks turn around every few seconds', () => {
    const { map, mook } = scene();
    for (let i = 0; i < 126; i++) thinkMook(mook, { map, player: null, rng: () => 0.5 }, FIXED_DT);
    expect(mook.facing).toBe(1);
  });

  it('a suicide mook charges and explodes after its fuse once next to the player', () => {
    const { map, mook, bro } = scene('mook_suicide');
    let now = 0;
    let exploded = false;
    for (let i = 0; i < 240 && !exploded; i++) {
      now += FIXED_DT;
      const action = thinkMook(mook, { map, player: bro, rng: () => 0.5 }, FIXED_DT);
      exploded = action.explode;
      stepUnit(mook, action.intent, map, FIXED_DT, now);
    }
    expect(exploded).toBe(true);
    expect(Math.abs(mook.x - bro.x)).toBeLessThan(20);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `cd /c/Users/rinal/Desktop/REA-BROFORCE/web && npx vitest run src/engine/ai.test.ts`
Expected: FAIL — `Failed to resolve import "./ai"`

- [ ] **Step 3: Implement the AI**

Create `web/src/engine/ai.ts`:

```ts
import {
  BAZOOKA_FIRE_DELAY, LOST_SIGHT_TIME, MOOK_BURST, MOOK_BURST_PAUSE, MOOK_REACTION, PATROL_TURN_TIME,
  SIGHT_X, SIGHT_Y, SUICIDE_FUSE_MIN, SUICIDE_FUSE_RAND, SUICIDE_TRIGGER_DX, SUICIDE_TRIGGER_DY,
} from './constants';
import type { TileMap } from './map';
import { NO_INTENT, touchesWall, type MoveIntent } from './physics';
import type { AiState, Unit } from './types';

export interface AiContext {
  map: TileMap;
  player: Unit | null;
  rng: () => number;
}

export interface AiAction {
  intent: MoveIntent;
  fire: boolean;
  explode: boolean;
}

const IDLE: AiAction = { intent: NO_INTENT, fire: false, explode: false };

/** EnemyAI sight box (300 x 20), facing the player, with a clear line at chest height. */
export function canSee(m: Unit, p: Unit, map: TileMap): boolean {
  const dx = p.x - m.x;
  const dy = p.y - m.y;
  if (Math.abs(dx) > SIGHT_X || Math.abs(dy) > SIGHT_Y) return false;
  if (Math.abs(dx) > 16 && Math.sign(dx) !== m.facing) return false;
  const steps = Math.ceil(Math.abs(dx) / 8);
  for (let i = 1; i < steps; i++) {
    if (map.solidAt(m.x + (dx * i) / steps, m.y + 8)) return false;
  }
  return true;
}

function patrol(m: Unit, ai: AiState, t: number): void {
  ai.patrolTimer -= t;
  if (ai.patrolTimer <= 0) {
    m.facing = m.facing === 1 ? -1 : 1;
    ai.patrolTimer = PATROL_TURN_TIME;
  }
}

function thinkSuicide(m: Unit, ai: AiState, p: Unit | null, sees: boolean, ctx: AiContext, t: number): AiAction {
  if (ai.mode === 'idle') {
    if (sees) ai.mode = 'charging';
    else patrol(m, ai, t);
    return IDLE;
  }
  if (ai.fuse > 0) {
    ai.fuse -= t;
    return ai.fuse <= 0 ? { ...IDLE, explode: true } : IDLE;
  }
  if (!p) return IDLE;
  const dx = p.x - m.x;
  const dy = p.y - m.y;
  if (Math.abs(dx) < SUICIDE_TRIGGER_DX && Math.abs(dy) < SUICIDE_TRIGGER_DY) {
    ai.fuse = SUICIDE_FUSE_MIN + ctx.rng() * SUICIDE_FUSE_RAND; // MookSuicide.deathCounter
    return IDLE;
  }
  const dir: -1 | 1 = dx >= 0 ? 1 : -1;
  const blocked = touchesWall(m, dir, ctx.map);
  return { intent: { dir, jumpPressed: blocked && m.onGround, jumpHeld: blocked, dash: false }, fire: false, explode: false };
}

/** A small reduction of EnemyAI/PolymorphicAI: patrol, notice, react, shoot. */
export function thinkMook(m: Unit, ctx: AiContext, t: number): AiAction {
  const ai = m.ai;
  if (!ai || m.dead || ai.mode === 'exploded') return IDLE;
  const p = ctx.player && !ctx.player.dead ? ctx.player : null;
  const sees = p !== null && canSee(m, p, ctx.map);
  if (m.kind === 'mook_suicide') return thinkSuicide(m, ai, p, sees, ctx, t);
  if (ai.mode === 'idle') {
    if (sees && p) {
      ai.mode = 'alert';
      ai.reaction = MOOK_REACTION;
      ai.burstLeft = 0;
      ai.cooldown = 0;
      ai.lostSight = 0;
      m.facing = p.x >= m.x ? 1 : -1;
    } else {
      patrol(m, ai, t);
    }
    return IDLE;
  }
  if (p) m.facing = p.x >= m.x ? 1 : -1;
  ai.lostSight = sees ? 0 : ai.lostSight + t;
  if (ai.lostSight > LOST_SIGHT_TIME) {
    ai.mode = 'idle';
    ai.patrolTimer = PATROL_TURN_TIME;
    return IDLE;
  }
  if (ai.reaction > 0) {
    ai.reaction -= t;
    return IDLE;
  }
  ai.cooldown -= t;
  if (!sees || ai.cooldown > 0) return IDLE;
  if (m.kind === 'mook_bazooka') {
    ai.cooldown = BAZOOKA_FIRE_DELAY;
    return { ...IDLE, fire: true };
  }
  if (ai.burstLeft <= 0) ai.burstLeft = MOOK_BURST;
  ai.burstLeft -= 1;
  ai.cooldown = ai.burstLeft > 0 ? m.stats.fireRate : MOOK_BURST_PAUSE;
  return { ...IDLE, fire: true };
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `cd /c/Users/rinal/Desktop/REA-BROFORCE/web && npx vitest run src/engine/ai.test.ts`
Expected: `8 passed`

- [ ] **Step 5: Commit**

```bash
cd /c/Users/rinal/Desktop/REA-BROFORCE && git add web/src/engine/ai.ts web/src/engine/ai.test.ts && git commit -m "$(cat <<'EOF'
engine: mook, bazooka and suicide mook AI

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Level format and level 1

**Files:**
- Create: `web/src/engine/level.ts`
- Create: `web/src/levels/level1.ts`
- Test: `web/src/engine/level.test.ts`
- Test: `web/src/levels/level1.test.ts`

**Interfaces:**
- Consumes: `TileMap`, `makeBlock`, types, `TEST_STATS`.
- Produces: `LevelData { cols; rows; tiles: string[] }` (`tiles[0]` is the top row; `.` air, `d` dirt, `b` brick, `s` steel, `x` barrel, `P` player, `m` mook, `k` suicide mook, `z` bazooka mook, `c` caged prisoner, `F` flag), `Cell { c; r }`, `ParsedLevel { map; player: Cell; enemies: Array<Cell & { kind: UnitKind }>; cages: Cell[]; flag: Cell }`, `parseLevel(level, stats): ParsedLevel`, `buildLevel1(): LevelData`.

- [ ] **Step 1: Write the failing tests**

Create `web/src/engine/level.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseLevel, type LevelData } from './level';
import { TEST_STATS } from './testStats';

const tiny: LevelData = { cols: 5, rows: 3, tiles: ['....F', 'P.mc.', 'ddxss'] };

describe('parseLevel', () => {
  it('reads blocks bottom-up and places entities', () => {
    const lvl = parseLevel(tiny, TEST_STATS);
    expect(lvl.map.get(0, 0)?.kind).toBe('dirt');
    expect(lvl.map.get(2, 0)?.kind).toBe('barrel');
    expect(lvl.map.get(4, 0)?.kind).toBe('steel');
    expect(lvl.player).toEqual({ c: 0, r: 1 });
    expect(lvl.enemies).toEqual([{ c: 2, r: 1, kind: 'mook' }]);
    expect(lvl.cages).toEqual([{ c: 3, r: 1 }]);
    expect(lvl.flag).toEqual({ c: 4, r: 2 });
  });

  it('rejects unknown tiles and ragged rows', () => {
    expect(() => parseLevel({ ...tiny, tiles: ['....F', 'P.mQ.', 'ddxss'] }, TEST_STATS)).toThrow("unknown tile 'Q'");
    expect(() => parseLevel({ ...tiny, tiles: ['....F', 'P.mc', 'ddxss'] }, TEST_STATS)).toThrow('row 1 has 4 columns');
    expect(() => parseLevel({ ...tiny, rows: 4 }, TEST_STATS)).toThrow('expected 4');
  });

  it('needs exactly one player start and one flag', () => {
    expect(() => parseLevel({ ...tiny, tiles: ['....F', '..mc.', 'ddxss'] }, TEST_STATS)).toThrow('no player start');
    expect(() => parseLevel({ ...tiny, tiles: ['.....', 'P.mc.', 'ddxss'] }, TEST_STATS)).toThrow('no flag');
    expect(() => parseLevel({ ...tiny, tiles: ['P...F', 'P.mc.', 'ddxss'] }, TEST_STATS)).toThrow('more than one P');
  });
});
```

Create `web/src/levels/level1.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseLevel } from '../engine/level';
import { TEST_STATS } from '../engine/testStats';
import { buildLevel1 } from './level1';

const level = buildLevel1();
const parsed = parseLevel(level, TEST_STATS);

describe('level 1', () => {
  it('is 120 x 18 with aligned rows', () => {
    expect(level.cols).toBe(120);
    expect(level.rows).toBe(18);
    expect(level.tiles.every((row) => row.length === 120)).toBe(true);
  });

  it('has 8 mooks, 2 suicide mooks, 2 bazooka mooks and 3 prisoners', () => {
    const count = (k: string) => parsed.enemies.filter((e) => e.kind === k).length;
    expect(count('mook')).toBe(8);
    expect(count('mook_suicide')).toBe(2);
    expect(count('mook_bazooka')).toBe(2);
    expect(parsed.cages).toHaveLength(3);
  });

  it('puts every entity in open air, standing on something solid', () => {
    for (const e of [parsed.player, parsed.flag, ...parsed.enemies, ...parsed.cages]) {
      expect(parsed.map.get(e.c, e.r)).toBeNull();
      expect(parsed.map.isSolid(e.c, e.r - 1)).toBe(true);
    }
  });

  it('places the flag after the start', () => {
    expect(parsed.flag.c).toBeGreaterThan(parsed.player.c);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `cd /c/Users/rinal/Desktop/REA-BROFORCE/web && npx vitest run src/engine/level.test.ts src/levels/level1.test.ts`
Expected: FAIL — `Failed to resolve import "./level"`

- [ ] **Step 3: Implement the level parser**

Create `web/src/engine/level.ts`:

```ts
import { TileMap, makeBlock } from './map';
import type { BlockKind, GameStats, UnitKind } from './types';

/** tiles[0] is the TOP row. */
export interface LevelData {
  cols: number;
  rows: number;
  tiles: string[];
}

export interface Cell {
  c: number;
  r: number;
}

export interface ParsedLevel {
  map: TileMap;
  player: Cell;
  enemies: Array<Cell & { kind: UnitKind }>;
  cages: Cell[];
  flag: Cell;
}

const BLOCKS: Record<string, BlockKind> = { d: 'dirt', b: 'brick', s: 'steel', x: 'barrel' };
const ENEMIES: Record<string, UnitKind> = { m: 'mook', k: 'mook_suicide', z: 'mook_bazooka' };

export function parseLevel(level: LevelData, stats: GameStats): ParsedLevel {
  if (level.tiles.length !== level.rows) {
    throw new Error(`level has ${level.tiles.length} rows, expected ${level.rows}`);
  }
  const map = new TileMap(level.cols, level.rows);
  const enemies: ParsedLevel['enemies'] = [];
  const cages: Cell[] = [];
  let player: Cell | null = null;
  let flag: Cell | null = null;
  for (let i = 0; i < level.tiles.length; i++) {
    const line = level.tiles[i];
    if (line.length !== level.cols) throw new Error(`row ${i} has ${line.length} columns, expected ${level.cols}`);
    const r = level.rows - 1 - i;
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === '.') continue;
      if (ch in BLOCKS) map.set(c, r, makeBlock(BLOCKS[ch], stats));
      else if (ch in ENEMIES) enemies.push({ c, r, kind: ENEMIES[ch] });
      else if (ch === 'c') cages.push({ c, r });
      else if (ch === 'P') {
        if (player) throw new Error('level has more than one P');
        player = { c, r };
      } else if (ch === 'F') {
        if (flag) throw new Error('level has more than one F');
        flag = { c, r };
      } else {
        throw new Error(`unknown tile '${ch}' at column ${c}, row ${i}`);
      }
    }
  }
  if (!player) throw new Error('level has no player start (P)');
  if (!flag) throw new Error('level has no flag (F)');
  return { map, player, enemies, cages, flag };
}
```

- [ ] **Step 4: Build level 1**

Create `web/src/levels/level1.ts`:

```ts
import type { LevelData } from '../engine/level';

const COLS = 120;
const ROWS = 18;

/** Level 1, built with helpers so the rows stay aligned. Here rows count from the bottom (0 = bedrock). */
export function buildLevel1(): LevelData {
  const grid = Array.from({ length: ROWS }, () => Array<string>(COLS).fill('.'));
  const put = (c: number, r: number, ch: string) => {
    grid[ROWS - 1 - r][c] = ch;
  };
  const fill = (c0: number, c1: number, r0: number, r1: number, ch: string) => {
    for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) put(c, r, ch);
  };

  // Ground: steel bedrock, three rows of dirt, a pit at columns 37-40.
  fill(0, COLS - 1, 0, 0, 's');
  fill(0, COLS - 1, 1, 3, 'd');
  fill(37, 40, 1, 3, '.');
  // Start.
  put(3, 4, 'P');
  // Bunker: brick walls, a dirt roof, two mooks inside, a prisoner on the roof.
  fill(14, 14, 4, 7, 'b');
  fill(25, 25, 4, 7, 'b');
  fill(14, 25, 8, 8, 'd');
  put(18, 4, 'm');
  put(22, 4, 'm');
  put(20, 9, 'c');
  // Barrels next to a mook.
  put(28, 4, 'x');
  put(29, 4, 'x');
  put(33, 4, 'm');
  // A suicide mook past the pit; a hill with a steel core and a bazooka mook on top.
  put(42, 4, 'k');
  fill(44, 54, 4, 5, 'd');
  fill(46, 52, 6, 7, 'd');
  fill(48, 50, 4, 6, 's');
  put(49, 8, 'z');
  // Tunnel: a dirt mass with a two-tile corridor holding a barrel, mooks and a prisoner.
  fill(58, 79, 4, 9, 'd');
  fill(58, 79, 4, 5, '.');
  put(63, 4, 'x');
  put(66, 4, 'm');
  put(69, 4, 'c');
  put(72, 4, 'm');
  put(76, 4, 'k');
  // Open field with a brick tower.
  put(86, 4, 'm');
  put(90, 4, 'm');
  fill(92, 93, 4, 8, 'b');
  put(92, 9, 'm');
  put(97, 4, 'z');
  // End: the last prisoner, the flag and a steel wall.
  put(104, 4, 'c');
  put(114, 4, 'F');
  fill(119, 119, 4, ROWS - 1, 's');

  return { cols: COLS, rows: ROWS, tiles: grid.map((row) => row.join('')) };
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `cd /c/Users/rinal/Desktop/REA-BROFORCE/web && npx vitest run src/engine/level.test.ts src/levels/level1.test.ts`
Expected: `7 passed`

- [ ] **Step 6: Commit**

```bash
cd /c/Users/rinal/Desktop/REA-BROFORCE && git add web/src/engine/level.ts web/src/engine/level.test.ts web/src/levels && git commit -m "$(cat <<'EOF'
engine: text level format and level 1

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Bro definitions and the world simulation

**Files:**
- Create: `web/src/engine/bro.ts`
- Create: `web/src/bros/brolusconi.json`
- Create: `web/src/bros/index.ts`
- Create: `web/src/engine/world.ts`
- Test: `web/src/engine/bro.test.ts`
- Test: `web/src/engine/world.test.ts`

**Interfaces:**
- Consumes: everything in `web/src/engine/` from Tasks 4–10.
- Produces:
  - `WEAPONS = ['football']`, `SPECIALS = ['airstrike']`, `WeaponId`, `SpecialId`, `BroDef { id; name; sheet; weapon: WeaponId; special: SpecialId; voiceLine }`, `parseBro(raw: unknown): BroDef`; `BROLUSCONI: BroDef` from `web/src/bros/index.ts`.
  - `Effect { kind: 'explosion' | 'explosion_small' | 'speech'; x; y; age; duration; text?: string }`, `Prisoner { x; y; freed }`, `GameEvent = { type: 'voice'; text } | { type: 'explosion' } | { type: 'rescue' } | { type: 'death' }`, `WorldState = 'playing' | 'extracting' | 'won' | 'lost'`.
  - `World { map; stats; bro; rng; player; spawn; enemies; projectiles; effects; prisoners; flag; lives; specialAmmo; respawnTimer; state; extractionTime; time; nextId; cameraTop; events }`.
  - `createWorld(level, stats, bro, rng = Math.random): World`, `stepWorld(w, controls, prev, t): void`. The renderer sets `w.cameraTop` every frame; the UI drains `w.events`.

- [ ] **Step 0: Write the bro definition test, then the bro files**

Create `web/src/engine/bro.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { BROLUSCONI } from '../bros';
import { parseBro } from './bro';

const valid = { id: 'x', name: 'X', sheet: 'brolusconi', weapon: 'football', special: 'airstrike', voiceLine: 'Ciao' };

describe('bro definitions', () => {
  it('Brolusconi kicks footballs and calls the airstrike with his line', () => {
    expect(BROLUSCONI).toEqual({
      id: 'brolusconi', name: 'Silvio Brolusconi', sheet: 'brolusconi', weapon: 'football', special: 'airstrike',
      voiceLine: 'Siete solo dei poveri comunisti!',
    });
  });

  it('rejects unknown weapons and specials', () => {
    expect(() => parseBro({ ...valid, weapon: 'laser' })).toThrow("unknown weapon 'laser'");
    expect(() => parseBro({ ...valid, special: 'nuke' })).toThrow("unknown special 'nuke'");
  });

  it('rejects missing or empty text fields', () => {
    expect(() => parseBro({ ...valid, voiceLine: '' })).toThrow('voiceLine');
    expect(() => parseBro(null)).toThrow('not an object');
  });
});
```

Run: `cd /c/Users/rinal/Desktop/REA-BROFORCE/web && npx vitest run src/engine/bro.test.ts`
Expected: FAIL — `Failed to resolve import "../bros"`

Create `web/src/engine/bro.ts`:

```ts
/** A custom bro is data: its sheet shares TestVanDammeAnim's layout and the extracted bro physics. */
export const WEAPONS = ['football'] as const;
export const SPECIALS = ['airstrike'] as const;
export type WeaponId = (typeof WEAPONS)[number];
export type SpecialId = (typeof SPECIALS)[number];

export interface BroDef {
  id: string;
  name: string;
  sheet: string;
  weapon: WeaponId;
  special: SpecialId;
  voiceLine: string;
}

function text(raw: Record<string, unknown>, field: string): string {
  const v = raw[field];
  if (typeof v !== 'string' || v.trim() === '') throw new Error(`bro: ${field} must be a non-empty string`);
  return v;
}

export function parseBro(raw: unknown): BroDef {
  if (typeof raw !== 'object' || raw === null) throw new Error('bro: definition is not an object');
  const r = raw as Record<string, unknown>;
  const id = text(r, 'id');
  const weapon = text(r, 'weapon');
  const special = text(r, 'special');
  if (!(WEAPONS as readonly string[]).includes(weapon)) throw new Error(`bro ${id}: unknown weapon '${weapon}'`);
  if (!(SPECIALS as readonly string[]).includes(special)) throw new Error(`bro ${id}: unknown special '${special}'`);
  return {
    id, name: text(r, 'name'), sheet: text(r, 'sheet'), weapon: weapon as WeaponId, special: special as SpecialId,
    voiceLine: text(r, 'voiceLine'),
  };
}
```

Create `web/src/bros/brolusconi.json`:

```json
{
  "id": "brolusconi",
  "name": "Silvio Brolusconi",
  "sheet": "brolusconi",
  "weapon": "football",
  "special": "airstrike",
  "voiceLine": "Siete solo dei poveri comunisti!"
}
```

Create `web/src/bros/index.ts`:

```ts
import { parseBro } from '../engine/bro';
import brolusconi from './brolusconi.json';

export const BROLUSCONI = parseBro(brolusconi);
```

Run: `cd /c/Users/rinal/Desktop/REA-BROFORCE/web && npx vitest run src/engine/bro.test.ts`
Expected: `3 passed`

- [ ] **Step 1: Write the failing world tests**

Create `web/src/engine/world.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { BROLUSCONI } from '../bros';
import { FIXED_DT } from './constants';
import type { LevelData } from './level';
import { TEST_STATS } from './testStats';
import { NO_CONTROLS, type Controls } from './types';
import { damageUnit } from './units';
import { createWorld, stepWorld, type World } from './world';

const COLS = 30;
function line(entries: Array<[number, string]> = [], fillCh = '.'): string {
  const a = Array<string>(COLS).fill(fillCh);
  for (const [c, ch] of entries) a[c] = ch;
  return a.join('');
}
/** Entities on row 2 (feet at y = 24), dirt on row 1, steel bedrock on row 0. */
function level(row2: Array<[number, string]>): LevelData {
  return { cols: COLS, rows: 8, tiles: [line(), line(), line(), line(), line(), line(row2), line([], 'd'), line([], 's')] };
}
function play(w: World, controls: Partial<Controls>, frames: number, prev: Controls = NO_CONTROLS): Controls {
  const c = { ...NO_CONTROLS, ...controls };
  let p = prev;
  for (let i = 0; i < frames; i++) {
    stepWorld(w, c, p, FIXED_DT);
    p = c;
  }
  return p;
}
const EMPTY = level([[2, 'P'], [27, 'F']]);

describe('createWorld', () => {
  it('spawns everything from the level', () => {
    const w = createWorld(level([[0, 'P'], [4, 'c'], [16, 'm'], [27, 'F']]), TEST_STATS, BROLUSCONI, () => 0.5);
    expect([w.player.x, w.player.y]).toEqual([0, 24]);
    expect(w.enemies.map((e) => [e.kind, e.x, e.y])).toEqual([['mook', 256, 24]]);
    expect(w.prisoners).toEqual([{ x: 64, y: 24, freed: false }]);
    expect(w.flag).toEqual({ x: 432, y: 24 });
    expect(w.lives).toBe(3);
    expect(w.specialAmmo).toBe(4);
  });
});

describe('stepWorld', () => {
  it('kicks footballs no faster than the fireRate', () => {
    const w = createWorld(EMPTY, TEST_STATS, BROLUSCONI, () => 0.5);
    const seen = new Set<number>();
    let prev = NO_CONTROLS;
    for (let i = 0; i < 30; i++) {
      prev = play(w, { fire: true }, 1, prev);
      for (const p of w.projectiles) if (p.kind === 'football') seen.add(p.id);
    }
    expect(seen.size).toBe(2); // at 0 s and 0.27 s
  });

  it('special fires once per press, speaks, and stops at zero ammo', () => {
    const w = createWorld(EMPTY, TEST_STATS, BROLUSCONI, () => 0.5);
    let prev = play(w, { special: true }, 30);
    expect(w.specialAmmo).toBe(3);
    expect(w.projectiles.filter((p) => p.kind === 'marker')).toHaveLength(1);
    expect(w.events.filter((e) => e.type === 'voice')).toEqual([{ type: 'voice', text: BROLUSCONI.voiceLine }]);
    expect(w.effects.some((e) => e.kind === 'speech' && e.text === BROLUSCONI.voiceLine)).toBe(true);
    prev = play(w, {}, 1, prev);
    prev = play(w, { special: true }, 1, prev);
    expect(w.specialAmmo).toBe(2);
    w.specialAmmo = 0;
    prev = play(w, {}, 1, prev);
    play(w, { special: true }, 1, prev);
    expect(w.specialAmmo).toBe(0);
    expect(w.events.filter((e) => e.type === 'voice')).toHaveLength(2);
  });

  it('the airstrike brings five bombs from outside the map, and they all land', () => {
    const w = createWorld(EMPTY, TEST_STATS, BROLUSCONI, () => 0.5);
    const prev = play(w, { special: true }, 1);
    play(w, {}, 62, prev);
    expect(w.projectiles.filter((p) => p.kind === 'bomb')).toHaveLength(5);
    play(w, {}, 300);
    expect(w.projectiles.filter((p) => p.kind === 'bomb')).toHaveLength(0);
    expect(w.events.filter((e) => e.type === 'explosion').length).toBeGreaterThanOrEqual(5);
    expect(w.player.dead).toBe(false);
  });

  it('touching a cage frees the prisoner and adds a life', () => {
    const w = createWorld(level([[0, 'P'], [4, 'c'], [27, 'F']]), TEST_STATS, BROLUSCONI, () => 0.5);
    play(w, { right: true }, 60);
    expect(w.prisoners[0].freed).toBe(true);
    expect(w.lives).toBe(4);
    expect(w.events).toContainEqual({ type: 'rescue' });
  });

  it('reaching the flag starts the extraction, which wins the level', () => {
    const w = createWorld(EMPTY, TEST_STATS, BROLUSCONI, () => 0.5);
    w.player.x = w.flag.x - 4;
    play(w, {}, 1);
    expect(w.state).toBe('extracting');
    play(w, {}, 186);
    expect(w.state).toBe('won');
  });

  it('dying respawns at the start for a life; with none left the game is lost', () => {
    const w = createWorld(EMPTY, TEST_STATS, BROLUSCONI, () => 0.5);
    w.player.x = 200;
    damageUnit(w.player, 1);
    play(w, {}, 100);
    expect(w.player.dead).toBe(false);
    expect(w.player.x).toBe(w.spawn.x);
    expect(w.lives).toBe(2);
    expect(w.events).toContainEqual({ type: 'death' });
    w.lives = 0;
    damageUnit(w.player, 1);
    play(w, {}, 100);
    expect(w.state).toBe('lost');
  });

  it('barrels chain-explode once each', () => {
    const barrels: Array<[number, string]> = [];
    for (let c = 10; c <= 19; c++) barrels.push([c, 'x']);
    const w = createWorld(level([[0, 'P'], ...barrels, [27, 'F']]), TEST_STATS, BROLUSCONI, () => 0.5);
    w.projectiles.push({ id: 999, kind: 'bullet', team: 'enemy', x: 140, y: 30, xI: 250, yI: 0, life: 1, bounces: 0, dead: false });
    play(w, {}, 10);
    for (let c = 10; c <= 19; c++) expect(w.map.get(c, 2)).toBeNull();
    expect(w.events.filter((e) => e.type === 'explosion')).toHaveLength(10);
    expect(w.player.dead).toBe(false);
  });

  it('falling off the bottom of the map kills the player', () => {
    const w = createWorld(EMPTY, TEST_STATS, BROLUSCONI, () => 0.5);
    w.player.y = -70;
    play(w, {}, 1);
    expect(w.player.dead).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `cd /c/Users/rinal/Desktop/REA-BROFORCE/web && npx vitest run src/engine/world.test.ts`
Expected: FAIL — `Failed to resolve import "./world"`

- [ ] **Step 3: Implement the world**

Create `web/src/engine/world.ts`:

```ts
import { thinkMook } from './ai';
import type { BroDef, SpecialId, WeaponId } from './bro';
import {
  CORPSE_TIME, EXPLOSION_DURATION, EXTRACTION_TIME, FLAG_REACH, HALF_TILE, LIVES_START,
  PRISONER_RESCUE_DIST, RESPAWN_DELAY, SPEECH_DURATION, TILE,
} from './constants';
import { applyBlast, barrelBlast, suicideBlast, type Blast } from './explosions';
import { parseLevel, type LevelData } from './level';
import type { TileMap } from './map';
import { NO_INTENT, stepUnit, type MoveIntent } from './physics';
import {
  fireBazookaRocket, fireMookBullet, kickFootball, spawnAirstrike, stepProjectile, throwMarker,
} from './projectiles';
import { damageUnit, makeUnit } from './units';
import type { Controls, GameStats, Projectile, Unit } from './types';

export interface Effect {
  kind: 'explosion' | 'explosion_small' | 'speech';
  x: number;
  y: number;
  age: number;
  duration: number;
  text?: string;
}

export interface Prisoner {
  x: number;
  y: number;
  freed: boolean;
}

export type GameEvent = { type: 'voice'; text: string } | { type: 'explosion' } | { type: 'rescue' } | { type: 'death' };
export type WorldState = 'playing' | 'extracting' | 'won' | 'lost';

export interface World {
  map: TileMap;
  stats: GameStats;
  bro: BroDef;
  rng: () => number;
  player: Unit;
  spawn: { x: number; y: number };
  enemies: Unit[];
  projectiles: Projectile[];
  effects: Effect[];
  prisoners: Prisoner[];
  flag: { x: number; y: number };
  lives: number;
  specialAmmo: number;
  respawnTimer: number;
  state: WorldState;
  extractionTime: number;
  time: number;
  nextId: number;
  cameraTop: number;
  events: GameEvent[];
}

const cellX = (c: number): number => c * TILE;
const feetY = (r: number): number => r * TILE - HALF_TILE;

const WEAPON_SPAWN: Record<WeaponId, (id: number, u: Unit) => Projectile> = { football: kickFootball };
const SPECIAL_SPAWN: Record<SpecialId, (id: number, u: Unit, ducking: boolean) => Projectile> = { airstrike: throwMarker };

export function createWorld(level: LevelData, stats: GameStats, bro: BroDef, rng: () => number = Math.random): World {
  const parsed = parseLevel(level, stats);
  let nextId = 1;
  const spawn = { x: cellX(parsed.player.c), y: feetY(parsed.player.r) };
  const player = makeUnit(nextId++, 'bro', 'player', spawn.x, spawn.y, stats.units.bro);
  const enemies = parsed.enemies.map((e) => makeUnit(nextId++, e.kind, 'enemy', cellX(e.c), feetY(e.r), stats.units[e.kind]));
  return {
    map: parsed.map, stats, bro, rng, player, spawn, enemies, projectiles: [], effects: [],
    prisoners: parsed.cages.map((c) => ({ x: cellX(c.c), y: feetY(c.r), freed: false })),
    flag: { x: cellX(parsed.flag.c), y: feetY(parsed.flag.r) },
    lives: LIVES_START, specialAmmo: stats.units.bro.specialAmmo, respawnTimer: 0,
    state: 'playing', extractionTime: 0, time: 0, nextId, cameraTop: spawn.y + 120, events: [],
  };
}

function intentFrom(c: Controls, prev: Controls): MoveIntent {
  return { dir: c.left === c.right ? 0 : c.left ? -1 : 1, jumpPressed: c.jump && !prev.jump, jumpHeld: c.jump, dash: c.dash };
}

function stepPlayer(w: World, controls: Controls, prev: Controls, t: number): void {
  const p = w.player;
  if (p.dead) {
    if (p.deadTime === 0) {
      w.respawnTimer = RESPAWN_DELAY;
      w.events.push({ type: 'death' });
    }
    p.deadTime += t;
    stepUnit(p, NO_INTENT, w.map, t, w.time);
    w.respawnTimer -= t;
    if (w.respawnTimer <= 0) {
      if (w.lives > 0) {
        w.lives -= 1;
        w.player = makeUnit(w.nextId++, 'bro', 'player', w.spawn.x, w.spawn.y, w.stats.units.bro);
      } else {
        w.state = 'lost';
      }
    }
    return;
  }
  stepUnit(p, intentFrom(controls, prev), w.map, t, w.time);
  p.fireCooldown -= t;
  if (controls.fire && p.fireCooldown <= 0) {
    w.projectiles.push(WEAPON_SPAWN[w.bro.weapon](w.nextId++, p));
    p.fireCooldown = p.stats.fireRate;
  }
  if (controls.special && !prev.special && w.specialAmmo > 0) {
    w.specialAmmo -= 1;
    w.projectiles.push(SPECIAL_SPAWN[w.bro.special](w.nextId++, p, controls.down));
    w.effects.push({ kind: 'speech', x: p.x, y: p.y + 40, age: 0, duration: SPEECH_DURATION, text: w.bro.voiceLine });
    w.events.push({ type: 'voice', text: w.bro.voiceLine });
  }
  if (p.y < -64) damageUnit(p, p.health);
  for (const pr of w.prisoners) {
    if (!pr.freed && Math.abs(p.x - pr.x) < PRISONER_RESCUE_DIST && Math.abs(p.y - pr.y) < PRISONER_RESCUE_DIST) {
      pr.freed = true;
      w.lives += 1;
      w.events.push({ type: 'rescue' });
    }
  }
  if (!p.dead && Math.abs(p.x - w.flag.x) < FLAG_REACH && Math.abs(p.y - w.flag.y) < FLAG_REACH * 2) {
    w.state = 'extracting';
    w.extractionTime = 0;
    w.projectiles = [];
    p.xI = 0;
  }
}

function stepEnemies(w: World, t: number, blasts: Blast[]): void {
  const player = w.player.dead ? null : w.player;
  for (const m of w.enemies) {
    if (m.dead) {
      m.deadTime += t;
      if (m.kind === 'mook_suicide' && m.ai && m.ai.mode !== 'exploded') {
        m.ai.mode = 'exploded'; // MookSuicide blows up when it dies, whatever killed it
        blasts.push(suicideBlast(m.x, m.y + 8, w.stats.suicide));
      }
      stepUnit(m, NO_INTENT, w.map, t, w.time);
      continue;
    }
    const action = thinkMook(m, { map: w.map, player, rng: w.rng }, t);
    stepUnit(m, action.intent, w.map, t, w.time);
    if (action.fire) {
      w.projectiles.push(m.kind === 'mook_bazooka'
        ? fireBazookaRocket(w.nextId++, m, w.stats, w.rng)
        : fireMookBullet(w.nextId++, m, w.stats, w.rng));
    }
    if (action.explode || m.y < -64) damageUnit(m, m.health);
  }
}

function stepProjectiles(w: World, t: number, blasts: Blast[]): void {
  const pw = { map: w.map, units: [w.player, ...w.enemies], stats: w.stats };
  for (const p of [...w.projectiles]) {
    for (const ev of stepProjectile(p, pw, t)) {
      if (ev.type === 'explode') blasts.push(ev.blast);
      else w.projectiles.push(...spawnAirstrike(() => w.nextId++, ev.x, ev.y, w.cameraTop, w.stats, w.rng));
    }
  }
}

/** Applies blasts in order; destroyed barrels append their own blast, and each barrel can only be destroyed once. */
function resolveBlasts(w: World, blasts: Blast[]): void {
  const units = [w.player, ...w.enemies];
  for (let i = 0; i < blasts.length; i++) {
    const b = blasts[i];
    const res = applyBlast(w.map, units, b);
    w.effects.push({ kind: b.big ? 'explosion' : 'explosion_small', x: b.x, y: b.y, age: 0, duration: EXPLOSION_DURATION });
    w.events.push({ type: 'explosion' });
    for (const d of res.destroyed) {
      if (d.kind === 'barrel') blasts.push(barrelBlast(cellX(d.c), d.r * TILE, w.stats.barrelRange));
    }
  }
}

function ageEffects(w: World, t: number): void {
  for (const e of w.effects) e.age += t;
  w.effects = w.effects.filter((e) => e.age < e.duration);
}

export function stepWorld(w: World, controls: Controls, prev: Controls, t: number): void {
  if (w.state === 'won' || w.state === 'lost') return;
  w.time += t;
  if (w.state === 'extracting') {
    w.extractionTime += t;
    if (w.extractionTime >= EXTRACTION_TIME) w.state = 'won';
    ageEffects(w, t);
    return;
  }
  const blasts: Blast[] = [];
  stepPlayer(w, controls, prev, t);
  stepEnemies(w, t, blasts);
  stepProjectiles(w, t, blasts);
  resolveBlasts(w, blasts);
  ageEffects(w, t);
  w.enemies = w.enemies.filter((e) => !(e.dead && e.deadTime > CORPSE_TIME));
  w.projectiles = w.projectiles.filter((p) => !p.dead);
}
```

- [ ] **Step 4: Run the tests to see them pass, then the whole suite**

Run: `cd /c/Users/rinal/Desktop/REA-BROFORCE/web && npx vitest run src/engine/world.test.ts && npx vitest run && npx tsc --noEmit`
Expected: `9 passed` for the world file; the full suite passes (70 tests across 10 files); tsc prints nothing.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/rinal/Desktop/REA-BROFORCE && git add web/src/engine/bro.ts web/src/engine/bro.test.ts web/src/bros web/src/engine/world.ts web/src/engine/world.test.ts && git commit -m "$(cat <<'EOF'
engine: data-driven bros, Brolusconi, and the world simulation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Assets, animation, camera and the canvas renderer

**Files:**
- Create: `web/src/render/assets.ts`
- Create: `web/src/render/animation.ts`
- Create: `web/src/render/camera.ts`
- Create: `web/src/render/renderer.ts`
- Test: `web/src/render/assets.test.ts`
- Test: `web/src/render/animation.test.ts`
- Test: `web/src/render/camera.test.ts`

**Interfaces:**
- Consumes: `parseValues`, `RAW_VALUES`, `TEST_STATS`, `makeUnit`, `World`, `getColumn`, `getRow`, constants, types.
- Produces:
  - `SheetInfo { file; frameW; frameH; offsetY; cols; rows }`, `SHEET_KEYS`, `SheetKey`, `isSheetKey(s): s is SheetKey`, `Assets { sheets; images; stats }`, `MissingGameDataError`, `missingSheets(sheets): SheetKey[]`, `loadData(fetcher = fetch)`, `loadAssets(): Promise<Assets>`.
  - `Frame { col; row }`, `unitFrame(u): Frame`, `stripFrame(age, duration, cols)`, `loopFrame(time, frameRate, cols)`.
  - `VIEW_W = 400`, `VIEW_H = 225`, `Camera { x; y }`, `followCamera(cam, target, map, dt)`.
  - `class Renderer(ctx, assets, scale, playerSheet: SheetKey)` with `render(world, dt)`; it sets `world.cameraTop` and shakes the view for `SHAKE_TIME` after big explosions.

- [ ] **Step 1: Write the failing tests**

Create `web/src/render/assets.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { RAW_VALUES, TEST_STATS } from '../engine/testStats';
import { MissingGameDataError, SHEET_KEYS, isSheetKey, loadData, missingSheets } from './assets';

type Reply = { status: number; body: string };
const fakeFetch = (replies: Record<string, Reply>) =>
  (async (url: string) => {
    const r = replies[url] ?? { status: 404, body: '' };
    return new Response(r.body, { status: r.status });
  }) as unknown as typeof fetch;

const sheets = Object.fromEntries(SHEET_KEYS.map((k) => [k, { file: `sprites/${k}.png`, frameW: 16, frameH: 16, offsetY: 0, cols: 1, rows: 1 }]));

describe('loadData', () => {
  it('lists sheets that are missing and recognises sheet keys', () => {
    expect(missingSheets({ brolusconi: {} })).toContain('mook');
    expect(missingSheets(sheets)).toEqual([]);
    expect(isSheetKey('brolusconi')).toBe(true);
    expect(isSheetKey('rambro')).toBe(false);
  });

  it('loads sheets and parses values', async () => {
    const data = await loadData(fakeFetch({
      '/sheets.json': { status: 200, body: JSON.stringify(sheets) },
      '/values.json': { status: 200, body: JSON.stringify(RAW_VALUES) },
    }));
    expect(data.stats).toEqual(TEST_STATS);
  });

  it('rejects HTML served for JSON (the dev server fallback when game-data is missing)', async () => {
    const html = { status: 200, body: '<!doctype html><html></html>' };
    await expect(loadData(fakeFetch({ '/sheets.json': html, '/values.json': html }))).rejects.toBeInstanceOf(MissingGameDataError);
  });

  it('rejects a 404 and incomplete data', async () => {
    await expect(loadData(fakeFetch({}))).rejects.toBeInstanceOf(MissingGameDataError);
    await expect(loadData(fakeFetch({
      '/sheets.json': { status: 200, body: JSON.stringify(sheets) },
      '/values.json': { status: 200, body: JSON.stringify({ bro_base: {} }) },
    }))).rejects.toBeInstanceOf(MissingGameDataError);
  });
});
```

Create `web/src/render/animation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { TEST_STATS } from '../engine/testStats';
import { makeUnit } from '../engine/units';
import { loopFrame, stripFrame, unitFrame } from './animation';

const bro = (patch: Partial<ReturnType<typeof makeUnit>>) =>
  Object.assign(makeUnit(1, 'bro', 'player', 0, 8, TEST_STATS.units.bro), { onGround: true }, patch);

describe('unitFrame (TestVanDammeAnim.Animate*)', () => {
  it('idles on row 0, column 0', () => {
    expect(unitFrame(bro({}))).toEqual({ col: 0, row: 0 });
  });

  it('runs on row 1 at runningFrameRate 0.025, and dashes on row 3', () => {
    expect(unitFrame(bro({ xI: 110, animTime: 0.06 }))).toEqual({ col: 2, row: 1 });
    expect(unitFrame(bro({ xI: 110, animTime: 0.06, dashing: true }))).toEqual({ col: 2, row: 3 });
  });

  it('uses the new jumping frames on row 2', () => {
    expect(unitFrame(bro({ onGround: false, yI: 100, xI: 100 }))).toEqual({ col: 0, row: 2 });
    expect(unitFrame(bro({ onGround: false, yI: 100, xI: 0 }))).toEqual({ col: 6, row: 2 });
    expect(unitFrame(bro({ onGround: false, yI: -100, xI: 100 }))).toEqual({ col: 3, row: 2 });
    expect(unitFrame(bro({ onGround: false, yI: -100, xI: 0 }))).toEqual({ col: 9, row: 2 });
  });

  it('climbs on row 2, columns 12-16', () => {
    expect(unitFrame(bro({ onGround: false, wallClimbing: true, animTime: 0.07 }))).toEqual({ col: 14, row: 2 });
  });

  it('lies dead on column 5, or column 4 while falling', () => {
    expect(unitFrame(bro({ dead: true }))).toEqual({ col: 5, row: 0 });
    expect(unitFrame(bro({ dead: true, onGround: false }))).toEqual({ col: 4, row: 0 });
  });
});

describe('frame helpers', () => {
  it('stripFrame walks an effect strip once and stops on the last frame', () => {
    expect(stripFrame(0.25, 0.5, 16)).toBe(8);
    expect(stripFrame(0.6, 0.5, 16)).toBe(15);
  });

  it('loopFrame cycles', () => {
    expect(loopFrame(0.07, 0.03, 21)).toBe(2);
    expect(loopFrame(0.67, 0.03, 21)).toBe(1);
  });
});
```

Create `web/src/render/camera.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { VIEW_H, VIEW_W, followCamera } from './camera';

const map = { cols: 120, rows: 18 };

describe('followCamera (SortOfFollow)', () => {
  it('snaps to the target with a large dt and keeps the view inside the map', () => {
    const cam = { x: 0, y: 0 };
    followCamera(cam, { x: 0, y: 0 }, map, 1);
    expect(cam.x).toBe(-8 + VIEW_W / 2);
    expect(cam.y).toBe(-8 + VIEW_H / 2);
  });

  it('eases towards the target', () => {
    const cam = { x: 500, y: 150 };
    followCamera(cam, { x: 600, y: 110 }, map, 1 / 60);
    expect(cam.x).toBeGreaterThan(500);
    expect(cam.x).toBeLessThan(600);
  });

  it('stops at the right edge', () => {
    const cam = { x: 0, y: 0 };
    followCamera(cam, { x: 5000, y: 100 }, map, 1);
    expect(cam.x).toBe(120 * 16 - 8 - VIEW_W / 2);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `cd /c/Users/rinal/Desktop/REA-BROFORCE/web && npx vitest run src/render`
Expected: FAIL — `Failed to resolve import "./assets"` (and the other two modules)

- [ ] **Step 3: Implement asset loading**

Create `web/src/render/assets.ts`:

```ts
import { parseValues } from '../engine/stats';
import type { GameStats } from '../engine/types';

export interface SheetInfo {
  file: string;
  frameW: number;
  frameH: number;
  offsetY: number;
  cols: number;
  rows: number;
}

export const SHEET_KEYS = [
  'brolusconi', 'mook', 'mook_suicide', 'mook_bazooka', 'prisoner', 'cage', 'helicopter', 'bullet', 'rocket',
  'bomb', 'marker', 'block_dirt', 'block_brick', 'block_steel', 'block_barrel', 'flagpole', 'flag', 'explosion',
  'explosion_small',
] as const;
export type SheetKey = (typeof SHEET_KEYS)[number];

export interface Assets {
  sheets: Record<SheetKey, SheetInfo>;
  images: Record<SheetKey, HTMLImageElement>;
  stats: GameStats;
}

export class MissingGameDataError extends Error {}

export function isSheetKey(s: string): s is SheetKey {
  return (SHEET_KEYS as readonly string[]).includes(s);
}

export function missingSheets(sheets: Record<string, unknown>): SheetKey[] {
  return SHEET_KEYS.filter((k) => !(k in sheets));
}

async function fetchJson(url: string, fetcher: typeof fetch): Promise<unknown> {
  let res: Response;
  try {
    res = await fetcher(url);
  } catch {
    throw new MissingGameDataError(`cannot fetch ${url}`);
  }
  if (!res.ok) throw new MissingGameDataError(`${url}: HTTP ${res.status}`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new MissingGameDataError(`${url} is not JSON: game-data/ has not been extracted`);
  }
}

export async function loadData(fetcher: typeof fetch = fetch): Promise<{ sheets: Record<SheetKey, SheetInfo>; stats: GameStats }> {
  const sheets = (await fetchJson('/sheets.json', fetcher)) as Record<string, SheetInfo>;
  const missing = missingSheets(sheets);
  if (missing.length > 0) throw new MissingGameDataError(`sheets.json lacks: ${missing.join(', ')}`);
  const raw = (await fetchJson('/values.json', fetcher)) as Record<string, Record<string, unknown>>;
  try {
    return { sheets: sheets as Record<SheetKey, SheetInfo>, stats: parseValues(raw) };
  } catch (e) {
    throw new MissingGameDataError(e instanceof Error ? e.message : String(e));
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new MissingGameDataError(`cannot load ${src}`));
    img.src = src;
  });
}

export async function loadAssets(): Promise<Assets> {
  const { sheets, stats } = await loadData();
  const entries = await Promise.all(SHEET_KEYS.map(async (k) => [k, await loadImage(`/${sheets[k].file}`)] as const));
  return { sheets, stats, images: Object.fromEntries(entries) as Record<SheetKey, HTMLImageElement> };
}
```

- [ ] **Step 4: Implement animation and camera**

Create `web/src/render/animation.ts`:

```ts
import { CLIMB_FRAME_RATE, JUMP_FRAME_RATE, RUN_FRAME_RATE } from '../engine/constants';
import type { Unit } from '../engine/types';

export interface Frame {
  col: number;
  row: number; // counted from the top of the sheet
}

/** Body frame after TestVanDammeAnim's Animate* methods (lowerLeftPixel y = (row + 1) * 32). */
export function unitFrame(u: Unit): Frame {
  if (u.dead) return { col: u.onGround ? 5 : 4, row: 0 }; // AnimateActualDeath / AnimateFallingDeath
  if (u.wallClimbing) return { col: 12 + (Math.floor(u.animTime / CLIMB_FRAME_RATE) % 5), row: 2 }; // AnimateWallClimb
  if (!u.onGround) {
    // AnimateActualJumpingFrames (useNewFrames)
    const fast = Math.abs(u.xI) > 50;
    const f = Math.floor(u.animTime / JUMP_FRAME_RATE) % 3;
    if (u.yI > 20) return { col: (fast ? 0 : 6) + f, row: 2 };
    return { col: (fast ? 3 : 9) + f, row: 2 };
  }
  if (Math.abs(u.xI) > 1) {
    return { col: Math.floor(u.animTime / RUN_FRAME_RATE) % 8, row: u.dashing ? 3 : 1 }; // AnimateActualNewRunningFrames
  }
  return { col: 0, row: 0 }; // AnimateActualIdleFrames
}

export function stripFrame(age: number, duration: number, cols: number): number {
  return Math.min(cols - 1, Math.floor((age / duration) * cols));
}

export function loopFrame(time: number, frameRate: number, cols: number): number {
  return Math.floor(time / frameRate) % cols;
}
```

Create `web/src/render/camera.ts`:

```ts
import { CAMERA_LERP, CAMERA_Y_OFFSET, HALF_TILE, TILE } from '../engine/constants';

export const VIEW_W = 400; // world units visible across (16:9)
export const VIEW_H = 225;

export interface Camera {
  x: number; // centre of the view
  y: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/** Eases towards the target (a little above it, like SortOfFollow) and keeps the view inside the map. */
export function followCamera(cam: Camera, target: { x: number; y: number }, map: { cols: number; rows: number }, dt: number): void {
  const k = Math.min(1, dt * CAMERA_LERP);
  cam.x += (target.x - cam.x) * k;
  cam.y += (target.y + CAMERA_Y_OFFSET - cam.y) * k;
  cam.x = clamp(cam.x, -HALF_TILE + VIEW_W / 2, map.cols * TILE - HALF_TILE - VIEW_W / 2);
  cam.y = clamp(cam.y, -HALF_TILE + VIEW_H / 2, map.rows * TILE - HALF_TILE - VIEW_H / 2);
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `cd /c/Users/rinal/Desktop/REA-BROFORCE/web && npx vitest run src/render`
Expected: `14 passed`

- [ ] **Step 6: Implement the renderer**

Create `web/src/render/renderer.ts`:

```ts
import { EXTRACTION_TIME, SHAKE_AMOUNT, SHAKE_TIME, TILE } from '../engine/constants';
import { getColumn, getRow } from '../engine/map';
import type { BlockKind, Projectile, Unit, UnitKind } from '../engine/types';
import type { Effect, World } from '../engine/world';
import { loopFrame, stripFrame, unitFrame } from './animation';
import type { Assets, SheetKey } from './assets';
import { VIEW_H, VIEW_W, followCamera, type Camera } from './camera';

const ENEMY_SHEETS: Record<Exclude<UnitKind, 'bro'>, SheetKey> = {
  mook: 'mook', mook_suicide: 'mook_suicide', mook_bazooka: 'mook_bazooka',
};
const BLOCK_SHEETS: Record<BlockKind, SheetKey> = {
  dirt: 'block_dirt', brick: 'block_brick', steel: 'block_steel', barrel: 'block_barrel',
};
const SKY = '#7fb2e5';

export class Renderer {
  readonly camera: Camera = { x: 0, y: 0 };
  private snapped = false;
  private shakeX = 0;
  private shakeY = 0;

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly assets: Assets,
    private readonly scale: number,
    private readonly playerSheet: SheetKey,
  ) {}

  render(w: World, dt: number): void {
    const target = w.state === 'extracting' ? w.flag : w.player;
    followCamera(this.camera, target, w.map, this.snapped ? dt : 1);
    this.snapped = true;
    w.cameraTop = this.camera.y + VIEW_H / 2;
    const shake = w.effects.reduce((s, e) => (e.kind === 'explosion' ? Math.max(s, 1 - e.age / SHAKE_TIME) : s), 0);
    this.shakeX = (Math.random() * 2 - 1) * SHAKE_AMOUNT * shake;
    this.shakeY = (Math.random() * 2 - 1) * SHAKE_AMOUNT * shake;
    const { ctx } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = SKY;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    this.drawBlocks(w);
    this.drawFlag(w);
    this.drawPrisoners(w);
    for (const e of w.enemies) this.drawUnit(e);
    const boarded = w.state === 'extracting' && w.extractionTime >= EXTRACTION_TIME / 2;
    if (!boarded) this.drawUnit(w.player);
    for (const p of w.projectiles) this.drawProjectile(p, w.time);
    for (const e of w.effects) this.drawEffect(e, w);
    if (w.state === 'extracting') this.drawHelicopter(w);
  }

  private sx(x: number): number {
    return (x - (this.camera.x + this.shakeX - VIEW_W / 2)) * this.scale;
  }

  private sy(y: number): number {
    return (this.camera.y + this.shakeY + VIEW_H / 2 - y) * this.scale;
  }

  /** Draws frame (col, row) of a sheet centred on world (x, y). */
  private sprite(key: SheetKey, col: number, row: number, x: number, y: number, flip = false, angle = 0): void {
    const info = this.assets.sheets[key];
    const w = info.frameW * this.scale;
    const h = info.frameH * this.scale;
    const { ctx } = this;
    ctx.save();
    ctx.translate(this.sx(x), this.sy(y));
    if (angle) ctx.rotate(angle);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(this.assets.images[key], col * info.frameW, row * info.frameH, info.frameW, info.frameH, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  private drawBlocks(w: World): void {
    const c0 = getColumn(this.camera.x - VIEW_W / 2) - 1;
    const c1 = getColumn(this.camera.x + VIEW_W / 2) + 1;
    const r0 = getRow(this.camera.y - VIEW_H / 2) - 1;
    const r1 = getRow(this.camera.y + VIEW_H / 2) + 1;
    for (let c = c0; c <= c1; c++) {
      for (let r = r0; r <= r1; r++) {
        const b = w.map.get(c, r);
        if (b) this.sprite(BLOCK_SHEETS[b.kind], 0, 0, c * TILE, r * TILE);
      }
    }
  }

  private drawUnit(u: Unit): void {
    if (u.kind === 'mook_suicide' && u.ai?.mode === 'exploded') return;
    const key = u.kind === 'bro' ? this.playerSheet : ENEMY_SHEETS[u.kind];
    const f = unitFrame(u);
    // SpriteSM offset: the 32x32 frame is centred offsetY above the feet.
    this.sprite(key, f.col, f.row, u.x, u.y + this.assets.sheets[key].offsetY, u.facing < 0);
  }

  private drawFlag(w: World): void {
    const pole = this.assets.sheets.flagpole;
    this.sprite('flagpole', 0, 0, w.flag.x, w.flag.y + pole.frameH / 2);
    this.sprite('flag', 0, 0, w.flag.x + 8, w.flag.y + pole.frameH - 8);
  }

  private drawPrisoners(w: World): void {
    for (const p of w.prisoners) {
      if (p.freed) continue;
      this.sprite('prisoner', loopFrame(w.time, 0.1, 8), 0, p.x, p.y + this.assets.sheets.prisoner.offsetY);
      this.sprite('cage', 0, 0, p.x, p.y + 16);
    }
  }

  private drawProjectile(p: Projectile, time: number): void {
    const angle = Math.atan2(-p.yI, Math.abs(p.xI)) * Math.sign(p.xI || 1);
    switch (p.kind) {
      case 'bullet':
        this.sprite('bullet', loopFrame(time, 0.05, this.assets.sheets.bullet.cols), 0, p.x, p.y, p.xI < 0);
        break;
      case 'rocket':
        this.sprite('rocket', 0, 0, p.x, p.y, p.xI < 0);
        break;
      case 'bomb':
        this.sprite('bomb', 0, 0, p.x, p.y, false, angle);
        break;
      case 'marker':
        this.sprite('marker', 0, 0, p.x, p.y + 4);
        break;
      case 'football':
        this.drawFootball(p, time);
        break;
    }
  }

  /** The football is our own art: a white ball with spinning black patches. */
  private drawFootball(p: Projectile, time: number): void {
    const { ctx } = this;
    const r = 3.5 * this.scale;
    ctx.save();
    ctx.translate(this.sx(p.x), this.sy(p.y));
    ctx.rotate(time * 12 * Math.sign(p.xI || 1));
    ctx.fillStyle = '#f4f1e8';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = this.scale;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.fillRect(-this.scale, -this.scale, this.scale * 2, this.scale * 2);
    ctx.fillRect(r * 0.5, -r * 0.6, this.scale, this.scale);
    ctx.fillRect(-r * 0.9, r * 0.3, this.scale, this.scale);
    ctx.restore();
  }

  private drawEffect(e: Effect, w: World): void {
    if (e.kind === 'speech') {
      this.drawSpeech(e.text ?? '', w.player.x, w.player.y + 36);
      return;
    }
    const key = e.kind === 'explosion' ? 'explosion' : 'explosion_small';
    this.sprite(key, stripFrame(e.age, e.duration, this.assets.sheets[key].cols), 0, e.x, e.y);
  }

  private drawSpeech(text: string, x: number, y: number): void {
    const { ctx } = this;
    const s = this.scale;
    ctx.save();
    ctx.font = `bold ${7 * s}px ui-monospace, Consolas, monospace`;
    const width = ctx.measureText(text).width + 8 * s;
    const height = 14 * s;
    const left = this.sx(x) - width / 2;
    const top = this.sy(y) - height;
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = s;
    ctx.beginPath();
    ctx.roundRect(left, top, width, height, 3 * s);
    ctx.moveTo(this.sx(x) - 3 * s, top + height);
    ctx.lineTo(this.sx(x), top + height + 5 * s);
    ctx.lineTo(this.sx(x) + 3 * s, top + height);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#000';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, left + 4 * s, top + height / 2);
    ctx.restore();
  }

  private drawHelicopter(w: World): void {
    const half = EXTRACTION_TIME / 2;
    const arrive = Math.min(1, w.extractionTime / half);
    const leave = Math.max(0, w.extractionTime - half);
    const x = w.flag.x - 220 * (1 - arrive);
    const y = w.flag.y + 48 + 72 * (1 - arrive) + leave * 120;
    this.sprite('helicopter', loopFrame(w.time, 0.03, this.assets.sheets.helicopter.cols), 0, x, y);
  }
}
```

- [ ] **Step 7: Typecheck and run the whole suite**

Run: `cd /c/Users/rinal/Desktop/REA-BROFORCE/web && npx tsc --noEmit && npx vitest run`
Expected: tsc prints nothing; all 84 tests pass.

- [ ] **Step 8: Commit**

```bash
cd /c/Users/rinal/Desktop/REA-BROFORCE && git add web/src/render && git commit -m "$(cat <<'EOF'
render: asset loading, ported animation frames, camera and canvas renderer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Input, loop, React shell, playtest and findings

**Files:**
- Create: `web/src/app/input.ts`
- Create: `web/src/app/loop.ts`
- Create: `web/src/app/hudStore.ts`
- Create: `web/src/app/speech.ts`
- Create: `web/src/app/settings.ts`
- Create: `web/src/ui/App.tsx`, `web/src/ui/Menu.tsx`, `web/src/ui/GameView.tsx`, `web/src/ui/Hud.tsx`, `web/src/ui/EndScreen.tsx`, `web/src/ui/MissingData.tsx`, `web/src/ui/styles.css`
- Create: `web/src/main.tsx`
- Create: `docs/findings.md`
- Test: `web/src/app/input.test.ts`, `web/src/app/loop.test.ts`, `web/src/app/hudStore.test.ts`

**Interfaces:**
- Consumes: `createWorld`, `stepWorld`, `World`, `BROLUSCONI`, `buildLevel1`, `Renderer`, `VIEW_W`, `VIEW_H`, `loadAssets`, `isSheetKey`, `Assets`, `Controls`, `NO_CONTROLS`, `FIXED_DT`, `LIVES_START`.
- Produces: `KEY_BINDINGS`, `controlsFromKeys(down)`, `class Keyboard { attach(target); detach(); snapshot() }`; `MAX_FRAME_TIME`, `advance(acc, frameTime, step)`, `createLoop(step, render)`; `createHudStore(initial)`, `HudStore`, `HudState`; `speak(text, enabled)`; `loadVoiceSetting()`, `saveVoiceSetting(on)`; React components.

- [ ] **Step 1: Write the failing tests**

Create `web/src/app/input.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Keyboard, controlsFromKeys } from './input';

const key = (type: string, code: string) => Object.assign(new Event(type), { code });

describe('input', () => {
  it('maps arrows/WASD, jump, fire, special and dash', () => {
    const c = controlsFromKeys(new Set(['ArrowLeft', 'KeyZ', 'KeyX', 'KeyC', 'ShiftLeft']));
    expect(c).toEqual({ left: true, right: false, up: false, down: false, jump: true, fire: true, special: true, dash: true });
    expect(controlsFromKeys(new Set(['KeyD', 'KeyS'])).right).toBe(true);
  });

  it('tracks key presses and releases', () => {
    const target = new EventTarget();
    const kb = new Keyboard();
    kb.attach(target);
    target.dispatchEvent(key('keydown', 'KeyX'));
    expect(kb.snapshot().fire).toBe(true);
    target.dispatchEvent(key('keyup', 'KeyX'));
    expect(kb.snapshot().fire).toBe(false);
  });

  it('blur releases held keys', () => {
    const target = new EventTarget();
    const kb = new Keyboard();
    kb.attach(target);
    target.dispatchEvent(key('keydown', 'ArrowRight'));
    target.dispatchEvent(new Event('blur'));
    expect(kb.snapshot().right).toBe(false);
    kb.detach();
    target.dispatchEvent(key('keydown', 'ArrowRight'));
    expect(kb.snapshot().right).toBe(false);
  });
});
```

Create `web/src/app/loop.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { FIXED_DT } from '../engine/constants';
import { advance } from './loop';

function count(frameTime: number, acc = 0) {
  let steps = 0;
  const left = advance(acc, frameTime, () => steps++);
  return { steps, left };
}

describe('advance (fixed timestep)', () => {
  it('runs one step per 1/60 s and keeps the remainder', () => {
    expect(count(1 / 30).steps).toBe(2);
    const r = count(FIXED_DT * 1.5);
    expect(r.steps).toBe(1);
    expect(r.left).toBeCloseTo(FIXED_DT * 0.5, 9);
  });

  it('advance clamps long frames (a backgrounded tab) to 0.25 s', () => {
    const { steps } = count(5);
    expect(steps).toBeGreaterThanOrEqual(14);
    expect(steps).toBeLessThanOrEqual(15);
  });

  it('ignores negative frame times', () => {
    expect(count(-1).steps).toBe(0);
  });
});
```

Create `web/src/app/hudStore.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createHudStore } from './hudStore';

describe('createHudStore', () => {
  it('notifies only when lives or ammo change', () => {
    const store = createHudStore({ lives: 3, ammo: 4 });
    let calls = 0;
    const off = store.subscribe(() => calls++);
    store.set({ lives: 3, ammo: 4 });
    expect(calls).toBe(0);
    store.set({ lives: 3, ammo: 3 });
    expect(calls).toBe(1);
    expect(store.get()).toEqual({ lives: 3, ammo: 3 });
    off();
    store.set({ lives: 2, ammo: 3 });
    expect(calls).toBe(1);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `cd /c/Users/rinal/Desktop/REA-BROFORCE/web && npx vitest run src/app`
Expected: FAIL — `Failed to resolve import "./input"` (and the others)

- [ ] **Step 3: Implement input, loop and HUD store**

Create `web/src/app/input.ts`:

```ts
import { NO_CONTROLS, type Controls } from '../engine/types';

export const KEY_BINDINGS: Record<string, keyof Controls> = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  KeyZ: 'jump', Space: 'jump',
  KeyX: 'fire', KeyJ: 'fire',
  KeyC: 'special', KeyK: 'special',
  ShiftLeft: 'dash', ShiftRight: 'dash',
};

export function controlsFromKeys(down: ReadonlySet<string>): Controls {
  const c: Controls = { ...NO_CONTROLS };
  for (const code of down) {
    const control = KEY_BINDINGS[code];
    if (control) c[control] = true;
  }
  return c;
}

export class Keyboard {
  private readonly down = new Set<string>();
  private target: EventTarget | null = null;

  private readonly onDown = (e: Event) => {
    const code = (e as KeyboardEvent).code;
    if (code in KEY_BINDINGS) {
      this.down.add(code);
      e.preventDefault();
    }
  };

  private readonly onUp = (e: Event) => {
    this.down.delete((e as KeyboardEvent).code);
  };

  private readonly onBlur = () => {
    this.down.clear();
  };

  attach(target: EventTarget): void {
    this.target = target;
    target.addEventListener('keydown', this.onDown);
    target.addEventListener('keyup', this.onUp);
    target.addEventListener('blur', this.onBlur);
  }

  detach(): void {
    this.target?.removeEventListener('keydown', this.onDown);
    this.target?.removeEventListener('keyup', this.onUp);
    this.target?.removeEventListener('blur', this.onBlur);
    this.target = null;
    this.down.clear();
  }

  snapshot(): Controls {
    return controlsFromKeys(this.down);
  }
}
```

Create `web/src/app/loop.ts`:

```ts
import { FIXED_DT } from '../engine/constants';

export const MAX_FRAME_TIME = 0.25;

/** Runs as many fixed steps as the accumulated time allows and returns the leftover. */
export function advance(accumulator: number, frameTime: number, step: (dt: number) => void): number {
  let acc = accumulator + Math.min(Math.max(frameTime, 0), MAX_FRAME_TIME);
  while (acc >= FIXED_DT - 1e-9) {
    step(FIXED_DT);
    acc -= FIXED_DT;
  }
  return acc;
}

export function createLoop(step: (dt: number) => void, render: (frameTime: number) => void) {
  let acc = 0;
  let last = 0;
  let raf = 0;
  let running = false;
  const frame = (now: number) => {
    if (!running) return;
    const frameTime = last ? (now - last) / 1000 : FIXED_DT;
    last = now;
    acc = advance(acc, frameTime, step);
    render(Math.min(frameTime, MAX_FRAME_TIME));
    raf = requestAnimationFrame(frame);
  };
  return {
    start() {
      running = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
  };
}
```

Create `web/src/app/hudStore.ts`:

```ts
export interface HudState {
  lives: number;
  ammo: number;
}

export function createHudStore(initial: HudState) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: (): HudState => state,
    set(next: HudState): void {
      if (next.lives === state.lives && next.ammo === state.ammo) return;
      state = next;
      for (const l of listeners) l();
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type HudStore = ReturnType<typeof createHudStore>;
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `cd /c/Users/rinal/Desktop/REA-BROFORCE/web && npx vitest run src/app`
Expected: `7 passed`

- [ ] **Step 5: Add speech and the voice setting**

Create `web/src/app/speech.ts`:

```ts
/** Says the line with the browser's generic Italian voice (no recording of the real person). */
export function speak(text: string, enabled: boolean): void {
  if (!enabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'it-IT';
  utterance.rate = 1.05;
  utterance.pitch = 0.9;
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith('it'));
  if (voice) utterance.voice = voice;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}
```

Create `web/src/app/settings.ts`:

```ts
const VOICE_KEY = 'brolusconi.voice';

export function loadVoiceSetting(): boolean {
  try {
    return localStorage.getItem(VOICE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function saveVoiceSetting(on: boolean): void {
  try {
    localStorage.setItem(VOICE_KEY, on ? 'on' : 'off');
  } catch {
    // storage unavailable: the choice lasts for this session only
  }
}
```

- [ ] **Step 6: Build the React shell**

Create `web/src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './ui/styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('index.html is missing #root');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

Create `web/src/ui/App.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react';
import { loadVoiceSetting, saveVoiceSetting } from '../app/settings';
import { loadAssets, type Assets } from '../render/assets';
import { EndScreen } from './EndScreen';
import { GameView } from './GameView';
import { Menu } from './Menu';
import { MissingData } from './MissingData';

type Screen =
  | { name: 'loading' }
  | { name: 'missing'; reason: string }
  | { name: 'menu' }
  | { name: 'playing' }
  | { name: 'end'; result: 'won' | 'lost' };

export function App() {
  const [assets, setAssets] = useState<Assets | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: 'loading' });
  const [voice, setVoice] = useState(loadVoiceSetting);
  const [run, setRun] = useState(0);

  useEffect(() => {
    let alive = true;
    loadAssets()
      .then((a) => {
        if (!alive) return;
        setAssets(a);
        setScreen({ name: 'menu' });
      })
      .catch((e: unknown) => {
        if (alive) setScreen({ name: 'missing', reason: e instanceof Error ? e.message : String(e) });
      });
    return () => {
      alive = false;
    };
  }, []);

  const onEnd = useCallback((result: 'won' | 'lost') => setScreen({ name: 'end', result }), []);
  const start = useCallback(() => {
    setRun((r) => r + 1);
    setScreen({ name: 'playing' });
  }, []);
  const toggleVoice = useCallback(() => {
    setVoice((v) => {
      saveVoiceSetting(!v);
      return !v;
    });
  }, []);

  if (screen.name === 'loading') return <div className="screen">Caricamento…</div>;
  if (screen.name === 'missing') return <MissingData reason={screen.reason} />;
  if (!assets) return null;
  if (screen.name === 'menu') return <Menu voice={voice} onToggleVoice={toggleVoice} onStart={start} />;
  if (screen.name === 'playing') return <GameView key={run} assets={assets} voice={voice} onEnd={onEnd} />;
  return <EndScreen result={screen.result} onRestart={start} onMenu={() => setScreen({ name: 'menu' })} />;
}
```

Create `web/src/ui/Menu.tsx`:

```tsx
import { useEffect } from 'react';

interface Props {
  voice: boolean;
  onToggleVoice: () => void;
  onStart: () => void;
}

export function Menu({ voice, onToggleVoice, onStart }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter') onStart();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onStart]);

  return (
    <div className="screen menu">
      <h1>
        BROFORCE<span>BROLUSCONI</span>
      </h1>
      <table className="controls">
        <tbody>
          <tr><td>← → / A D</td><td>Muoviti</td></tr>
          <tr><td>Z / Spazio</td><td>Salta (tienilo premuto contro un muro per arrampicarti)</td></tr>
          <tr><td>X / J</td><td>Calcia un pallone esplosivo</td></tr>
          <tr><td>C / K</td><td>Attacco aereo (con ↓ lo lanci corto)</td></tr>
          <tr><td>Shift</td><td>Scatto</td></tr>
        </tbody>
      </table>
      <label className="toggle">
        <input type="checkbox" checked={voice} onChange={onToggleVoice} /> Voce (sintesi vocale)
      </label>
      <button onClick={onStart} autoFocus>
        Inizia (Invio)
      </button>
      <p className="note">Uso personale: sprite e valori estratti dalla tua copia di Broforce (© Free Lives).</p>
    </div>
  );
}
```

Create `web/src/ui/Hud.tsx`:

```tsx
import { useSyncExternalStore } from 'react';
import type { HudStore } from '../app/hudStore';

export function Hud({ store, portrait }: { store: HudStore; portrait: string }) {
  const hud = useSyncExternalStore(store.subscribe, store.get);
  return (
    <div className="hud">
      <div className="portrait" style={{ backgroundImage: `url(${portrait})` }} />
      <div className="lives">Vite × {hud.lives}</div>
      <div className="ammo" aria-label={`Attacchi aerei: ${hud.ammo}`}>
        {Array.from({ length: hud.ammo }, (_, i) => (
          <span key={i} className="pip" />
        ))}
      </div>
    </div>
  );
}
```

Create `web/src/ui/GameView.tsx`:

```tsx
import { useEffect, useMemo, useRef } from 'react';
import { createHudStore } from '../app/hudStore';
import { Keyboard } from '../app/input';
import { createLoop } from '../app/loop';
import { speak } from '../app/speech';
import { BROLUSCONI } from '../bros';
import { LIVES_START } from '../engine/constants';
import { NO_CONTROLS, type Controls } from '../engine/types';
import { createWorld, stepWorld } from '../engine/world';
import { buildLevel1 } from '../levels/level1';
import { isSheetKey, type Assets } from '../render/assets';
import { VIEW_H, VIEW_W } from '../render/camera';
import { Renderer } from '../render/renderer';
import { Hud } from './Hud';

const SCALE = 3;
const BRO = BROLUSCONI;
if (!isSheetKey(BRO.sheet)) throw new Error(`bro ${BRO.id}: sheet '${BRO.sheet}' is not extracted`);
const BRO_SHEET = BRO.sheet;

interface Props {
  assets: Assets;
  voice: boolean;
  onEnd: (result: 'won' | 'lost') => void;
}

export function GameView({ assets, voice, onEnd }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hud = useMemo(() => createHudStore({ lives: LIVES_START, ammo: assets.stats.units.bro.specialAmmo }), [assets]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const world = createWorld(buildLevel1(), assets.stats, BRO);
    const renderer = new Renderer(ctx, assets, SCALE, BRO_SHEET);
    const keyboard = new Keyboard();
    keyboard.attach(window);
    let prev: Controls = NO_CONTROLS;
    let ended = false;
    let endTimer = 0;
    const loop = createLoop(
      (dt) => {
        const controls = keyboard.snapshot();
        stepWorld(world, controls, prev, dt);
        prev = controls;
        for (const e of world.events.splice(0)) if (e.type === 'voice') speak(e.text, voice);
        hud.set({ lives: world.lives, ammo: world.specialAmmo });
        if (!ended && (world.state === 'won' || world.state === 'lost')) {
          ended = true;
          const result = world.state;
          endTimer = window.setTimeout(() => onEnd(result), 800);
        }
      },
      (frameTime) => renderer.render(world, frameTime),
    );
    loop.start();
    return () => {
      loop.stop();
      keyboard.detach();
      window.clearTimeout(endTimer);
    };
  }, [assets, voice, onEnd, hud]);

  return (
    <div className="game">
      <canvas ref={canvasRef} width={VIEW_W * SCALE} height={VIEW_H * SCALE} />
      <Hud store={hud} portrait={`/${assets.sheets[BRO_SHEET].file}`} />
    </div>
  );
}
```

Create `web/src/ui/EndScreen.tsx`:

```tsx
interface Props {
  result: 'won' | 'lost';
  onRestart: () => void;
  onMenu: () => void;
}

export function EndScreen({ result, onRestart, onMenu }: Props) {
  return (
    <div className="screen end">
      <h1>{result === 'won' ? 'MISSIONE COMPIUTA' : 'GAME OVER'}</h1>
      <p>{result === 'won' ? "Brolusconi è salito sull'elicottero." : 'Hai finito le vite.'}</p>
      <button onClick={onRestart} autoFocus>
        Rigioca
      </button>
      <button onClick={onMenu}>Menu</button>
    </div>
  );
}
```

Create `web/src/ui/MissingData.tsx`:

```tsx
const COMMAND = `cd Desktop/REA-BROFORCE/extractor
.venv/Scripts/python -m extractor "C:/Program Files (x86)/Steam/steamapps/common/Broforce/Broforce_beta_Data" ../game-data`;

export function MissingData({ reason }: { reason: string }) {
  return (
    <div className="screen missing">
      <h1>Mancano i dati del gioco</h1>
      <p>Il remake usa sprite e valori estratti dalla tua installazione di Broforce. Esegui l'estrattore una volta:</p>
      <pre>{COMMAND}</pre>
      <p>Poi ricarica la pagina.</p>
      <p className="note">Dettaglio: {reason}</p>
    </div>
  );
}
```

Create `web/src/ui/styles.css`:

```css
:root {
  color-scheme: dark;
  --bg: #14110f;
  --fg: #f4ead5;
  --accent: #e8b23a;
  --danger: #c8341f;
  --navy: #1f2a4a;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace; }
#root { min-height: 100vh; display: grid; place-items: center; }
.screen { max-width: 720px; padding: 24px 16px; text-align: center; }
.menu h1 { font-size: clamp(32px, 7vw, 64px); letter-spacing: 0.08em; margin: 0 0 24px; color: var(--accent); text-shadow: 4px 4px 0 var(--danger); }
.menu h1 span { display: block; font-size: 0.55em; color: var(--fg); text-shadow: 3px 3px 0 var(--navy); }
.controls { margin: 0 auto 20px; border-collapse: collapse; text-align: left; }
.controls td { padding: 4px 12px; border-bottom: 1px solid #2c2622; }
.controls td:first-child { color: var(--accent); white-space: nowrap; }
button { font: inherit; font-weight: 700; padding: 10px 22px; margin: 6px; background: var(--accent); color: var(--bg); border: 0; cursor: pointer; box-shadow: 4px 4px 0 var(--danger); }
button:focus-visible { outline: 3px solid var(--fg); outline-offset: 3px; }
.toggle { display: block; margin: 12px 0 18px; }
.note { opacity: 0.6; font-size: 12px; margin-top: 18px; }
pre { text-align: left; background: #221d19; padding: 12px; white-space: pre-wrap; word-break: break-all; }
.game { position: relative; width: min(100vw, 1200px); }
.game canvas { display: block; width: 100%; height: auto; image-rendering: pixelated; }
.hud { position: absolute; top: 8px; left: 8px; display: flex; align-items: center; gap: 10px; text-shadow: 2px 2px 0 #000; }
.portrait { width: 64px; height: 64px; background-size: 2048px 1024px; background-position: 0 0; image-rendering: pixelated; border: 2px solid var(--fg); background-color: var(--navy); }
.lives { font-weight: 700; }
.pip { display: inline-block; width: 10px; height: 14px; margin-right: 4px; background: var(--danger); border: 2px solid var(--fg); }
.end h1 { color: var(--accent); }
```

- [ ] **Step 7: Typecheck, test and build**

Run: `cd /c/Users/rinal/Desktop/REA-BROFORCE/web && npx tsc --noEmit && npx vitest run && npx vite build`
Expected: tsc prints nothing; all 91 tests pass; `vite build` ends with `✓ built in …`.

- [ ] **Step 8: Playtest in the browser**

Run (background): `cd /c/Users/rinal/Desktop/REA-BROFORCE/web && npx vite --port 5173 --strictPort`
Open `http://localhost:5173` and check, in order:

1. The menu shows the title, the controls table and the voice toggle; Enter starts.
2. Brolusconi (navy suit, blue tie) stands on dirt at the start; the HUD shows his portrait, `Vite × 3` and 4 red pips.
3. Arrows run (8-frame run cycle), Z jumps, holding Z against the bunker wall climbs it, Shift dashes.
4. X kicks footballs that arc, bounce and explode, destroying dirt and bricks.
5. C shows the bubble *Siete solo dei poveri comunisti!*, says it aloud when the voice is on, throws the marker, and five bombs sweep in after about a second.
6. Mooks in the bunker turn, shoot bursts; a hit kills Brolusconi and he respawns at the start with one life fewer.
7. The barrels at columns 28–29 chain-explode; the suicide mook past the pit runs at you and blows up.
8. Touching a cage frees the prisoner and adds a life.
9. Reaching the flag brings the helicopter; *MISSIONE COMPIUTA* appears; *Rigioca* restarts.
10. Renaming `game-data` temporarily and reloading shows *Mancano i dati del gioco* (rename it back afterwards).

If the football or airstrike feel wrong, change only the design values in `constants.ts` (`FOOTBALL`, `AIRSTRIKE_FUSE`), rerun `npx vitest run`, and record the new numbers in `docs/findings.md`.

- [ ] **Step 9: Write the findings**

Create `docs/findings.md`:

```markdown
# Broforce RE findings used by the remake

Target: Broforce (Steam, `Broforce_beta_Data`), Unity 2017.4.7f1, Mono. Code decompiled with dnSpyEx 6.6.0
from `Assembly-CSharp.dll` (SHA-256 6059336e…f3a9; REA identified it as unity-mono CIL). Prefab values read
with UnityPy 1.25.4 from `networkobjects`, `sharedtextures` and `sharedassets` bundles.

## Ported from code

| Value | Source |
|---|---|
| Tile 16, cell c centred at x = 16c | `Map.TileSize`, `Map.GetCollumn`, `Map.GetRow` |
| Gravity 1100 | `TestVanDammeAnim.ApplyNormalGravity` |
| Run accel speed·2 (dash ·4), start at 25, extra ·2.6 below 50 | `TestVanDammeAnim.AddSpeedLeft/Right` |
| Dash ×1.33 | `TestVanDammeAnim.dashSpeedM` |
| Ground friction 10 | `TestVanDammeAnim.frictionM` |
| Jump grace 0.1 s | `TestVanDammeAnim.Jump` |
| Wall climb: boost 190, gravity ×0.66, 8 frames × 0.033 s | `AnimateWallClimb`, `ApplyWallClimbingGravity` |
| Half width 6, head height 15 | `TestVanDammeAnim.halfWidth`, `Unit.headHeight` |
| Mook bullet 250, bazooka rocket 100, bazooka delay 1.4 s | `Mook.UseFire`, `MookBazooka.UseFire/FireWeapon` |
| Sight 300 × 20 | `EnemyAI.sightRangeX/Y` |
| Explosion maths (ground r = range/2; units range·1.5, kill range, force blastForce·20, extra Y) | `Rocket.MakeEffects`, `Map.ExplodeUnits`, `MapController.DamageGround` |
| Suicide mook blast 10/9, force ·40, fuse 0.6–0.8 s | `MookSuicide.MakeEffects`, `MookSuicide.Start` |
| Barrel blast 12, range ·1.2, force 200, hurts everyone | `BarrelBlock` |
| Airstrike: throw (200,150)/(30,70); 5 bombs at 45°, y offsets 580…420, x − 480 − h, speed 200 + 0–30 | `BroBase.UseSpecial`, `GrenadeAirstrike.Death` |
| Animation rows: idle 0, run 1 (8 frames, 0.025 s), jump/climb 2, dash 3; death cols 4/5 | `TestVanDammeAnim.Animate*` |

## Read from prefabs (game-data/values.json)

Brolusconi = Double Bro Seven: jump 260, speed 110, health 1, fireRate 0.27, specials 4, wall climb, dash.
Mook: health 3, speed 70, jump 200, fireRate 0.17. Bazooka mook: health 4. Suicide mook: health 3, range 40.
Bullet: damage 1, life 0.45. Bazooka rocket (`RocketSeeking`): damage 10, range 28, life 3.
Airstrike bomb (`RocketBombardment`): damage 10, range 28, life 5. Airstrike grenade: bounce 0.4, friction 0.6.
Blocks: dirt 5, brick 5, steel 500000, barrel 1 (range 50).

## Design values (not in Broforce)

Football: kick (220, 160), bounce 0.7, friction 0.85, explodes on contact / after 3 bounces / 1.6 s,
damage 5, range 32. Airstrike fuse 1.0 s (the prefab's `life` is 0; the real fuse is set elsewhere).
Mook bursts of 3, 1 s pause, 0.4 s reaction, turn every 2.5 s. Lives 3, respawn 1.5 s, extraction 3 s.

## Simplified or left out

No water, quicksand, ladders, ziplines, parachutes, air dash, wall drag, falling blocks, gibs, fire,
homing rockets, mook jumping AI or co-op. Knockback is additive. `Map.ExplodeUnits` multiplies its
`yI` argument for every unit it visits after a close one; the port keeps that boost per unit.
```

- [ ] **Step 10: Commit**

```bash
cd /c/Users/rinal/Desktop/REA-BROFORCE && git add web/src docs/findings.md && git status --short && git commit -m "$(cat <<'EOF'
web: input, fixed-step loop, React shell and HUD; RE findings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

Expected from `git status --short` before the commit: no `game-data/`, `decompiled/` or `analysis/` entries.
