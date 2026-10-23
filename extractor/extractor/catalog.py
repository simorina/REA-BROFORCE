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
    SpriteRef("bro_brobocop", "Brobocop", "BroboCop", True),  # repainted into Elon Musk
    SpriteRef("drone_src", "Drone", "Drone Machinegun", True),  # Elon Musk's drone: repainted into drone
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
    SpriteRef("mook_bruiser_elite", "MookBigGuyElite", "ZMookBigElite", True),
    SpriteRef("mook_dolph", "DolphLundrenSoldier", "DolfLundgrenSoldier", True),  # the universal soldier: 48x48
    SpriteRef("alien_xeno", "AlienXenomorph", "ZAlienXenomorph", True),  # 48x48
    SpriteRef("alien_xeno_brain", "AlienXenomorph", "ZAlienXenomorphBrainBox", True),
    SpriteRef("alien_hugger", "AlienFaceHugger", "ZAlienFaceHugger", True),
    SpriteRef("alien_snake", "AlienFaceHugger", "ZSnake", True),
    SpriteRef("alien_melter", "AlienMelter", "ZAlienMelter", True),
    SpriteRef("alien_brute", "AlienBrute", "ZAlienBrute", True),  # 64x64
    SpriteRef("alien_mosquito", "AlienMosquito", "ZAlienMosquito", True),
    SpriteRef("hell_dog", "HellDog", "ZHellDog", True),
    SpriteRef("hell_lostsoul", "HellLostSoul", "ZHellLostSoul", True),
    SpriteRef("hell_boomer", "MookHellBoomer", "ZMookHellBoomer", True),  # 36x36
    SpriteRef("hell_soulcatcher", "MookHellSoulCatcher", "ZMookHellSoulCatcher", True),  # 36x36
    SpriteRef("hell_bigguy", "MookHellBigGuy", "ZHellBigGuy", True),  # 36x32
    SpriteRef("hell_armoured", "MookHellArmouredBigGuy", "ZMookHellArmouredBigGuy", True),  # 36x36
    SpriteRef("undead", "UndeadTrooper", "ZMookUndead", True),
    SpriteRef("undead_suicide", "MookSuicideUndead", "ZMookUndeadSuicide", True),
    SpriteRef("skinless", "SkinnedMook", "ZMookSkinless", True),
    SpriteRef("warlock", "Warlock", "ZMookWarlock", True),
    SpriteRef("satan", "Satan", "ZSatan", True),  # Brovil
    SpriteRef("truck", "MookTruck", "MookTruck", True),  # 74x64: rolling 0-1, wrecked 2
    SpriteRef("apc", "MookAPC", "MookAPC", True),  # 96x64: row 0 rolling (wreck at 8), row 1 the panel down
    SpriteRef("bike", "MookMotorBike", "MookMotorBike", True),  # 64x32: row 1 rolling 0-1, wrecked 2
    SpriteRef("kopter", "Mookopter", "MookKopter", True),  # 80x64 chassis: 0 flying, 9 wrecked
    SpriteRef("artillery", "MookArtilleryTruck", "MookArtilleryTruck", True),  # 64x96, anchored at its bottom: unfold row 0, fire row 2, wrecks row 4
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
    SpriteRef("block_dirt_hell", "DirtBlock", "Hell Dirt Block", True),  # Themeholder Hell's earth, laid out like the jungle's
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
    TextureRef("bruiser_elite_gun", "mookbigElite_gun_anim", frame=(36, 32)),  # the elite Bruiser's rocket launcher, laid out like the minigun
    TextureRef("rocket_evil", "rocket Evil", frame=(16, 16)),
    TextureRef("dolph_gun", "universal_jerk_gun_rocket_anim", frame=(64, 64)),  # his rocket launcher: 0 at rest, 1-3 firing, 6-7 beeping  # DrunkRocket "Rocket Drunk Evil"
    TextureRef("nuke_bomb", "Nuclear Bomb", frame=(32, 32)),  # the nuclear motorbike's bomb
    TextureRef("kopter_gun", "mook_Kopter_Chaingun", frame=(48, 64)),  # TankChaingun: spinning 0-3, firing 4-7, turning 8+, dead 13
    TextureRef("kopter_rotor", "mook_Kopter_Rotor_Main", frame=(64, 16)),
    TextureRef("kopter_tail", "mook_Kopter_Rotor_Side", frame=(32, 16)),
    TextureRef("kopter_missiles", "mook_Kopter_Missiles", frame=(80, 32)),  # the rack, emptying as it bombs
    TextureRef("mine", "LandMine", frame=(16, 16)),  # the Mine prefab's SpriteSM: 0 armed, 1 (lowerLeftPixel x 16) going off
    TextureRef("mine_sign", "MineSign"),  # the Mine Field Sign doodad
    TextureRef("hell_bigguy_gun", "mookhellbig_gun_anim", frame=(36, 32)),  # the hell Bruisers' flame thrower, laid out like the minigun
    TextureRef("skinless_gun", "SkinnlessMook_gun_anim", frame=(32, 32)),  # the skinless mook's arms
    TextureRef("warlock_portal", "mookUndead_Portal_anim", frame=(32, 32)),  # WarlockPortal: growing 0-5, open 2-9, shrinking to 14
    TextureRef("slime_vomit", "Slime Vomit"),  # the Boomer's SlimeDrop
    TextureRef("brobocop_gun", "BROBOCOP_gun_anim", frame=(32, 32)),  # Brobocop's pistol and arm, repainted into the tesla_gun
    TextureRef("drone_gun", "DroneGun_anim", frame=(32, 32)),  # the drone's machine gun: 0 at rest, 1-3 firing
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
    ValuesRef("mook_mortar", "MookMortar", "ZMookMortar", MOOK_FIELDS),
    ValuesRef("ai_mook_mortar", "MortarAI", "ZMookMortar", ("sightRangeX", "sightRangeY", "attackTime", "sightDelay", "walkTime")),
    ValuesRef("path_mook_mortar", "PathAgent", "ZMookMortar", PATH_FIELDS),
    ValuesRef("rocket_launch", "RocketLaunch", "Rocket Launch Airstrike", ROCKET_FIELDS),
    ValuesRef("mook_bruiser_elite", "MookBigGuyElite", "ZMookBigElite", MOOK_FIELDS + ("runSpeedMultiplier",)),
    ValuesRef("ai_mook_bruiser_elite", "BigGuyEliteAI", "ZMookBigElite", AI_FIELDS + ("jumpRange",)),
    ValuesRef("path_mook_bruiser_elite", "PathAgent", "ZMookBigElite", PATH_FIELDS),
    ValuesRef("rocket_drunk", "DrunkRocket", "Rocket Drunk Evil", ROCKET_FIELDS + ("drunkSpeed", "acceleration")),
    ValuesRef("alien_xeno", "AlienXenomorph", "ZAlienXenomorph", MOOK_FIELDS + ("unawareRunSpeed", "awareRunSpeed", "awareMegaRunSpeed", "unawareMegaRunSpeed")),
    ValuesRef("ai_alien_xeno", "XenomorphAI", "ZAlienXenomorph", AI_FIELDS + ("attackRangeX", "attackRangeY")),
    ValuesRef("path_alien_xeno", "PathAgent", "ZAlienXenomorph", PATH_FIELDS),
    ValuesRef("alien_xeno_brain", "AlienXenomorph", "ZAlienXenomorphBrainBox", MOOK_FIELDS + ("unawareRunSpeed", "awareRunSpeed", "awareMegaRunSpeed", "unawareMegaRunSpeed")),
    ValuesRef("ai_alien_xeno_brain", "XenomorphAI", "ZAlienXenomorphBrainBox", AI_FIELDS + ("attackRangeX", "attackRangeY")),
    ValuesRef("path_alien_xeno_brain", "PathAgent", "ZAlienXenomorphBrainBox", PATH_FIELDS),
    ValuesRef("alien_hugger", "AlienFaceHugger", "ZAlienFaceHugger", MOOK_FIELDS + ("unawareRunSpeed", "awareRunSpeed", "awareMegaRunSpeed", "unawareMegaRunSpeed")),
    ValuesRef("ai_alien_hugger", "FacehuggerAI", "ZAlienFaceHugger", AI_FIELDS + ("attackRangeX", "attackRangeY")),
    ValuesRef("path_alien_hugger", "PathAgent", "ZAlienFaceHugger", PATH_FIELDS),
    ValuesRef("alien_snake", "AlienFaceHugger", "ZSnake", MOOK_FIELDS + ("unawareRunSpeed", "awareRunSpeed", "awareMegaRunSpeed", "unawareMegaRunSpeed")),
    ValuesRef("ai_alien_snake", "FacehuggerAI", "ZSnake", AI_FIELDS + ("attackRangeX", "attackRangeY")),
    ValuesRef("path_alien_snake", "PathAgent", "ZSnake", PATH_FIELDS),
    ValuesRef("alien_melter", "AlienMelter", "ZAlienMelter", MOOK_FIELDS + ("unawareRunSpeed", "awareRunSpeed", "awareMegaRunSpeed", "unawareMegaRunSpeed")),
    ValuesRef("ai_alien_melter", "AlienMelterAI", "ZAlienMelter", AI_FIELDS + ("attackRangeX", "attackRangeY")),
    ValuesRef("path_alien_melter", "PathAgent", "ZAlienMelter", PATH_FIELDS),
    ValuesRef("alien_brute", "AlienBrute", "ZAlienBrute", MOOK_FIELDS + ("unawareRunSpeed", "awareRunSpeed", "awareMegaRunSpeed", "unawareMegaRunSpeed")),
    ValuesRef("ai_alien_brute", "AlienBruteAI", "ZAlienBrute", AI_FIELDS + ("attackRangeX", "attackRangeY")),
    ValuesRef("path_alien_brute", "PathAgent", "ZAlienBrute", PATH_FIELDS),
    ValuesRef("alien_mosquito", "AlienMosquito", "ZAlienMosquito", MOOK_FIELDS),
    ValuesRef("ai_alien_mosquito", "AlienMosquitoAI", "ZAlienMosquito", AI_FIELDS),
    ValuesRef("path_alien_mosquito", "PathAgent", "ZAlienMosquito", PATH_FIELDS),
    ValuesRef("hell_dog", "HellDog", "ZHellDog", MOOK_FIELDS),
    ValuesRef("ai_hell_dog", "HellDogAI", "ZHellDog", AI_FIELDS + ("attackRangeX", "attackRangeY")),
    ValuesRef("path_hell_dog", "PathAgent", "ZHellDog", PATH_FIELDS),
    ValuesRef("hell_lostsoul", "HellLostSoul", "ZHellLostSoul", MOOK_FIELDS + ("diveSpeed", "diveSpeedMax", "explodeRange", "broHarmRangeM",
              "seekTurningSpeedM", "sinWobbleSpeed", "sinWobbleRadian", "diveDelayDuration")),
    ValuesRef("ai_hell_lostsoul", "LostSoulAI", "ZHellLostSoul", AI_FIELDS),
    ValuesRef("path_hell_lostsoul", "PathAgent", "ZHellLostSoul", PATH_FIELDS),
    ValuesRef("hell_boomer", "MookHellBoomer", "ZMookHellBoomer", MOOK_FIELDS + ("explosionRange", "warningTime")),
    ValuesRef("ai_hell_boomer", "BoomerAI", "ZMookHellBoomer", AI_FIELDS),
    ValuesRef("hell_soulcatcher", "MookHellSoulCatcher", "ZMookHellSoulCatcher", MOOK_FIELDS + ("explosionRange", "warningTime")),
    ValuesRef("ai_hell_soulcatcher", "SoulCatcherAI", "ZMookHellSoulCatcher", AI_FIELDS),
    ValuesRef("hell_bigguy", "MookHellBigGuy", "ZHellBigGuy", MOOK_FIELDS),
    ValuesRef("ai_hell_bigguy", "BigGuyAI", "ZHellBigGuy", AI_FIELDS),
    ValuesRef("hell_armoured", "MookHellArmouredBigGuy", "ZMookHellArmouredBigGuy", MOOK_FIELDS),
    ValuesRef("ai_hell_armoured", "BigGuyAI", "ZMookHellArmouredBigGuy", AI_FIELDS),
    ValuesRef("flame_wall_hell", "FlameWallExplosion", "flameWallExplosion HellMook",
              ("maxCollumns", "maxRows", "totalExplosions", "explosionRate", "damageAmount", "maxPuffDelay", "yExplosionOffset")),
    ValuesRef("slime_vomit", "SlimeDrop", "Slime Vomit Drop", ("damageInternal", "gravityM", "life", "projectileSize")),
    ValuesRef("undead", "UndeadTrooper", "ZMookUndead", MOOK_FIELDS),
    ValuesRef("ai_undead", "UndeadTrooperAI", "ZMookUndead", AI_FIELDS),
    ValuesRef("path_undead", "PathAgent", "ZMookUndead", PATH_FIELDS),
    ValuesRef("undead_suicide", "MookSuicideUndead", "ZMookUndeadSuicide", MOOK_FIELDS + ("range", "blastForce")),
    ValuesRef("ai_undead_suicide", "UndeadSuicideAI", "ZMookUndeadSuicide", AI_FIELDS),
    ValuesRef("path_undead_suicide", "PathAgent", "ZMookUndeadSuicide", PATH_FIELDS),
    ValuesRef("skinless", "SkinnedMook", "ZMookSkinless", MOOK_FIELDS),
    ValuesRef("ai_skinless", "SkinlessMookAI", "ZMookSkinless", AI_FIELDS),
    ValuesRef("path_skinless", "PathAgent", "ZMookSkinless", PATH_FIELDS),
    ValuesRef("warlock", "Warlock", "ZMookWarlock", MOOK_FIELDS),
    ValuesRef("ai_warlock", "MookWarlockAI", "ZMookWarlock", AI_FIELDS),
    ValuesRef("path_warlock", "PathAgent", "ZMookWarlock", PATH_FIELDS),
    ValuesRef("warlock_portal", "WarlockPortal", "WarlockPortal Suicide", ("launchDelay", "riseTime", "riseSpeed")),
    ValuesRef("satan", "Satan", "ZSatan", MOOK_FIELDS),
    ValuesRef("tesla", "Broden", "Broden", ("lightningRange", "maxElectricShocks", "fireRate")),  # Elon Musk's Tesla gun
    ValuesRef("tesla_zap", "ElectricZap", "ElectricZap", ("MaxDeviation", "MaxLife", "ZapDuration")),
    ValuesRef("drone", "Drone", "Drone Machinegun", ("speed", "fireRate", "health")),
    ValuesRef("rocketpack", "TheBrocketeer", "TheBrocketeer", ("hoverDuration", "defaultHoverForce", "hoverSinForce", "hoverSinSpeed",
              "hoverSinStart", "jetpackSideDirection", "jetpackDownDirection")),
    ValuesRef("ai_satan", "SatanAI", "ZSatan", AI_FIELDS),
    ValuesRef("mook_dolph", "DolphLundrenSoldier", "DolfLundgrenSoldier", MOOK_FIELDS),
    ValuesRef("ai_mook_dolph", "DolfLundgrenAI", "DolfLundgrenSoldier", AI_FIELDS),
    ValuesRef("foe_truck", "MookTruck", "MookTruck", ("health", "tankSpeed", "mooksToSpawn")),
    ValuesRef("ai_foe_truck", "MookTruckPolyAI", "MookTruck", ("sightRangeX", "sightRangeY")),
    ValuesRef("foe_apc", "MookAPC", "MookAPC", ("health", "tankSpeed", "mooksToSpawn")),
    ValuesRef("ai_foe_apc", "MookTruckPolyAI", "MookAPC", ("sightRangeX", "sightRangeY")),
    ValuesRef("foe_bike", "MookMotorBike", "MookMotorBike", ("health", "tankSpeed", "mookJumpForce")),
    ValuesRef("foe_artillery", "MookArtilleryTruck", "MookArtilleryTruck", ("health", "tankSpeed")),
    ValuesRef("foe_kopter", "Mookopter", "MookKopter", ("health", "tankSpeed", "verticalSpeed")),
    ValuesRef("ai_foe_kopter", "MookopterPolyAI", "MookKopter", ("sightRangeX", "sightRangeY", "sightDelay")),
    ValuesRef("bullet_huge", "Projectile", "Bullet Huge", BULLET_FIELDS),
    ValuesRef("ai_foe_artillery", "MookArtilleryTruckPolyAI", "MookArtilleryTruck", ("sightRangeX", "sightRangeY", "attackTime", "sightDelay")),
    ValuesRef("ai_foe_bike", "MookMotorBikePolyAI", "MookMotorBike", ("sightRangeX", "sightRangeY", "attackXRange")),
    ValuesRef("foe_nukebike", "MookMotorBike", "MookMotorBike Nuclear", ("health", "tankSpeed", "mookJumpForce")),
    ValuesRef("ai_foe_nukebike", "MookMotorBikePolyAI", "MookMotorBike Nuclear", ("sightRangeX", "sightRangeY", "attackXRange")),
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
