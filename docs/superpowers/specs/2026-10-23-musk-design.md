# Broforce: Elon Musk, the ultra-tech bro — design spec

Date: 2026-10-23
Status: the user asked for Elon Musk as "un personaggio ultra tech" and left the rest to me; these are my calls.

## Goal

A ninth playable parody bro, **Elon Musk**, built only out of Broforce's own tech:
- **Look:** Brobocop's armour, repainted into a white spacesuit with black trim and a glowing cyan visor.
- **Weapon, the Tesla laser:** Satan's `LaserBeam` ("BossLaserBeam") in his hands, in Tesla blue. The user asked for
  it on 2026-10-24 ("deve essere figo"); it replaces the souped-up version of Broden's lightning he had first.
  Holding fire charges it for 0.25 s (Satan: `beamStartupDelayDelay` 1). Then a beam runs from the gun to the first
  solid block, 400 out at most (Satan's reaches across the screen).
  - **Damage:** every 0.05 s it hits whatever crosses its middle 10 (`damageBeamWidth`) for 2, with a shove. That
    includes the dead until they come apart, the vehicles and the Goliath. It takes 3 off the block at its end and off
    the block above that: it digs a tunnel two blocks high through earth, and steel stops it.
  - **Shots and arcs:** enemy shots on its line are destroyed. Every 0.12 s a Tesla arc (Broden's `ElectricZap`, 4 to
    the mook) jumps off it to the nearest mook within 72 above or below, then to one more within 40.
  - **Firing:** a tap still fires a 0.3 s pulse. On release it fades out over 0.25 s.
  - **Battery:** it holds 2.5 s of beam. When it runs out, the gun overheats and vents smoke until the battery is back
    to 35 %. After 0.35 s off it refills in 2 s.
  - **Feel:** it shakes the screen and, on the ground, pushes him back a little. It goes out when he takes the wheel of
    a vehicle and when he dies.
  - **Look** (`LaserBeamVisuals`): Satan's fire texture (`laserBeam`, recoloured plasma blue) repeats along the beam,
    long side along it, scrolling out from the gun. The beam swells to half width while charging and thins out as it
    fades. On top of that we add:
    - a wide blue halo and a white-hot core;
    - pulses of energy running down the beam, two strands twisting round it, and sparks crackling off it;
    - a flare and a cross of light at the gun;
    - `laserBeamBits`' glowing drop (recoloured too) where the beam eats into a wall, with sparks flying back off the
      wall (the Noisy Cricket's beam puff, blue and white sparks, now and then a wisp of smoke);
    - a flash and a shockwave as it lights;
    - while charging, sparks rushing in to the gun and a sight line flickering out to where it will hit;
    - while fading, the beam breaking up into drifting specks.
  - **Battery bar:** shown over his head while the battery isn't full. It is cyan, amber when low, and red and
    blinking while overheated.
  - **Sounds** (synthesized): a rising whine while charging, a blast as it lights, a throbbing hum while it burns, a
    power-down, and an overheat alarm.
- **Special, the drones:** Broforce's `Drone Machinegun`, two per special. They fly in a formation round his back, the
  first 14 behind and 14 up, and fire `Bullet Rambo` whenever he fires, one every 0.25 s at 400. Each has 1 health;
  shot down, it falls burning and blows up. Up to six fly at once (Broforce gives a bro one).
- **Movement, the jetpack:** The Brocketeer's. A jump lights it (`BlastOff`; its +100 is lost to the jump that
  follows, as in Broforce), and holding jump pushes him up on its sinusoidal lift for up to 2.2 s, steering left and
  right. With the prefab's forces (0.09 and 0.08 against gravity's 1100) the lift slightly loses: from a jump he stays
  up about twice as long (1.4 s against 0.75). Landing or wall-dragging ends it.
- **Voice line:** "Occupy Mars!" (en-US).

Success means Musk can be picked in the menu or reached by a rescue. His laser charges, burns and digs through earth,
its arcs jump to nearby mooks, the drones follow and shoot, and the jetpack carries him. Every other bro is unchanged.

## Non-goals

- Broden's electric dash special, Brobocop's auto-aim pistol, The Brocketeer's rocket slam.
- A Cybertruck, Starlink strikes, the Neuralink.
- Mooks shaking in electrified frames.
- Satan's beam reaching across the whole screen: ours stops at 400.
- The `_BendParams` shader that bends Satan's beam as it starts and ends, and his `Dissolve` particles (our drifting
  specks stand in for them).

## Asset boundary

Free Lives sprites and values are read from the local install into `game-data/` (gitignored), as before. The sounds
are our own synthesized ones.

## Values

| Key | From | Fields |
| --- | --- | --- |
| `tesla_zap` | `ElectricZap` on "ElectricZap" | `MaxDeviation` 2, `MaxLife` 0.15, `ZapDuration` 0.15 (the arcs) |
| `drone` | `Drone` on "Drone Machinegun" | `speed` 80, `fireRate` 0.25, `health` 1 |
| `rocketpack` | `TheBrocketeer` on "TheBrocketeer" | `hoverDuration` 2.2, `defaultHoverForce` 0.09, `hoverSinForce` 0.08, `hoverSinSpeed` 12, `hoverSinStart` 20, `jetpackSideDirection` (160, -330), `jetpackDownDirection` (0, -370) |

The laser's own numbers are ours and live in `laser.ts` (`LASER`). They are set against Satan's prefab (`LaserBeam`
on "BossLaserBeam": `beamWidth` 20, `damageBeamWidth` 10, `beamStartupDelayDelay` 1, `disappateTime` 0.4, `damageRate`
0.025), which is not extracted.

## Sheets

- `musk`: recipe on Brobocop's body (`BROBOCOP_anim`). The armour's greys become whites, the dark trim stays dark,
  and the red visor becomes cyan. Skin and outline are kept.
- `tesla_gun`: recipe on Brobocop's gun (`BROBOCOP_gun_anim`). The pistol and arm become white, the darkest grey
  becomes a cyan coil, and the muzzle flash becomes cyan.
- `drone`: recipe on `Drone_Armed_anim`, its orange light turned cyan. `drone_gun` is `DroneGun_anim` as it is.
- `plasma_beam` and `plasma_flare`: Satan's `laserBeam` (32 x 128) and `laserBeamBits` (256 x 256), recoloured by a
  tone function. In the fire, green says how hot a pixel is (orange to yellow), and the tone paints that from deep blue
  to cyan; blue says how white it is, which becomes the blue-white core; red says how bright it is, which keeps the
  drop's dark edge dark.

## Engine

- `WEAPONS` adds `tesla`, `SPECIALS` adds `drone`, and `BroDef` gains `jetpack?: true`.
- `tesla` kit: `stepLaserGun` (`laser.ts`) handles the trigger, the charge, the battery and the overheat. It also works
  out where the beam ends (`beamEnd`: a march along the beam to the first solid block). `burnLaser` does the damage
  after the weapon step. The arcs are `w.zaps` (`tesla.ts`); each does its damage once its head reaches the end
  (`ZapDuration`).
- `w.drones`: player-team units that projectiles and blasts can hit. They step after the bro (`Drone.CalculateMovement`),
  fire while he fires and die as `Drone.Gib`. The bro's death takes them with him.
- The jetpack lives in its own module. `stepPlayer` runs it after the bro's physics.

## Left to the builder

The drone's hover frames and the laser's drawing, checked by eye.
