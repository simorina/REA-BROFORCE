"""What to extract. Prefab names and scripts were found with REA + UnityPy (see docs/findings.md)."""
from dataclasses import dataclass


@dataclass(frozen=True)
class SpriteRef:
    key: str                 # output name: sprites/<key>.png
    script: str              # MonoBehaviour class on the prefab
    gameobject: str          # prefab GameObject name (first match wins)
    whole_sheet: bool        # True: whole animation sheet; False: crop the prefab's SpriteSM frame
    frame: tuple[int, int, int, int] | None = None  # (x, y_top, w, h) for prefabs without SpriteSM
    strip: bool = False      # whole sheet that is one row of frames starting at its SpriteSM y_top: cut that row out


@dataclass(frozen=True)
class TextureRef:
    key: str
    texture: str             # exact Texture2D name; frames are square (side = texture height) unless `frame`
    frame: tuple[int, int] | None = None  # (w, h) when frames aren't square


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
JETPACK_FIELDS = ("explosionRange", "blastForce", "spiralDelayDuration")  # MookJetpack

SPRITES = (
    SpriteRef("bro_base", "DoubleBroSeven", "DoubleBroSeven", True),
    SpriteRef("bro_lee", "BroLee", "BroLee", True),
    SpriteRef("bro_in_black", "Brononymous", "Brononymous", True),  # Bro In Black
    SpriteRef("bro_brodock", "ColJamesBrodock", "Col James Brodock", True),  # repainted into Che Guevara
    SpriteRef("bro_ellen", "EllenRipbro", "EllenRipbro", True),  # repainted into Giorgia Meloni
    SpriteRef("tank_hull", "TankBroTank", "TankBrosTank", True),
    SpriteRef("tank_turret", "TankBroTankTurret", "Turret", True),
    SpriteRef("tank_shell", "HeavyShell", "Shell Heavy Tankbro", True),
    SpriteRef("tank_rocket", "RocketMassive", "Rocket Tankbro BIG", True),
    SpriteRef("mook", "MookTrooper", "ZMook", True),
    SpriteRef("mook_suicide", "MookSuicide", "ZMookSuicide", True),
    SpriteRef("mook_bazooka", "MookBazooka", "ZMookBazooka", True),
    SpriteRef("mook_scout", "ScoutMook", "ZMookScout", True),
    SpriteRef("mook_shield", "MookRiotShield", "ZMookRiotShield", True),
    SpriteRef("mook_grenadier", "MookGrenadier", "ZMook Grenadier", True),
    SpriteRef("dog", "MookDog", "ZMookDog", True),
    SpriteRef("mook_bruiser", "MookBigGuy", "ZMookBigGuy", True),  # the Bruiser: 36x32 frames
    SpriteRef("mook_jetpack", "MookJetpack", "ZMookJetpack", True),
    SpriteRef("mook_jetpack_bazooka", "MookJetpackBazooka", "ZMookJetpackBazooka", True),
    SpriteRef("mook_ninja", "MookNinja", "ZMookNinja", True),
    SpriteRef("mook_alarmist", "MookGeneral", "ZMook Alarmist", True),
    SpriteRef("grenade", "Grenade", "GrenadeEvilSmall Long fuse", False),  # the grenadier's long-fuse grenade
    SpriteRef("prisoner", "RescueBro", "Hobro", True),
    SpriteRef("cage", "Cage", "CageBig", True),
    SpriteRef("helicopter", "Helicopter", "Helicopter", True),
    SpriteRef("jet_harrier", "HarrierJet", "Jet Support Attack", True),
    SpriteRef("goliath", "GoliathMech", "GoliathMech", True, strip=True),  # its walk cycle
    SpriteRef("rocket", "Rocket", "Rocket", False),
    SpriteRef("revolver_bullet", "BulletSnakeBroskin", "Bullet DirtyBrory", False),  # Dirty Brorry's .44
    SpriteRef("molotov", "GrenadeMolotov", "Grenade Molotove", False),
    SpriteRef("bomb", "RocketBombardment", "Rocket Bombardment", False),
    SpriteRef("marker", "GrenadeAirstrike", "Grenade Airstrike", False),
    SpriteRef("block_dirt", "DirtBlock", "DirtBlock5", True),  # jungle earth: frame 0 has the grass on top
    SpriteRef("block_sand", "DirtBlock", "Desert Earth", False),  # the beach
    SpriteRef("block_brick", "BrickBlock", "WallBrick1", False, frame=(0, 0, 16, 16)),
    SpriteRef("block_steel", "SteelBlock", "SteelBlock", False),
    SpriteRef("block_barrel", "BarrelBlock", "Barrel 1", False),
    SpriteRef("flagpole", "CheckPoint", "FlagPole", False),
)

