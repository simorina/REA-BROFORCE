"""Background, effects and doodads, read from Broforce's theme and scene bundles (read only).

- background.json (and background_desert.json, background_burning.json): a ThemeHolder's sky, BlueSky clouds and parallax hills, each with its
  ParallaxFollow factors and SpriteSM size/offset (Map.SetupLevel / Map.PlaceDoodad instantiate them).
- effects.json: legacy particle emitters (EllipsoidParticleEmitter + ParticleRenderer + the custom
  ParticleCollisionAnimator), Puff sprite animations, the theme's particle colours, the blood colours,
  the "!"/"?" ReactionBubbles, the desert long grass, the blocks' blood sprays and the gib holder that
  every unit shares (its pieces are cut from the unit's own sheet at runtime), the mook door (its frame,
  inside, destroyed looks, and the smoke and sparks of its final explosion), the FlickerFader flames of a
  burning mook, and the scout's disarmed sheet and Rambro-face bubble.

Scene objects come from the EffectsController and EffectsHolderTheme that live in scenesmain.
"""
import math
import os
import re

import UnityPy
from PIL import Image

from .grade import grade, lut_filter
from .particles import SystemWriter
from .repaint import FLAME_GREEN, FLAME_RED, FLAME_WHITE, repaint
from .unity import AssetNotFound

BUNDLES = ("networkobjects.assetbundle", "sharedtextures.assetbundle", "sharedassets.assetbundle",
           "themeholders.assetbundle", "scenesmain.assetbundle")

THEME = "Themeholder Jungle"  # the island
# file -> (ThemeHolder, sprite folder): each mission's background, the island's in background.json
# and the ColorShiftController LUT that grades it (the jungle's is Preset_Blank and the desert has none)
BACKGROUNDS = {"background.json": (THEME, "bg", None), "background_desert.json": ("Themeholder Desert", "bg/desert", None),
               "background_burning.json": ("Themeholder Jungle Burning", "bg/burning", "colorMapBurningJungleDay")}
COLOR_SHIFT = ("ColorShiftController", "BackgroundCamera")
EFFECTS_CONTROLLER = ("EffectsController", "EffectsContoller")  # sic
EFFECTS_THEME = ("EffectsHolderTheme", "EffectsHollderThemeVietnam")  # sic

# key -> (holder, field); holder "fx" = EffectsController, "theme" = EffectsHolderTheme
EMITTERS = {
    "dirtDots": ("theme", "particlesDirtDots"),
    "dirtSmall1": ("theme", "particlesDirtSmall1"),
    "dirtSmall2": ("theme", "particlesDirtSmall2"),
    "dirtSmall3": ("theme", "particlesDirtSmall3"),
    "dirtSmallWhite": ("theme", "particlesDirtSmallWhite"),
    "dirtSmallerWhite": ("theme", "particlesDirtSmallerWhite"),
    "metalSmall1": ("theme", "particlesMetalSmall1"),
    "bloodBig": ("fx", "RedBloodParticlesBig"),
    "bloodSmall": ("fx", "RedBloodParticlesSmall"),
    "bloodDots": ("fx", "RedBloodParticlesDots"),
    "sparkShower": ("fx", "sparkParticleShower"),
    "sparkFloat": ("fx", "sparkParticleFloat"),
    "dust": ("fx", "dustParticles"),
    "plume1": ("fx", "plumePuffParticle1"),
    "plume2": ("fx", "plumePuffParticle2"),
}

