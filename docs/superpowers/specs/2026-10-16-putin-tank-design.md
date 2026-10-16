# Broforce: Putin's tank — design spec

Date: 2026-10-16
Status: design agreed in chat (the user approved the direction and said to go ahead); this document records it.

## Goal

Putin's special stops being the matryoshka. It becomes Broforce's own tank drop:
- he throws the signal grenade and a tank falls from the sky;
- he climbs in, drives it, fires its cannon and its mortar, and climbs out at will;
- while anyone is inside, the Russian national anthem plays.

The tank is TankBro's `TankBroTank`, ported from the decompiled code and drawn from its own sheets, repainted in
Russian colours.

Success means that playing as Putin, the special calls the tank in, and walking into it boards it. Inside:
- the arrows drive, jump jumps, X fires and C switches between cannon and mortar;
- F climbs out;
- the anthem plays from boarding until leaving.

The tank soaks up enemy fire and, past its damage limit, smokes, flashes and blows up, throwing the driver clear.
Brolusconi is unchanged.

## Non-goals

- The tank's boost dash (`StartDashing`/`boostingForward`, which needs jet-pack fuel), the hatch and flag
  animations, the driver's head in the hatch, ledge grabbing.
- Mooks piloting tanks; enemy tanks.
- More than one tank per grenade; tanks for Brolusconi.
- Music for anything except the tank.

## Asset boundary

As before: Free Lives sprites and values are read from the local install and written only to `game-data/`
(gitignored). The anthem recording is downloaded into `game-data/audio/`, so it is never committed either.

The recording is "National Anthem of Russia (2000), instrumental, one verse" by the Presidential Orchestra of the
Russian Federation. It comes from Wikimedia Commons, taken from kremlin.ru, and attribution is its only condition of
reuse. The menu credits it. The anthem's music is a state symbol and is not covered by copyright in Russia (Civil
Code art. 1259).

## Extractor

- **Sheets.** Read as repaint sources:
  - `TankBroTank` on `TankBrosTank`: the hull, 2048×256, 48×48 frames, offset 20;
  - `TankBroTankTurret` on `Turret`: the turret, 1024×256, 48×48.

  Two new recipes write `sprites/tank_ru.png` and `sprites/turret_ru.png`. The hull's dark grey becomes military
  olive. The turret's red-white-blue stripes become the Russian white-blue-red. Palettes are measured on the real
  sheets during implementation and checked by eye on the whole sheets, as Putin's was.
- **Values:**
  - `tank`: `TankBroTank`'s `speed` (60), `_jumpForce` (290), `maxFallSpeed` (−600), `fireRate` (0.3),
    `maxDamageBeforeExploding` (25), `deathCountdownExplodeThreshold` (45);
  - `tank_turret`: `cannonFireSpeed` (44) and the muzzle-flash offsets;
  - the turret's projectiles, `shellPrefab` (`HeavyShell` on "Shell Heavy Tankbro") and `rocketBigPrefab`
    (`RocketMassive` on "Rocket Tankbro BIG"): `damage`, `range`, `life`, plus `horizontalAcceleration` and
    `crushWallLayers` for the rocket.
- **Anthem.** A separate step downloads
  `https://upload.wikimedia.org/wikipedia/commons/4/41/National_Anthem_of_Russia_%282000%29%2C_instrumental%2C_one_verse.ogg`.
  It checks a SHA-256 pinned in code and writes `audio/anthem_ru.ogg` with its source and licence in the manifest. If
  the network fails or the hash doesn't match, the extractor prints a warning and goes on; the game runs without the
  anthem. It never downloads when the file is already there with the right hash.

## Engine

### The special: `tank` (replaces `matryoshka`)

- `putin.json`: `"special": "tank"`. `SPECIALS` becomes `['airstrike', 'tank']`. The matryoshka's projectiles,
  constants, tests, art and findings entries are removed.
