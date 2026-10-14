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