PUFFS = {
    "bloodGush1": "bloodGush1Prefab", "bloodGush2": "bloodGush2Prefab", "bloodGush3": "bloodGush3Prefab",
    "bloodSpurt1": "bloodSpurt1Prefab", "bloodSpurt2": "bloodSpurt2Prefab", "bloodSpurt3": "bloodSpurt3Prefab",
    "bloodSplash1": "bloodSplash1Prefab", "bloodSplash2": "bloodSplash2Prefab",
    "bloodSmallSplash1": "bloodSmallSplash1Prefab", "bloodSmallSplash2": "bloodSmallSplash2Prefab",
    "bloodTinySplash1": "bloodTinySplash1Prefab", "bloodTinySplash2": "bloodTinySplash2Prefab",
    "footPoof1": "footPoof1Prefab", "footPoof2": "footPoof2Prefab", "footPoof3": "footPoof3Prefab",
    "landPoof1": "landPoof1Prefab", "landPoof2": "landPoof2Prefab",
    "muzzleFlash": "muzzleFlashPrefab",
    "smokeSmall1": "smokeSmall1Prefab", "smokeSmall2": "smokeSmall2Prefab", "smokeSmall3": "smokeSmall3Prefab",
    "explosionPuff": "explosionBig", "explosionPuffSmall": "explosion",
    "groundExplodePoof": "groundExplodePoofPrefab",
    "whiteFlashPop": "whiteFlashPopPrefab",
}
# Puffs on other prefabs: the Noisy Cricket's beam trail and the ball where its shot goes off
PREFAB_PUFFS = {"cricketBeam": ("Puff", "Noisy Cricket Beam Puff"), "cricketBall": ("Puff", "Noisy Cricket Ball Puff")}
# Ellen Ripbro's flame wall (FlameWallExplosion.explosionPuffs), its three flames painted in the tricolour for Giorgia Meloni
TRICOLOUR_PUFFS = {"flameWallGreen": ("Flame Wall Puff Test", FLAME_GREEN), "flameWallWhite": ("Flame Wall Puff Test 2", FLAME_WHITE),
                   "flameWallRed": ("Flame Wall Puff Test 3", FLAME_RED)}
# PuffTwoLayer: the stars over a blinded or stunned unit
TWO_LAYER_PUFFS = {"stunnedStars1": "stunnedStars1Prefab", "stunnedStars2": "stunnedStars2Prefab",
                   "stunnedStars3": "stunnedStars3Prefab"}

# ReactionBubble fields: "!" and "?" of the ZMook's MookTrooperAI, the ZMookScout's Rambro face
BUBBLES = {"!": ("MookTrooperAI", "ZMook", "exclamationMark"), "?": ("MookTrooperAI", "ZMook", "questionMark"),
           "rambro": ("ScoutAI", "ZMookScout", "ramboBubble")}
SCOUT = ("ScoutMook", "ZMookScout")
SUICIDE = ("MookSuicide", "ZMookSuicide")
AIRSTRIKE = ("GrenadeAirstrike", "Grenade Airstrike")
# EffectsController.CreateShaderExplosion's sizes and the plumes' fire trail (CreateSmallFireTrail)
SHURIKEN = {"tiny": "ExplosionTiny", "small": "ExplosionSmall", "medium": "Explosion", "large": "ExplosionLarge",
            "fireTrail": "FireTrailSmall"}
EXPLOSION_SIZES = ("small", "medium", "large", "massive", "tiny", "largeNoWhite")  # EffectsController.ExplosionSize
GRASS = "Desert Long Grass Doodad"
BLOCKS = {"dirt": ("DirtBlock", "DirtBlock5"), "sand": ("DirtBlock", "Desert Earth"), "brick": ("BrickBlock", "WallBrick1"),
          "temple": ("BrickBlock", "WallBrick1"),
          "steel": ("SteelBlock", "SteelBlock"), "barrel": ("BarrelBlock", "Barrel 1")}
GIB_HOLDER_OWNER = ("MookTrooper", "ZMook")
DOOR = ("MookDoor", "DoodadMookDoor")
COLLISION_FIELDS = ("collidesWithGround", "leavesDecals", "minEnergyDecal", "collisionEnergyLoss", "collisionSpeedM",
                    "gravity", "growSizeM", "dampeningM", "randomMotion", "randomMotionM", "linearFade", "fadeColor",
                    "fadeSize", "trailBlood", "trailDust", "bloodTrailFrequency", "particleEnergyLossM",
                    "createSplashParticles", "createSplashParticlesAndDie")
PUFF_FIELDS = ("frameRate", "spriteSize", "frames", "rows", "loopStartFrame", "loopEndFrame", "numLoops",
               "requiresGroundBelow", "pauseFrame", "pauseTime", "useGravity", "gravityM", "correctRotation")
GIB_FIELDS = ("size", "lifeM", "randomLifeM", "frictionM", "drag", "bounceM", "gravityM", "doesRotate", "rotateFrames",
              "forceMultiplier", "hasBloodTrail", "bloodyM", "onlySmallBloodParticles", "collidesWithWalls",
              "rotationSpeedMultiplier", "lifeLossOnBounce", "lifeLossM", "xI_randomOnBounce", "fades", "shrink")