TEXTURES = (
    TextureRef("bullet", "Bullet Enemy"),
    TextureRef("flag", "AmericanFlagTiny"),
    TextureRef("rifle_gun", "Broniversal Soldier Gun Anim", frame=(32, 32)),
    TextureRef("blade_gun", "BLADE_gun_anim", frame=(32, 32)),  # Blade's katana: 0 at rest, 6-1 the slash
    TextureRef("cricket_gun", "BRONONAMOUS_gun_anim", frame=(32, 32)),  # Bro In Black's Noisy Cricket: 3-0 its kick
    TextureRef("neuraliser_beam", "white BallBeam", frame=(32, 16)),  # the Neuraliser's LineRenderer texture
    TextureRef("dirty_harry_gun", "DirtyHarry_Gun_anim", frame=(32, 32)),  # repainted into Samuel's revolver_gun
    TextureRef("rambro_gun", "RAMBRO_gun_anim", frame=(32, 32)),  # Rambro's M60, repainted into Che's m60_gun
    TextureRef("shield", "mook_shield_anim", frame=(32, 32)),  # the riot shield mook's shield (his "gun")
    TextureRef("bruiser_gun", "mookbig_gun_anim", frame=(36, 32)),  # the Bruiser's minigun, in his arms: row 0 idle/firing, row 1 running
    TextureRef("ba_gun", "BABROACUS_gun_anim", frame=(32, 32)),  # B.A. Broracus's flamethrower, repainted into Meloni's
    TextureRef("flame_1", "flamethrower_bullet1", frame=(32, 32)),  # FlameThrower Bullet 1-3's flames: green, white, red
    TextureRef("flame_2", "flamethrower_bullet2", frame=(32, 32)),
    TextureRef("flame_3", "flamethrower_bullet3", frame=(32, 32)),
    TextureRef("mine", "LandMine", frame=(16, 16)),  # the Mine prefab's SpriteSM: 0 armed, 1 (lowerLeftPixel x 16) going off
    TextureRef("mine_sign", "MineSign"),  # the Mine Field Sign doodad
)

