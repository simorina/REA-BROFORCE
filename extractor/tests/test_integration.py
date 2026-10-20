import json
import math
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
    # Bro In Black (Brononymous): his sheet, the Noisy Cricket in his hand, its shot and the Neuraliser's beam
    assert values["bro_in_black"]["speed"] == 110.0 and values["bro_in_black"]["originalSpecialAmmo"] == 3
    assert values["cricket"]["damage"] == 10 and values["cricket"]["range"] == 28.0
    assert values["cricket"]["blastForce"] == 20.0 and values["cricket"]["life"] == pytest.approx(0.18)
    assert sheets["bro_in_black"]["frameW"] == 32 and sheets["cricket_gun"]["frameW"] == 32
    assert sheets["neuraliser_beam"]["frameW"] == 32 and sheets["neuraliser_beam"]["frameH"] == 16
    # Samuel's Django: Dirty Brorry's revolver in his own hand, its penetrating bullet, and our western loop
    assert sheets["revolver_gun"]["frameW"] == 32 and sheets["revolver_gun"]["file"] == "sprites/revolver_gun.png"
    assert values["revolver_bullet"]["damage"] == 4 and values["revolver_bullet"]["maxPenetrations"] == 2
    assert values["revolver_bullet"]["life"] == pytest.approx(0.3) and sheets["revolver_bullet"]["frameW"] == 32
    assert (tmp_path / "audio" / "django_western.wav").is_file()
    # Che Guevara: Brodock repainted, Rambro's M60 and values, and the Molotov with its little fires
    assert sheets["che"]["file"] == "sprites/che.png" and sheets["che"]["frameW"] == 32
    assert sheets["m60_gun"]["file"] == "sprites/m60_gun.png" and sheets["molotov"]["frameW"] == 16  # its little fires show only as flames
    assert values["bro_rambro"]["originalSpecialAmmo"] == 6 and values["bro_rambro"]["fireRate"] == pytest.approx(0.1)
    assert values["molotov"]["range"] == 64.0 and values["molotov_fire"]["range"] == 48.0 and values["molotov_fire"]["life"] == 1.0
    # Giorgia Meloni: Ellen Ripbro repainted, B.A. Broracus's flamethrower, Ellen's flame wall, the flames in the tricolour
    assert sheets["meloni"]["file"] == "sprites/meloni.png" and sheets["meloni"]["frameW"] == 32
    assert sheets["flamethrower_gun"]["frameW"] == 32 and sheets["flame_green"]["cols"] == 16
    assert values["bro_ellen"]["speed"] == 110.0 and values["bro_ellen"]["originalSpecialAmmo"] == 3
    assert values["flamethrower"]["fireRate"] == pytest.approx(0.1) and values["flame_bullet"]["life"] == pytest.approx(0.35)
    assert values["flame_bullet"]["damage"] == 1 and values["flame_anim"]["frames"] == 10
    assert values["flame_wall"]["maxCollumns"] == 14 and values["flame_wall"]["maxRows"] == 3 and values["flame_wall"]["damageAmount"] == 3
    assert values["rifle_bullet"]["damage"] == 1
    assert sheets["trump"]["frameW"] == 32 and sheets["rifle_gun"]["frameW"] == 32 and sheets["rifle_gun"]["rows"] == 2
    assert sheets["blade_gun"]["frameW"] == 32 and sheets["blade_gun"]["cols"] == 32 and sheets["blade_gun"]["rows"] == 2
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
    # the Bruiser (MookBigGuy): a 36-pixel sheet, his minigun with his arms, BigGuyAI and the minigun's bullet
    assert sheets["mook_bruiser"]["frameW"] == 36 and sheets["bruiser_gun"]["frameW"] == 36 and sheets["bruiser_gun"]["rows"] == 4
    assert values["mook_bruiser"]["health"] == 25 and values["mook_bruiser"]["fireRate"] == pytest.approx(0.07)
    assert values["ai_mook_bruiser"]["attackTime"] == pytest.approx(1.2) and values["path_mook_bruiser"]["agentSize"] > 0
    assert values["minigun_bullet"]["damage"] == 1 and values["minigun_bullet"]["life"] == pytest.approx(0.45)
    # the jetpack mooks: a trooper and a bazooka mook (their AIs) who fly, and blow up when their jetpack fails
    assert sheets["mook_jetpack"]["frameW"] == 32 and sheets["mook_jetpack_bazooka"]["frameW"] == 32
    assert values["mook_jetpack"]["explosionRange"] == 40.0 and values["mook_jetpack"]["spiralDelayDuration"] == pytest.approx(0.5)
    assert values["ai_mook_jetpack"]["delayBetweenFiring"] == pytest.approx(0.33) and values["ai_mook_jetpack_bazooka"]["sightRangeY"] == 96
    # the ninja: a trooper who waits crouched until you come close (MookNinjaAI)
    assert sheets["mook_ninja"]["frameW"] == 32 and values["mook_ninja"]["health"] == 3 and values["ai_mook_ninja"]["sightRangeX"] > 0
    # the alarmist: unarmed, his dead man's switch sets off the megaphones that call paratroopers in
    assert sheets["mook_alarmist"]["frameW"] == 32 and values["alarm_switch"]["alarmDelay"] == pytest.approx(0.25)
    assert values["alarm"]["paratrooperRate"] == pytest.approx(9.0) and values["alarm"]["alarmRate"] == pytest.approx(3.0)
    # the mortar mook: an EnemyAI (MortarAI), one RocketLaunch every 2 s that calls a bombardment down
    assert values["mook_mortar"]["fireRate"] == pytest.approx(2.0) and values["ai_mook_mortar"]["attackTime"] == pytest.approx(2.0)
    assert values["rocket_launch"]["life"] == pytest.approx(0.8) and values["rocket_launch"]["damage"] == 10
    # the elite Bruiser: 125 health, charging at 2.6x, drunk rockets
    assert sheets["mook_bruiser_elite"]["frameW"] == 36 and values["mook_bruiser_elite"]["health"] == 125
    assert values["mook_bruiser_elite"]["runSpeedMultiplier"] == pytest.approx(2.6) and values["ai_mook_bruiser_elite"]["jumpRange"] == 96
    assert values["rocket_drunk"]["drunkSpeed"] == pytest.approx(10.0) and sheets["rocket_evil"]["cols"] == 8
    # the aliens: the xenomorph runs at 120, the brute charges at 160, the facehugger has 1 health
    assert values["alien_xeno"]["awareRunSpeed"] == pytest.approx(120.0) and sheets["alien_xeno"]["frameW"] == 48
    assert values["alien_brute"]["health"] == 100 and values["alien_brute"]["unawareMegaRunSpeed"] == pytest.approx(160.0)
    assert values["alien_hugger"]["health"] == 1 and values["ai_alien_hugger"]["attackRangeX"] == pytest.approx(26.0)
    assert sheets["alien_brute"]["frameW"] == 64 and values["ai_alien_mosquito"]["sightRangeX"] == 240
    # hell: the Boomer bursts at 46 into three undead suicide mooks, the hell Bruiser's flame wall runs 14 columns, the
    # warlock's portal raises its mook at 56 for 1.1 s, the lost soul dives up to 270
    assert values["hell_boomer"]["health"] == 25 and values["hell_boomer"]["explosionRange"] == pytest.approx(46.0)
    assert values["flame_wall_hell"]["maxCollumns"] == 14 and values["flame_wall_hell"]["explosionRate"] == pytest.approx(0.14)
    assert values["warlock_portal"]["riseSpeed"] == pytest.approx(56.0) and values["ai_warlock"]["sightRangeY"] == 300
    assert values["hell_lostsoul"]["diveSpeedMax"] == pytest.approx(270.0) and values["hell_armoured"]["health"] == 30
    assert values["undead"]["health"] == 3 and values["undead_suicide"]["range"] == pytest.approx(40.0)
    assert sheets["hell_boomer"]["frameW"] == 36 and sheets["satan"]["frameW"] == 32 and sheets["warlock_portal"]["frameW"] == 32
    # the universal soldier: 110 health, his launcher's attack 2.3 s
    assert values["mook_dolph"]["health"] == 110 and values["ai_mook_dolph"]["attackTime"] == pytest.approx(2.3)
    assert sheets["mook_dolph"]["frameW"] == 48 and sheets["dolph_gun"]["frameW"] == 64
    # the troop truck: 20 health, 80 a second, seven mooks in the back
    assert (sheets["truck"]["frameW"], sheets["truck"]["frameH"], sheets["truck"]["offsetY"]) == (74, 64, 32)
    assert values["foe_truck"]["mooksToSpawn"] == 7 and values["ai_foe_truck"]["sightRangeX"] == 120
    # the APC and the motorbikes (the nuclear one slower, its attack range 8)
    assert values["foe_apc"]["health"] == 40 and sheets["apc"]["frameW"] == 96 and sheets["bike"]["frameW"] == 64
    assert values["foe_artillery"]["health"] == 25 and values["ai_foe_artillery"]["sightRangeX"] == 256
    assert (sheets["artillery"]["frameW"], sheets["artillery"]["frameH"]) == (64, 96)
    # the Mookopter: 65 health, its chaingun's huge bullets 5 each
    assert values["foe_kopter"]["health"] == 65 and values["ai_foe_kopter"]["sightDelay"] == pytest.approx(2.5)
    assert values["bullet_huge"]["damage"] == 5 and sheets["kopter"]["frameW"] == 80
    assert values["foe_bike"]["tankSpeed"] == pytest.approx(150.0) and values["ai_foe_nukebike"]["attackXRange"] == pytest.approx(8.0)
    # the minefield: the mine's two frames (armed, going off) and the sign over it
    assert (sheets["mine"]["frameW"], sheets["mine"]["frameH"], sheets["mine"]["cols"]) == (16, 16, 2)
    assert (sheets["mine_sign"]["frameW"], sheets["mine_sign"]["frameH"]) == (16, 16)
    assert values["block_sand"]["health"] > 0 and values["block_dirt"]["health"] > 0