def _safe(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]+", "_", name)


def _comp(ptr):
    return ptr.deref() if hasattr(ptr, "deref") else ptr.component


def _num(v):
    if isinstance(v, bool):
        return v
    if isinstance(v, float):
        return round(v, 4)
    return v


def _color(c: dict) -> list:
    if "rgba" in c:  # ColorRGBA32, red in the low byte
        v = c["rgba"]
        return [round(((v >> s) & 0xFF) / 255, 4) for s in (0, 8, 16, 24)]
    return [round(c["r"], 4), round(c["g"], 4), round(c["b"], 4), round(c["a"], 4)]


class Scene:
    """MonoBehaviours indexed by (script class, GameObject name), plus texture and output helpers."""

    def __init__(self, streaming_assets: str, out):
        paths = [os.path.join(streaming_assets, n) for n in BUNDLES]
        missing = [p for p in paths if not os.path.isfile(p)]
        if missing:
            raise AssetNotFound(f"missing bundles: {missing}")
        self.env = UnityPy.load(*paths)
        self.out = out
        self.index: dict[tuple[str, str], object] = {}
        self.written: dict[str, str] = {}
        for obj in self.env.objects:
            if obj.type.name != "MonoBehaviour":
                continue
            try:
                mb = obj.read()
                key = (mb.m_Script.read().m_ClassName, mb.m_GameObject.read().m_Name)
            except Exception:
                continue
            self.index.setdefault(key, obj)

    def find(self, cls: str, go: str):
        try:
            return self.index[(cls, go)]
        except KeyError:
            raise AssetNotFound(f"{cls} on {go!r}") from None

    @staticmethod
    def field(obj, name: str):
        """The object a MonoBehaviour's PPtr field points to."""
        ptr = getattr(obj.read(), name, None)
        if ptr is None:
            raise AssetNotFound(f"field {name!r} missing")
        target = ptr.deref() if hasattr(ptr, "deref") else None
        if target is None:
            raise AssetNotFound(f"field {name!r} is empty")
        return target

    @staticmethod
    def components(go) -> dict:
        """Component readers of a GameObject by type (MonoBehaviours by script class)."""
        out = {}
        for c in go.m_Components:
            cc = _comp(c)
            tn = cc.type.name
            if tn == "MonoBehaviour":
                try:
                    tn = cc.read().m_Script.read().m_ClassName
                except Exception:
                    continue
            out.setdefault(tn, cc)
        return out

    @staticmethod
    def material_texture(renderer) -> tuple:
        for m in renderer.read().m_Materials:
            mat = m.read()
            for name, te in mat.m_SavedProperties.m_TexEnvs:
                if name == "_MainTex" and te.m_Texture.m_PathID:
                    return te.m_Texture.read(), mat
        raise AssetNotFound("renderer has no _MainTex")

    def write_texture(self, tex, folder: str, source: str, tone=None, tag: str = "") -> str:
        """The texture as it is, or (with a `tone`) repainted and written apart under the `tag`."""
        name = f"{tex.m_Name} {tag}" if tone else tex.m_Name
        if name not in self.written:
            rel = f"sprites/{folder}/{_safe(name)}.png"
            image = tex.image.convert("RGBA")
            if tone:
                image = repaint(image, {}, tone=tone)
            self.out.write_png(rel, image, f"texture {tex.m_Name} ({source})" + (f", {tag}" if tone else ""))
            self.written[name] = rel
        return self.written[name]

    def sprite(self, go, folder: str, crop: bool, lut=None, tone=None, tag: str = ""):
        """SpriteSM size/rect/offset of a GameObject with its texture (whole, or cropped to the rect)."""
        comps = self.components(go)
        if "SpriteSM" not in comps and "WobbleSprite" not in comps:
            raise AssetNotFound(f"{go.m_Name!r} has no SpriteSM")
        s = (comps.get("SpriteSM") or comps["WobbleSprite"]).read_typetree()
        tex, mat = self.material_texture(comps["MeshRenderer"])
        ll, dims, off = s["lowerLeftPixel"], s["pixelDimensions"], s["offset"]
        rect = [int(ll["x"]), int(ll["y"] - dims["y"]), int(dims["x"]), int(dims["y"])]  # x, y_top, w, h
        tr = comps["Transform"].read()
        info = {
            "w": _num(s["width"] * tr.m_LocalScale.x), "h": _num(s["height"] * tr.m_LocalScale.y),
            "offset": [_num(off["x"]), _num(off["y"]), _num(off["z"])],
            "pos": [_num(tr.m_LocalPosition.x), _num(tr.m_LocalPosition.y)],
        }
        if crop:
            x, y, w, h = rect
            rel = f"sprites/{folder}/{_safe(go.m_Name)}.png"
            image = tex.image.convert("RGBA").crop((x, y, x + w, y + h))
            if lut is not None:
                image = grade(image, lut)
            self.out.write_png(rel, image, f"{go.m_Name} (texture {tex.m_Name})")
            info["file"] = rel
        else:
            info["file"] = self.write_texture(tex, folder, go.m_Name, tone, tag)
            info["rect"] = rect
        return info

    def go_of(self, obj):
        return obj.read().m_GameObject.read()