VALUES = (
    ValuesRef("bro_base", "DoubleBroSeven", "DoubleBroSeven", UNIT_FIELDS),
    ValuesRef("bro_lee", "BroLee", "BroLee", UNIT_FIELDS),
    ValuesRef("bro_in_black", "Brononymous", "Brononymous", UNIT_FIELDS),
    ValuesRef("bro_rambro", "Rambro", "Rambo", UNIT_FIELDS),  # Che plays as Rambro
    ValuesRef("bro_ellen", "EllenRipbro", "EllenRipbro", UNIT_FIELDS),  # Meloni plays as Ellen Ripbro
    ValuesRef("flamethrower", "BaBroracus", "BA_Broracus2", ("fireRate",)),  # ... with B.A. Broracus's flamethrower
    ValuesRef("flame_bullet", "FlameBullet", "FlameThrower Bullet 1", ("life", "damage", "projectileSize")),
    ValuesRef("flame_anim", "AnimatedTexture", "Flame1", ("frames", "frameRate")),
    ValuesRef("flame_wall", "FlameWallExplosion", "flameWallExplosion",
              ("maxCollumns", "maxRows", "totalExplosions", "explosionRate", "damageAmount", "maxPuffDelay", "yExplosionOffset")),
    ValuesRef("molotov", "GrenadeMolotov", "Grenade Molotove", ("range", "size", "gravityM")),
    ValuesRef("molotov_fire", "GrenadeMolotovFire", "Grenade Molotov Fire", ("range", "size", "gravityM", "life")),
    ValuesRef("cricket", "NoisyCricket", "NoisyCricket", ("life", "damage", "range", "blastForce", "projectileSize")),
    ValuesRef("revolver_bullet", "BulletSnakeBroskin", "Bullet DirtyBrory", ("damage", "life", "maxPenetrations", "projectileSize")),
    ValuesRef("tank", "TankBroTank", "TankBrosTank",
              ("speed", "_jumpForce", "maxFallSpeed", "maxDamageBeforeExploding", "deathCountdownExplodeThreshold")),
    ValuesRef("tank_turret", "TankBroTankTurret", "Turret", ("cannonFireSpeed",)),
    ValuesRef("tank_shell", "HeavyShell", "Shell Heavy Tankbro", ("damage", "range", "life")),
    ValuesRef("tank_rocket", "RocketMassive", "Rocket Tankbro BIG",
              ("damage", "range", "blastForce", "blastForceExtraY", "life", "horizontalAcceleration", "crushWallLayers")),
    ValuesRef("bro_soldier", "BroniversalSoldier", "BroniversalSoldier", UNIT_FIELDS + ("extraFireDelay",)),
    ValuesRef("rifle_bullet", "BulletRambro", "Bullet Rambo", ("damage", "life")),
    ValuesRef("mech", "GoliathMech", "GoliathMech", ("health",)),
    ValuesRef("mook", "MookTrooper", "ZMook", MOOK_FIELDS),
    ValuesRef("mook_suicide", "MookSuicide", "ZMookSuicide", MOOK_FIELDS),
    ValuesRef("mook_bazooka", "MookBazooka", "ZMookBazooka", MOOK_FIELDS),
    ValuesRef("ai_mook", "MookTrooperAI", "ZMook", AI_FIELDS),
    ValuesRef("ai_mook_suicide", "SuicideAI", "ZMookSuicide", AI_FIELDS),
    ValuesRef("ai_mook_bazooka", "MookBazookaAi", "ZMookBazooka", AI_FIELDS),
    ValuesRef("mook_scout", "ScoutMook", "ZMookScout", MOOK_FIELDS + ("runSpeed",)),
    ValuesRef("ai_mook_scout", "ScoutAI", "ZMookScout", AI_FIELDS),
    ValuesRef("mook_shield", "MookRiotShield", "ZMookRiotShield", MOOK_FIELDS),
    ValuesRef("mook_grenadier", "MookGrenadier", "ZMook Grenadier", MOOK_FIELDS),
    ValuesRef("dog", "MookDog", "ZMookDog", MOOK_FIELDS + ("awareRunSpeed",)),
    ValuesRef("ai_mook_shield", "PolymorphicAI", "ZMookRiotShield", AI_FIELDS),
    ValuesRef("ai_mook_grenadier", "MookBazookaAi", "ZMook Grenadier", AI_FIELDS),
    ValuesRef("ai_dog", "DogAI", "ZMookDog", AI_FIELDS),
    ValuesRef("path_mook_grenadier", "PathAgent", "ZMook Grenadier", PATH_FIELDS),
    ValuesRef("path_dog", "PathAgent", "ZMookDog", PATH_FIELDS),
    ValuesRef("mook_bruiser", "MookBigGuy", "ZMookBigGuy", MOOK_FIELDS),
    ValuesRef("ai_mook_bruiser", "BigGuyAI", "ZMookBigGuy", AI_FIELDS),
    ValuesRef("path_mook_bruiser", "PathAgent", "ZMookBigGuy", PATH_FIELDS),
    ValuesRef("minigun_bullet", "MookMiniGunBullet", "Bullet MookMiniGun", BULLET_FIELDS),
    ValuesRef("mook_jetpack", "MookJetpack", "ZMookJetpack", MOOK_FIELDS + JETPACK_FIELDS),
    ValuesRef("ai_mook_jetpack", "MookTrooperAI", "ZMookJetpack", AI_FIELDS),
    ValuesRef("path_mook_jetpack", "PathAgent", "ZMookJetpack", PATH_FIELDS),
    ValuesRef("mook_jetpack_bazooka", "MookJetpackBazooka", "ZMookJetpackBazooka", MOOK_FIELDS + JETPACK_FIELDS),
    ValuesRef("ai_mook_jetpack_bazooka", "MookBazookaAi", "ZMookJetpackBazooka", AI_FIELDS),
    ValuesRef("path_mook_jetpack_bazooka", "PathAgent", "ZMookJetpackBazooka", PATH_FIELDS),
    ValuesRef("mook_ninja", "MookNinja", "ZMookNinja", MOOK_FIELDS),
    ValuesRef("ai_mook_ninja", "MookNinjaAI", "ZMookNinja", AI_FIELDS),
    ValuesRef("path_mook_ninja", "PathAgent", "ZMookNinja", PATH_FIELDS),
    ValuesRef("mook_alarmist", "MookGeneral", "ZMook Alarmist", MOOK_FIELDS),
    ValuesRef("ai_mook_alarmist", "MookTrooperAI", "ZMook Alarmist", AI_FIELDS),
    ValuesRef("path_mook_alarmist", "PathAgent", "ZMook Alarmist", PATH_FIELDS),
    ValuesRef("alarm_switch", "DeadManSwitchAlarmTrap", "ZMook Alarmist", ("alarmDelay",)),
    ValuesRef("alarm", "AlarmSystem", "Alarm Megaphones", ("alarmRate", "paratrooperRate", "activeMookThreshold")),
    ValuesRef("grenade_mook", "Grenade", "GrenadeEvilSmall Long fuse",
              ("bounceM", "frictionM", "gravityM", "damage", "range", "blastForce")),
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
    ValuesRef("block_dirt", "DirtBlock", "DirtBlock5", ("health",)),
    ValuesRef("block_sand", "DirtBlock", "Desert Earth", ("health",)),
    ValuesRef("block_brick", "BrickBlock", "WallBrick1", ("health",)),
    ValuesRef("block_steel", "SteelBlock", "SteelBlock", ("health",)),
    ValuesRef("block_barrel", "BarrelBlock", "Barrel 1", ("health", "range")),
    ValuesRef("grass", "DoodadGrass", "Desert Long Grass Doodad", ("health", "width", "height")),
)
