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
               "originalSpecialAmmo", "hearingRangeX", "hearingRangeY")
# PolymorphicAI fields, read from each mook's AI component (MookTrooperAI, MookBazookaAi, SuicideAI)
AI_FIELDS = ("sightRangeX", "sightRangeY", "attackTime", "sightDelay", "delayBetweenFiring", "patrolBlocksRadius",
             "minIdleWaitDuration", "maxIdleWaitDuration", "hidingLookXRange")
MOOK_FIELDS = UNIT_FIELDS + ("canHideInGrass", "canBeSetOnFire", "willPanicWhenOnFire")
PATH_FIELDS = ("capabilities", "agentSize")  # PathAgent
DOOR_FIELDS = ("spawningRate", "maxMookCount", "chanceToSpawnSuicideMook", "maxAlarmedMooksCount", "closedAtStart",
               "limitedNumberOfMooks", "maxMooksOnCollapse", "maxMookCountAfterCollapse", "spawnEscapingUnitsOnFire",
               "explodeAtEnd", "mooksAlwaysWalkOut", "mooksStartSuspicious")
BULLET_FIELDS = ("damage", "life")
ROCKET_FIELDS = ("damage", "range", "blastForce", "blastForceExtraY", "life")
GRENADE_FIELDS = ("bounceM", "frictionM")

SPRITES = (
    SpriteRef("bro_base", "DoubleBroSeven", "DoubleBroSeven", True),
    SpriteRef("bro_lee", "BroLee", "BroLee", True),
    SpriteRef("tank_hull", "TankBroTank", "TankBrosTank", True),
    SpriteRef("tank_turret", "TankBroTankTurret", "Turret", True),
    SpriteRef("tank_shell", "HeavyShell", "Shell Heavy Tankbro", True),
    SpriteRef("tank_rocket", "RocketMassive", "Rocket Tankbro BIG", True),
    SpriteRef("mook", "MookTrooper", "ZMook", True),
    SpriteRef("mook_suicide", "MookSuicide", "ZMookSuicide", True),
    SpriteRef("mook_bazooka", "MookBazooka", "ZMookBazooka", True),
    SpriteRef("mook_scout", "ScoutMook", "ZMookScout", True),
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
)

VALUES = (
    ValuesRef("bro_base", "DoubleBroSeven", "DoubleBroSeven", UNIT_FIELDS),
    ValuesRef("bro_lee", "BroLee", "BroLee", UNIT_FIELDS),
    ValuesRef("tank", "TankBroTank", "TankBrosTank",
              ("speed", "_jumpForce", "maxFallSpeed", "maxDamageBeforeExploding", "deathCountdownExplodeThreshold")),
    ValuesRef("tank_turret", "TankBroTankTurret", "Turret", ("cannonFireSpeed",)),
    ValuesRef("tank_shell", "HeavyShell", "Shell Heavy Tankbro", ("damage", "range", "life")),
    ValuesRef("tank_rocket", "RocketMassive", "Rocket Tankbro BIG",
              ("damage", "range", "blastForce", "blastForceExtraY", "life", "horizontalAcceleration", "crushWallLayers")),
    ValuesRef("mook", "MookTrooper", "ZMook", MOOK_FIELDS),
    ValuesRef("mook_suicide", "MookSuicide", "ZMookSuicide", MOOK_FIELDS),
    ValuesRef("mook_bazooka", "MookBazooka", "ZMookBazooka", MOOK_FIELDS),
    ValuesRef("ai_mook", "MookTrooperAI", "ZMook", AI_FIELDS),
    ValuesRef("ai_mook_suicide", "SuicideAI", "ZMookSuicide", AI_FIELDS),
    ValuesRef("ai_mook_bazooka", "MookBazookaAi", "ZMookBazooka", AI_FIELDS),
    ValuesRef("mook_scout", "ScoutMook", "ZMookScout", MOOK_FIELDS + ("runSpeed",)),
    ValuesRef("ai_mook_scout", "ScoutAI", "ZMookScout", AI_FIELDS),
    ValuesRef("path_mook", "PathAgent", "ZMook", PATH_FIELDS),
    ValuesRef("path_mook_scout", "PathAgent", "ZMookScout", PATH_FIELDS),
    ValuesRef("path_mook_suicide", "PathAgent", "ZMookSuicide", PATH_FIELDS),
    ValuesRef("path_mook_bazooka", "PathAgent", "ZMookBazooka", PATH_FIELDS),
    ValuesRef("mook_door", "MookDoor", "DoodadMookDoor", DOOR_FIELDS),
    ValuesRef("bullet", "Projectile", "Bullet", BULLET_FIELDS),
    ValuesRef("rocket_mook", "RocketSeeking", "Rocket Mook Bazooka", ROCKET_FIELDS),
    ValuesRef("bomb", "RocketBombardment", "Rocket Bombardment", ROCKET_FIELDS),
    ValuesRef("marker", "GrenadeAirstrike", "Grenade Airstrike", GRENADE_FIELDS),
    ValuesRef("suicide_blast", "MookSuicide", "ZMookSuicide", ("range", "blastForce")),
    ValuesRef("block_dirt", "DirtBlock", "Desert Earth", ("health",)),
    ValuesRef("block_brick", "BrickBlock", "WallBrick1", ("health",)),
    ValuesRef("block_steel", "SteelBlock", "SteelBlock", ("health",)),
    ValuesRef("block_barrel", "BarrelBlock", "Barrel 1", ("health", "range")),
    ValuesRef("grass", "DoodadGrass", "Desert Long Grass Doodad", ("health", "width", "height")),
)