def test_extracts_the_jungle_background_and_the_effects(tmp_path):
    run(DATA, str(tmp_path), fetch_audio=False)
    bg = json.loads((tmp_path / "background.json").read_text(encoding="utf-8"))
    assert bg["cloudScatter"] == "BlueSky"
    assert bg["sky"]["parallax"] == [1.0, 1.0]
    assert bg["theme"] == "Themeholder Jungle" and round(bg["near"][0]["parallax"][0], 2) == 0.3
    assert [len(bg[k]) for k in ("near", "mid", "distant")] == [3, 2, 3]
    for name, theme, folder in (("desert", "Themeholder Desert", "sprites/bg/desert/"), ("burning", "Themeholder Jungle Burning", "sprites/bg/burning/"),
                                ("city", "Themeholder City", "sprites/bg/city/"), ("forest", "Themeholder Forest", "sprites/bg/forest/"),
                                ("hell", "Themeholder Hell", "sprites/bg/hell/")):
        other = json.loads((tmp_path / f"background_{name}.json").read_text(encoding="utf-8"))
        assert other["theme"] == theme and other["sky"]["file"].startswith(folder)
        assert all((tmp_path / l["file"]).is_file() for k in ("near", "mid", "distant") for l in other[k])
    # ColorShiftController grades the burning jungle's BackgroundCamera: its blue sky comes out smoky
    burning = json.loads((tmp_path / "background_burning.json").read_text(encoding="utf-8"))
    assert burning["grade"] == "Preset_Burning_Jungle" and "grade" not in bg
    sky = Image.open(tmp_path / burning["sky"]["file"]).convert("RGB")
    r, g, b = sky.getpixel((sky.width // 2, sky.height // 2))
    assert b < 220 and abs(r - b) < 60
    assert (tmp_path / bg["distant"][0]["file"]).is_file()
    # Broforce's 3D world map: the globe (radius 5), its territories, the helicopter and the flag
    globe = json.loads((tmp_path / "worldmap" / "globe.json").read_text(encoding="utf-8"))
    assert globe["radius"] == 5.0 and globe["camera"]["height"] == pytest.approx(16.68) and globe["camera"]["fovOut"] == 30.0
    assert {"usa", "hawaii", "amazon", "vietnam", "hongkong", "afghanistan", "panama"} <= set(globe["territories"])
    # each territory's icon hangs over its centre and the helicopter sets down on its landing zone, both on the surface
    assert all(5.0 < math.hypot(*t["centre"]) < 5.6 and 4.9 < math.hypot(*t["landing"]) < 5.5 for t in globe["territories"].values())
    # and its flag pole is where the US flag goes up once it's liberated
    assert all(len(globe["territories"][k]["flag"]) == 16 for k in ("usa", "hawaii", "vietnam", "hongkong"))
    # a territory's border is a group of its own: Broforce shows it only while the territory is selected
    assert {"usa", "hawaii", "afghanistan"} <= {g["territory"] for g in globe["groups"] if g.get("territory")}
    # the main camera carries the blue disc behind the globe and the additive ring around its rim
    assert [g["name"] for g in globe["glows"]] == ["backGlow", "Blue Glow"]
    assert globe["glows"][1]["color"] == pytest.approx([0.0721, 0.3272, 0.3382, 1.0039], abs=1e-3)
    assert globe["glows"][1]["distance"] == pytest.approx(10.74, abs=1e-3) and globe["glows"][1]["size"] == pytest.approx(8.628, abs=1e-2)
    assert len(globe["groups"]) >= 10 and (tmp_path / "worldmap" / "globe.bin").stat().st_size > 1_000_000
    shaders = {globe["materials"][g["material"]]["shader"] for g in globe["groups"]}
    assert {"Custom/Fake3D", "Custom/Fake3DTree", "Custom/PixelWater", "Custom/MapBorder"} <= shaders
    assert [p["name"] for p in globe["models"]["helicopter"]] == ["WorldMap_Helicopter", "Helicopter_MainRotor", "Helicopter_SideRotor"]
    assert globe["models"]["flag"] and (tmp_path / globe["lightmap"]["file"]).is_file()
    assert len(globe["modelFrames"]["helicopter"]) == 16 and len(globe["modelFrames"]["flag"]) == 16
    assert all((tmp_path / f).is_file() for f in globe["icons"].values())
    fx = json.loads((tmp_path / "effects.json").read_text(encoding="utf-8"))
    blood = fx["emitters"]["bloodBig"]
    assert blood["collision"]["gravity"] == 400.0 and blood["collision"]["leavesDecals"] == 1
    assert fx["puffs"]["bloodGush1"]["frames"] == 7
    assert fx["puffs"]["cricketBeam"]["name"] == "Noisy Cricket Beam Puff" and fx["puffs"]["cricketBall"]["frames"] > 1
    # Ellen Ripbro's flame wall puffs, in Meloni's tricolour: the green one burns green
    wall = [fx["puffs"][k] for k in ("flameWallGreen", "flameWallWhite", "flameWallRed")]
    assert [p["name"] for p in wall] == ["Flame Wall Puff Test", "Flame Wall Puff Test 2", "Flame Wall Puff Test 3"]
    assert all(p["frames"] == 20 and p["frameRate"] == pytest.approx(0.0234) for p in wall)
    green = Image.open(tmp_path / wall[0]["file"]).convert("RGBA")
    lit = [px for px in green.getdata() if px[3]]
    assert lit and all(g > r and g > b for r, g, b, _ in lit)
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