def _background(scene: Scene, theme_name: str = THEME, folder: str = "bg", lut_field: str | None = None) -> dict:
    theme = scene.find("ThemeHolder", theme_name)
    tt = theme.read_typetree()
    lut, lut_name = None, None
    if lut_field:  # ColorShiftController's LUT for this theme, baked into the sprites
        tex = scene.field(scene.find(*COLOR_SHIFT), lut_field).read()
        lut, lut_name = lut_filter(tex.image), tex.m_Name

    def layer(obj) -> dict:
        go = scene.go_of(obj)
        pf = obj.read_typetree()
        info = scene.sprite(go, folder, crop=True, lut=lut)
        info.update({"name": go.m_Name, "parallax": [_num(pf["parallaxXM"]), _num(pf["parallaxYM"])]})
        return info

    def layers(field: str) -> list:
        objs = getattr(theme.read(), field)
        return [layer(p.deref()) for p in objs if p.m_PathID]

    scatter = ("None", "Stormy", "BlueSky")[tt["cloudScatterType"]]
    out = {"theme": theme_name, "cloudScatter": scatter, "sky": layer(scene.field(theme, "sky")),
           "clouds": layers("parallaxClouds"), "near": layers("parallax1"), "mid": layers("parallax2"),
           "distant": layers("parallax3")}
    if lut_name:
        out["grade"] = lut_name
    return out


def _emitter(scene: Scene, obj) -> dict:
    go = scene.go_of(obj)
    comps = scene.components(go)
    em = comps["EllipsoidParticleEmitter"].read_typetree()
    rend = comps["ParticleRenderer"]
    rt = rend.read_typetree()
    tex, _ = scene.material_texture(rend)
    uv = rt["UV Animation"]
    out = {
        "name": go.m_Name, "texture": scene.write_texture(tex, "fx", go.m_Name),
        "tiles": [uv["x Tile"], uv["y Tile"]], "cycles": _num(uv["cycles"]),
        "size": [_num(em["minSize"]), _num(em["maxSize"])], "energy": [_num(em["minEnergy"]), _num(em["maxEnergy"])],
    }
    if "ParticleCollisionAnimator" in comps:
        ca = comps["ParticleCollisionAnimator"].read_typetree()
        out["collision"] = {k: _num(ca[k]) for k in COLLISION_FIELDS if k in ca}
    if "ParticleAnimator" in comps:
        pa = comps["ParticleAnimator"].read_typetree()
        out["animator"] = {
            "force": [_num(pa["force"]["x"]), _num(pa["force"]["y"])], "damping": _num(pa["damping"]),
            "sizeGrow": _num(pa["sizeGrow"]), "doesAnimateColor": bool(pa["Does Animate Color?"]),
            "colors": [_color(pa[f"colorAnimation[{i}]"]) for i in range(5) if f"colorAnimation[{i}]" in pa],
        }
    if "WorldParticleCollider" in comps:
        wc = comps["WorldParticleCollider"].read_typetree()
        out["worldCollider"] = {k: _num(wc[k]) for k in ("bounceFactor", "collisionEnergyLoss", "minKillVelocity")
                                if k in wc}
    return out


def _puff(scene: Scene, obj, two_layer: bool = False, tone=None, tag: str = "") -> dict:
    go = scene.go_of(obj)
    comps = scene.components(go)
    cls = "PuffTwoLayer" if two_layer else "Puff"
    p = comps[cls].read_typetree()
    info = scene.sprite(go, "fx", crop=False, tone=tone, tag=tag)
    info.update({"name": go.m_Name, **{k: _num(p[k]) for k in PUFF_FIELDS if k in p}})
    return info


