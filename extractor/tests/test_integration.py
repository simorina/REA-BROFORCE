import json
import os

import pytest
from PIL import Image

from extractor.__main__ import run

DATA = os.environ.get(
    "BROFORCE_DATA", r"C:\Program Files (x86)\Steam\steamapps\common\Broforce\Broforce_beta_Data")
pytestmark = pytest.mark.skipif(not os.path.isdir(DATA), reason="Broforce is not installed here")


def test_extracts_sprites_values_and_the_repaint(tmp_path):
    run(DATA, str(tmp_path), fetch_audio=False)
    manifest = json.loads((tmp_path / "manifest.json").read_text(encoding="utf-8"))
    assert "sprites/brolusconi.png" in manifest["files"]
    values = json.loads((tmp_path / "values.json").read_text(encoding="utf-8"))
    assert values["bro_base"]["_jumpForce"] == 260.0
    assert values["bro_base"]["speed"] == 110.0
    assert values["bro_base"]["originalSpecialAmmo"] == 4
    assert values["mook"]["health"] == 3
    assert values["bomb"]["range"] == 28.0
    assert values["block_barrel"]["range"] == 50.0
    assert values["mook"]["hearingRangeX"] == 50.0
    assert values["ai_mook"]["sightDelay"] == pytest.approx(1.66)
    assert values["ai_mook"]["delayBetweenFiring"] == pytest.approx(1.78)
    assert values["ai_mook_bazooka"]["sightRangeY"] == 64
    assert values["ai_mook_suicide"]["sightDelay"] == pytest.approx(0.55)
    assert values["mook_scout"]["runSpeed"] == 100.0 and values["mook_scout"]["canHideInGrass"] == 0
    assert values["ai_mook_scout"]["sightDelay"] == pytest.approx(0.2)
    assert values["path_mook"]["capabilities"]["jumpHeight"] == 3 and values["path_mook"]["agentSize"] == 9.0
    assert values["path_mook_scout"]["capabilities"]["maxDropDistance"] == 3
    assert values["mook_door"]["maxMookCount"] == 3 and values["mook_door"]["maxAlarmedMooksCount"] == 5
    sheets = json.loads((tmp_path / "sheets.json").read_text(encoding="utf-8"))
    assert sheets["brolusconi"]["frameW"] == 32 and sheets["brolusconi"]["cols"] == 32
    assert sheets["helicopter"]["frameW"] == 96 and sheets["helicopter"]["cols"] == 21
    assert values["bro_lee"]["speed"] == 120.0 and values["bro_lee"]["originalSpecialAmmo"] == 2
    assert values["bro_lee"]["fireRate"] == pytest.approx(0.2)
    assert sheets["putin"]["frameW"] == 32 and sheets["putin"]["offsetY"] == 15.0
    putin = Image.open(tmp_path / "sprites" / "putin.png").convert("RGBA")
    assert (0x16, 0x16, 0x16) not in {p[:3] for p in putin.get_flattened_data() if p[3]}  # every hair/trouser pixel recoloured
    assert values["tank"]["speed"] == 60.0 and values["tank"]["_jumpForce"] == 290.0
    assert values["tank"]["maxDamageBeforeExploding"] == 25 and values["tank"]["deathCountdownExplodeThreshold"] == 45
    assert values["tank_turret"]["cannonFireSpeed"] == 44.0
    assert values["tank_shell"]["damage"] == 10 and values["tank_shell"]["range"] == 36.0
    assert values["tank_rocket"]["horizontalAcceleration"] == 120.0 and values["tank_rocket"]["crushWallLayers"] == 3
    assert values["bro_soldier"]["fireRate"] == pytest.approx(0.12) and values["bro_soldier"]["extraFireDelay"] == pytest.approx(0.3)
    assert values["rifle_bullet"]["damage"] == 1
    assert sheets["trump"]["frameW"] == 32 and sheets["rifle_gun"]["frameW"] == 32 and sheets["rifle_gun"]["rows"] == 2
    assert sheets["jet_us"]["frameW"] == 96 and sheets["jet_us"]["frameH"] == 64 and sheets["jet_us"]["offsetY"] == 12.0
    assert sheets["tank_ru"]["frameW"] == 48 and sheets["turret_ru"]["frameW"] == 48
    assert sheets["tank_shell"]["frameW"] == 32 and sheets["tank_rocket"]["frameH"] == 16
    assert Image.open(tmp_path / "sprites" / "block_dirt.png").size == (64, 16)  # the jungle earth strip, grass on frame 0
    assert sheets["block_dirt"]["cols"] == 4 and sheets["block_sand"]["frameW"] == 16
    assert sheets["block_temple"]["frameW"] == 16 and sheets["epstein"]["frameW"] == 32
    # the Goliath's walk cycle, one row of 128 x 70 frames cut out of its 1024 x 128 texture
    assert (sheets["goliath"]["frameW"], sheets["goliath"]["frameH"], sheets["goliath"]["rows"]) == (128, 70, 1)
    assert Image.open(tmp_path / "sprites" / "goliath.png").size == (1024, 70) and values["mech"]["health"] == 300
    # the new enemies: Broforce's riot shield mook (its shield a texture of its own), grenadier and dog
    assert values["mook_grenadier"]["health"] == 15 and values["dog"]["awareRunSpeed"] == 140.0
    assert values["ai_dog"]["sightDelay"] == pytest.approx(0.22) and values["ai_mook_shield"]["delayBetweenFiring"] == pytest.approx(1.25)
    assert values["grenade_mook"]["damage"] == 10 and values["grenade_mook"]["range"] == 42.0
    assert sheets["dog"]["frameW"] == 32 and sheets["shield"]["frameW"] == 32 and sheets["grenade"]["frameW"] == 16
    assert values["block_sand"]["health"] > 0 and values["block_dirt"]["health"] > 0