- Pressing special throws the signal grenade like the airstrike marker (`BroBase.UseSpecial`, short when ducking)
  and costs one special. Putin keeps BroLee's 2 per life. The speech bubble and the Russian line stay.
- When the fuse runs out (`AIRSTRIKE_FUSE`, 1 s) the tank is called in, ported from `GrenadeAirstrike.SpawnTank`:
  - it probes the ground under the five columns around the grenade (snapped to the grid);
  - it picks the lowest flat pair of columns, and the tank spawns above the screen top (`screenMaxY + 200`) over that
    spot and falls;
  - if no ground is found in reach, it drops at the screen's left edge facing right.
- **Landing.** `MookArmouredGuy.FallDamage`'s crush: landing faster than the hurt speed crushes the units under it
  (`Map.ExplodeUnits` 10 damage, 48 × 20; at the death speed 25 damage, 64 × 25). The tank takes no damage from its
  own drop.

### The tank (`engine/tank.ts`, `World.tanks`)

A vehicle object beside the units: position, velocity, facing, `damage` (shield damage + fire), a death countdown,
the gun index (0 mortar, 1 cannon), the turret's animation state, and whether the player is inside.

- **Boarding.** The player touching an empty, unexploded tank (box overlap) boards it, unless they climbed out less
  than 0.5 s ago. The bro is hidden and held at the tank's position, and can't be hurt. Mooks still see and shoot
  at that position, so their bullets and blasts hit the tank. Any bro can drive (after a rescue swap the new bro stays
  inside).
- **Driving.** Like `TestVanDammeAnim`'s movement with the tank's values: speed 60, jump 290, gravity, max fall −600,
  no wall climbing or dashing. Its box is the tank's own: 48 wide, matching the hull frame.
- **Firing**, ported from `TankBroTankTurret.FireWeapon`/`Update`/`FireShell`/`FireCannon`. The turret runs at
  0.0334 s a frame, with the original holds on its wind-up frames.
  - The **mortar** fires on frame 6: a `HeavyShell` from (X + dir·17, Y + 33) at (dir·150·0.9, 150·0.9). It flies
    straight for 0.1 s, slows from 0.1 to 0.35 s, then falls under 600 gravity as it slows (`HeavyShell.RunProjectile`).
  - The **cannon** winds up longer (holds of 2, 3, 4 and 5 frames on frames 3–6) and fires on frame 7: a
    `RocketMassive` from (X + dir·24, Y + 22) at dir·`cannonFireSpeed`. It gains 60 u/s² of horizontal speed and
    crushes through up to 4 blocks before bouncing (`RocketMassive`), then blows up with its extracted damage and
    range. Its firing frames are on turret row 2, the mortar's on row 0.
  - Holding fire queues the next shot as the original does.
- **Special inside** switches gun with the turret's transform animation (frames 0–20 on row 1). It costs no special.
- **Gesture (F) inside** climbs out, ported from `PressHighFiveMelee` → `DisChargePilot(130)`. The bro reappears at
  (X, Y + 32) with yI = 130 + 100 and can't re-board for 0.5 s. The empty tank stays where it is.
- **Damage** (`MookArmouredGuy.Damage` / `TankBroTank.Damage`). Bullets, rockets, explosions and fire that hit the
  tank add to `damage`.
  - Past `maxDamageBeforeExploding` (25) with someone inside, the death countdown starts: smoke, a hurt-flash on
    every other tick, faster as it goes. At `deathCountdownExplodeThreshold` (45 ticks) the tank gibs.
  - The gib (`MookArmouredGuy.Gib`) throws the driver clear (`DisChargePilot(180)`, briefly invulnerable), then
    explodes: `Map.ExplodeUnits` 20 damage, range 72 × 32, on everyone but the driver.
  - An empty tank blows up the same way once its damage passes 60 (`shieldDamage > 60`).
- **Rescue and extraction.** A rescue while driving swaps the bro inside, and the tank is kept. Reaching the flag
  while driving climbs out first, then extraction starts as usual.