def _bubble(scene: Scene, cls: str, owner: str, field: str) -> dict:
    obj = scene.field(scene.find(cls, owner), field)
    go = scene.go_of(obj)
    rb = obj.read_typetree()
    info = scene.sprite(go, "fx", crop=False)
    info.update({k: _num(rb[k]) for k in ("life", "sinSpeed", "tweenTime", "flash", "animatedBubble",
                                          "animatedRestFrame", "animatedFinishFrame", "restTime")})
    return info


def _grass(scene: Scene) -> dict:
    obj = scene.find("DoodadGrass", GRASS)
    go = scene.go_of(obj)
    dg = obj.read_typetree()
    comps = scene.components(go)
    wobble = comps["WobbleSprite"].read_typetree()
    backing = scene.sprite(go, "fx", crop=False)
    blades = []
    for ch in comps["Transform"].read().m_Children:
        cgo = ch.read().m_GameObject.read()
        b = scene.sprite(cgo, "fx", crop=False)
        bw = scene.components(cgo)["WobbleSprite"].read_typetree()
        b.update({"intensity": _num(bw["intensity"]), "windBlowM": _num(bw["windBlowM"])})
        blades.append(b)
    return {"name": go.m_Name, "health": dg["health"], "backing": {**backing, "intensity": _num(wobble["intensity"])},
            "blades": blades}


def _block(scene: Scene, cls: str, go_name: str) -> dict:
    obj = scene.find(cls, go_name)
    bt = obj.read_typetree()
    out = {"dropDirt": bool(bt["dropDirt"]), "customColors": None, "blood": {}}
    if bt["dropCustomParticleColor"]:
        out["customColors"] = [_color(bt["particleColor1"]), _color(bt["particleColor2"])]
    for side in ("Top", "Bottom", "Left", "Right"):
        ptr = bt[f"bloodSpray{side}"]
        if not ptr["m_PathID"]:
            continue
        target = getattr(obj.read(), f"bloodSpray{side}").deref()
        go = target.read().m_GameObject.read() if target.type.name != "GameObject" else target.read()
        comps = scene.components(go)
        if "SpriteSM" not in comps:
            continue  # Desert Earth's bottom spray only holds blood drip spawners
        info = scene.sprite(go, "fx", crop=True)
        q = comps["Transform"].read().m_LocalRotation
        info["angle"] = round(math.degrees(2 * math.atan2(q.z, q.w)), 2)
        out["blood"][side.lower()] = info
    return out


def _gibs(scene: Scene) -> list:
    owner = scene.find(*GIB_HOLDER_OWNER)
    holder = scene.field(owner, "gibs")
    go = scene.go_of(holder)
    pieces = []
    for ch in scene.components(go)["Transform"].read().m_Children:
        cgo = ch.read().m_GameObject.read()
        comps = scene.components(cgo)
        g = comps["Gib"].read_typetree()
        s = comps["SpriteSM"].read_typetree()
        tr = comps["Transform"].read()
        ll, dims, off = s["lowerLeftPixel"], s["pixelDimensions"], s["offset"]
        pieces.append({
            "name": cgo.m_Name, "pos": [_num(tr.m_LocalPosition.x), _num(tr.m_LocalPosition.y)],
            "rect": [int(ll["x"]), int(ll["y"] - dims["y"]), int(dims["x"]), int(dims["y"])],
            "w": _num(s["width"]), "h": _num(s["height"]), "offset": [_num(off["x"]), _num(off["y"])],
            **{k: _num(g[k]) for k in GIB_FIELDS if k in g},
        })
    return pieces


def _main_texture(material):
    for name, te in material.m_SavedProperties.m_TexEnvs:
        if name == "_MainTex" and te.m_Texture.m_PathID:
            return te.m_Texture.read()
    raise AssetNotFound(f"material {material.m_Name!r} has no _MainTex")


def _recrop(scene: Scene, info: dict, rect: list, material, name: str) -> dict:
    """The same sprite drawn with another material (MookDoor.DestroyDoor swaps them)."""
    tex = _main_texture(material)
    x, y, w, h = rect
    rel = f"sprites/fx/{_safe(name)}.png"
    scene.out.write_png(rel, tex.image.convert("RGBA").crop((x, y, x + w, y + h)), f"{name} (texture {tex.m_Name})")
    return {**info, "file": rel}