def test_extracts_the_jungle_background_and_the_effects(tmp_path):
    run(DATA, str(tmp_path), fetch_audio=False)
    bg = json.loads((tmp_path / "background.json").read_text(encoding="utf-8"))
    assert bg["cloudScatter"] == "BlueSky"
    assert bg["sky"]["parallax"] == [1.0, 1.0]
    assert bg["theme"] == "Themeholder Jungle" and round(bg["near"][0]["parallax"][0], 2) == 0.3
    assert [len(bg[k]) for k in ("near", "mid", "distant")] == [3, 2, 3]
    for name, theme, folder in (("desert", "Themeholder Desert", "sprites/bg/desert/"), ("burning", "Themeholder Jungle Burning", "sprites/bg/burning/")):
        other = json.loads((tmp_path / f"background_{name}.json").read_text(encoding="utf-8"))
        assert other["theme"] == theme and other["sky"]["file"].startswith(folder)
        assert all((tmp_path / l["file"]).is_file() for k in ("near", "mid", "distant") for l in other[k])
    assert (tmp_path / bg["distant"][0]["file"]).is_file()
    fx = json.loads((tmp_path / "effects.json").read_text(encoding="utf-8"))
    blood = fx["emitters"]["bloodBig"]
    assert blood["collision"]["gravity"] == 400.0 and blood["collision"]["leavesDecals"] == 1
    assert fx["puffs"]["bloodGush1"]["frames"] == 7
    assert fx["bubbles"]["!"]["animatedRestFrame"] == 10
    assert [g["name"] for g in fx["gibs"]] == ["BodyArm1", "BodyArm2", "BodyHead", "BodyLeg1", "BodyLeg2", "BodyTorso"]
    assert fx["blocks"]["sand"]["customColors"] is not None and set(fx["blocks"]) == {"dirt", "sand", "brick", "temple", "steel", "barrel"}
    assert set(fx["blocks"]["brick"]["blood"]) == {"top", "bottom", "left", "right"}
    assert fx["bubbles"]["rambro"]["animatedBubble"] == 0
    assert fx["suicide"]["explosionSize"] == "small" and fx["airstrike"]["range"] == 48.0 and fx["barrelFullExplosion"]
    assert fx["rangePop"]["w"] == 128.0 and fx["plume"]["deathOnBounce"] == 1
    shuriken = json.loads((tmp_path / "shuriken.json").read_text(encoding="utf-8"))
    medium = shuriken["systems"]["medium"]
    assert medium[0]["name"] == "ExplosionSepSmoke" and medium[0]["sub"] == [{"system": 1, "type": 0, "properties": 2}]
    assert medium[1]["isSub"] and medium[1]["renderer"]["material"]["ramp"] == "smokeRamp"
    assert all(s["renderer"]["material"]["worldToPixel"] == 1.0 for v in shuriken["systems"].values() for s in v)
    for name, t in shuriken["textures"].items():
        assert Image.open(tmp_path / t["file"]).size == (t["w"] * 2, t["h"]), name
    door = fx["door"]
    assert Image.open(tmp_path / door["frame"]["file"]).size == (48, 48)
    assert Image.open(tmp_path / door["frameDestroyed"]["file"]).size == (48, 48)
    assert door["inside"]["offset"][1] == 8.0 and len(door["smoke"]) == 2 and door["sparks"]["bounceM"] == pytest.approx(0.4)
    assert sorted(f["name"] for f in fx["flames"]) == ["Flame1", "Flame2", "Flame3"]
    flame = fx["flames"][0]
    assert Image.open(tmp_path / flame["file"]).size == (flame["frameW"] * flame["frames"], flame["frameH"])
    assert Image.open(tmp_path / fx["scoutDisarmed"]).size == (1024, 512)
    files = {e["texture"] for e in fx["emitters"].values()} | {p["file"] for p in fx["puffs"].values()}
    files |= {door[k]["file"] for k in ("frame", "frameDestroyed", "inside", "insideDestroyed", "sparks")}
    for rel in files:
        assert (tmp_path / rel).is_file(), rel