- **Death.** The driver can't die inside. Respawning puts the bro on foot, and existing tanks stay.

### Design values (not in Broforce)

The 0.5 s re-board delay and the driver's invulnerability after a gib (0.5 s) are ours. They go under "Design values"
in `constants.ts` and in `docs/findings.md`.

## Render

- Hull frames come from the extracted `tank_ru` sheet, rows per `TankBroTank`'s animate methods (idle, rolling
  treads while moving, jump lift-off and landing, hurt flash), verified against the sheet. The turret is drawn on top
  from `turret_ru`, frames per `SetTurretFrame`: row 0 for the mortar's firing frames, rows 1–2 for the transform and
  the cannon.
- The bro isn't drawn while inside.
- The mortar shell and the big rocket use the extracted projectile sprites if their prefabs have them. Otherwise they
  get our own small art like the football; implementation checks the prefabs. Their blasts use the existing shader
  explosions (medium for the shell, large for the rocket).
- The death countdown shows its smoke plumes and the hurt flash (brightness, like the suicide mook's warning).

## UI, sound and the anthem

- **Anthem.** A `Music` player (one `HTMLAudioElement`, `loop`) plays `/audio/anthem_ru.ogg` while the player is
  inside a tank:
  - it fades in over 0.5 s on boarding and out over 0.5 s on leaving or on the tank's gib;
  - it pauses with the game's pause and is silent when "Effetti sonori" is off;
  - if the file is missing or can't load, it stays silent and doesn't throw.

  A pure `anthemShouldPlay(world)` decides it, so it can be tested.
- **Sound.** A tank cannon shot and a mortar thump join the synthesized effects. The gun switch reuses `throw`.
- **Menu.** The special hint becomes "Carro armato: lancia il segnale e salici sopra (X spara, C cambia arma, F
  scendi)". The note credits "Inno: Orchestra presidenziale della Federazione Russa (kremlin.ru)".

## Error handling

- `game-data/` without the tank sheets or values shows "Mancano i dati del gioco", as for any missing data.
- A missing anthem file is not an error: the tank works, silently.
- `parseBro` rejects the removed special `matryoshka` as unknown.

## Testing

- **Extractor (pytest):**
  - the tank and turret palettes;
  - the recipes list;
  - the anthem step: skip when present with the right hash, warn without failing on a download error or a bad hash.
    Use a fake fetcher; no network in tests.
  - Integration: the tank sheets and values exist.
- **Engine (Vitest):**
  - the spawn-spot search (flat pair, lowest, fallback to the screen edge);
  - the drop and the landing crush;
  - boarding by touch, with the re-board delay;
  - driving speed and jump;
  - the turret: mortar on frame 6, cannon timing, queued fire, the gun switch taking its frames;
  - the shell's flight curve; the rocket's acceleration and wall crushing;
  - climbing out with F;
  - damage past 25 starting the countdown, the gib at 45 throwing the driver clear, the explosion;
  - an empty tank blowing up past 60;
  - a rescue while driving; extraction while driving; enemy bullets hitting the tank, not the bro;
  - the matryoshka code is gone.
- **Music:** `anthemShouldPlay` over boarding, leaving, gib, pause and the sound toggle.
- **Manual:** re-extract, look at the repainted sheets, and play through REA in the browser: call the tank, board,
  drive, fire both guns, switch, climb out, take it to destruction. Check that the anthem element plays while inside;
  the browser can't be listened to, so check that its state goes to playing.

## Risks

- The hull's animate methods are long (`TankBroTank` 841 lines, `MookArmouredGuy` 1251). The port keeps what the
  non-goals leave: drive, jump, land, fire, hurt.
- Browsers block audio until the first user gesture. The anthem starts on boarding, which always comes after key
  presses, so autoplay rules are satisfied.
- If the Commons file changes, the pinned hash fails. The extractor warns and the game stays silent until the URL or
  hash is updated.