def _shrapnel(scene: Scene, obj) -> dict:
    go = scene.go_of(obj)
    info = scene.sprite(go, "fx", crop=False)
    g = obj.read_typetree()
    info.update({"name": go.m_Name, **{k: _num(g[k]) for k in GIB_FIELDS if k in g}})
    return info


def _flame(scene: Scene, obj) -> dict:
    """A FlickerFader: one texture per frame, packed here into a horizontal strip."""
    go = scene.go_of(obj)
    ff = obj.read()
    texs = [r.read() for r in ff.flickerTextures]
    if not texs:
        raise AssetNotFound(f"{go.m_Name} has no flicker textures")
    w, h = texs[0].m_Width, texs[0].m_Height
    strip = Image.new("RGBA", (w * len(texs), h))
    for i, t in enumerate(texs):
        strip.paste(t.image.convert("RGBA").resize((w, h)), (i * w, 0))
    rel = f"sprites/fx/{_safe(go.m_Name)}_strip.png"
    scene.out.write_png(rel, strip, f"{go.m_Name} flicker textures")
    s = scene.components(go)["SpriteSM"].read_typetree()
    off = s["offset"]
    return {"name": go.m_Name, "file": rel, "frames": len(texs), "frameW": w, "frameH": h,
            "frameRate": _num(obj.read_typetree()["frameRate"]), "startIndex": ff.startIndex,
            "w": _num(s["width"]), "h": _num(s["height"]), "offset": [_num(off["x"]), _num(off["y"]), _num(off["z"])]}


def _door(scene: Scene) -> dict:
    """The mook door's frame and, behind the units, its dark inside ("Door Behind"), as built and destroyed."""
    obj = scene.find(*DOOR)
    go = scene.go_of(obj)
    frame = scene.sprite(go, "fx", crop=False)
    rect = frame.pop("rect")
    mat = scene.material_texture(scene.components(go)["MeshRenderer"])[1]
    out = {"frame": _recrop(scene, frame, rect, mat, go.m_Name),
           "frameDestroyed": _recrop(scene, frame, rect, scene.field(obj, "destroyedMaterial").read(),
                                     go.m_Name + " Destroyed")}
    for ch in scene.components(go)["Transform"].read().m_Children:
        cgo = ch.read().m_GameObject.read()
        if "SpriteSM" in scene.components(cgo):
            inside = scene.sprite(cgo, "fx", crop=False)
            rect = inside.pop("rect")
            mat = scene.material_texture(scene.components(cgo)["MeshRenderer"])[1]
            out["inside"] = _recrop(scene, inside, rect, mat, cgo.m_Name)
            out["insideDestroyed"] = _recrop(scene, inside, rect, scene.field(obj, "backgroundDestroyedMaterial").read(),
                                             cgo.m_Name + " Destroyed")
    if "inside" not in out:
        raise AssetNotFound("DoodadMookDoor has no inside sprite")
    out["smoke"] = [_puff(scene, scene.field(obj, f)) for f in ("smoke1", "smoke2")]
    out["sparks"] = _shrapnel(scene, scene.field(obj, "shrapnel"))
    out["fire"] = [scene.go_of(scene.field(obj, f)).m_Name for f in ("fire1", "fire2", "fire3")]
    return out


def _range_pop(scene: Scene, fx) -> dict:
    """ExplosionRangePop: a white ring the size of the blast, a column per 8 units of range over 24."""
    obj = scene.field(fx, "explosionRangePrefab")
    go = scene.go_of(obj)
    info = scene.sprite(go, "fx", crop=False)
    rp = obj.read_typetree()
    info.update({k: _num(rp[k]) for k in ("delayBeforeAppear", "delayBeforeDisappear", "grow")})
    tex, _ = scene.material_texture(scene.components(go)["MeshRenderer"])
    info["columns"] = tex.m_Width // info["rect"][2]
    return info


def _plume(scene: Scene, fx) -> dict:
    """EffectsController.CreatePlumes' Plume: a spark of Shrapnel that drags a FireTrailSmall behind it."""
    obj = scene.field(fx, "plumeShrapnelPrefab")
    info = _shrapnel(scene, obj)
    p = obj.read_typetree()
    info.update({k: _num(p[k]) for k in ("deathOnBounce", "destroyInsideWalls")})
    return info


def _blast_effects(scene: Scene, owner: tuple, fires: bool) -> dict:
    """The shrapnel, smoke and (for the suicide mook) flames a blast throws, from the owner's fields."""
    obj = scene.find(*owner)
    out = {"shrapnel": _shrapnel(scene, scene.field(obj, "shrapnel")),
           "smoke": [_puff(scene, scene.field(obj, f)) for f in ("smoke1", "smoke2")],
           "range": _num(obj.read_typetree()["range"])}
    if fires:
        out["fire"] = [scene.go_of(scene.field(obj, f)).m_Name for f in ("fire1", "fire2", "fire3")]
        out["explosionSize"] = EXPLOSION_SIZES[obj.read_typetree()["explosionSize"]]
    return out


def _shuriken(scene: Scene, fx) -> dict:
    textures: dict = {}
    writer = SystemWriter(scene, textures)
    systems = {}
    for key, field in SHURIKEN.items():
        go = scene.go_of(scene.field(fx, field))
        systems[key] = writer.tree(go)
    return {"systems": systems, "textures": textures}


def _scout_disarmed(scene: Scene) -> str:
    """ScoutMook.disarmedMaterial: the sheet a scout wears once it has spotted you."""
    obj = scene.find(*SCOUT)
    tex = _main_texture(scene.field(obj, "disarmedMaterial").read())
    return scene.write_texture(tex, "units", "ScoutMook.disarmedMaterial")


def extract(streaming_assets: str, out) -> None:
    scene = Scene(streaming_assets, out)
    fx = scene.find(*EFFECTS_CONTROLLER)
    theme_fx = scene.find(*EFFECTS_THEME)
    holders = {"fx": fx, "theme": theme_fx}
    for file, (theme_name, folder, lut_field) in BACKGROUNDS.items():
        out.write_json(file, _background(scene, theme_name, folder, lut_field), f"ThemeHolder {theme_name!r}")
    ft, tt = fx.read_typetree(), theme_fx.read_typetree()
    effects = {
        "colors": {k: [_color(tt[f"{k}Color1"]), _color(tt[f"{k}Color2"])] for k in ("dirt", "flesh", "sand", "bone")},
        "bloodColor": _color(ft["RedBloodColor"]),
        "emitters": {k: _emitter(scene, scene.field(holders[h], f)) for k, (h, f) in EMITTERS.items()},
        "puffs": {**{k: _puff(scene, scene.field(fx, f)) for k, f in PUFFS.items()},
                  **{k: _puff(scene, scene.find(*v)) for k, v in PREFAB_PUFFS.items()},
                  **{k: _puff(scene, scene.find("Puff", n), tone=tone, tag=k) for k, (n, tone) in TRICOLOUR_PUFFS.items()}},
        "twoLayerPuffs": {k: _puff(scene, scene.field(fx, f), True) for k, f in TWO_LAYER_PUFFS.items()},
        "bubbles": {k: _bubble(scene, *v) for k, v in BUBBLES.items()},
        "grass": _grass(scene),
        "blocks": {k: _block(scene, c, g) for k, (c, g) in BLOCKS.items()},
        "gibs": _gibs(scene),
        "door": _door(scene),
        "flames": [_flame(scene, p.deref()) for p in scene.find(*GIB_HOLDER_OWNER).read().flames],  # Mook.flames
        "scoutDisarmed": _scout_disarmed(scene),
        "rangePop": _range_pop(scene, fx),
        "plume": _plume(scene, fx),
        "suicide": _blast_effects(scene, SUICIDE, True),
        "airstrike": _blast_effects(scene, AIRSTRIKE, False),
        "barrelFullExplosion": bool(scene.find(*BLOCKS["barrel"]).read_typetree()["fullExplosion"]),
    }
    out.write_json("shuriken.json", _shuriken(scene, fx), "EffectsController's ParticleSystem prefabs")
    names = {f["name"] for f in effects["flames"]}
    if not set(effects["door"]["fire"]) <= names:
        raise AssetNotFound(f"door flames {effects['door']['fire']} are not the mook's {sorted(names)}")
    out.write_json("effects.json", effects, "EffectsController, EffectsHolderTheme and prefabs")
