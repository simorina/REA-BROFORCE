# Broforce: Elon Musk, the ultra-tech bro — design spec

Date: 2026-10-23
Status: the user asked for Elon Musk as "un personaggio ultra tech" and left the rest to me; these are my calls.

## Goal

A ninth playable parody bro, **Elon Musk**, built only out of Broforce's own tech:
- **Look:** Brobocop's armour, repainted into a white spacesuit with black trim and a glowing cyan visor.
- **Weapon, the Tesla gun:** Broden's lightning. Each press of fire lets off four zaps, one every 0.1 s. A zap locks
  onto the nearest mook ahead within 95 and hits him for 3; the first zap of a press arcs on to two more mooks further
  ahead (within 45, then 30). With no mook ahead it strikes the first wall within 72 (8 to the block), or the air 60
  out. Both put out the enemy shots in front of him. Point blank, the shock hits for 3 as well.
- **Special, the drone:** Broforce's `Drone Machinegun` follows him (14 behind, 14 up) and fires `Bullet Rambo`
  whenever he fires, one every 0.25 s at 400. It has 1 health; shot down, it falls burning and blows up. Each special
  adds a drone, up to three at once (Broforce gives a bro one).
- **Movement, the jetpack:** The Brocketeer's. A jump lights it (`BlastOff`; its +100 is lost to the jump that
  follows, as in Broforce), and holding jump pushes him up on its sinusoidal lift for up to 2.2 s, steering left and
  right. With the prefab's forces (0.09 and 0.08 against gravity's 1100) the lift slightly loses: from a jump he stays
  up about twice as long (1.4 s against 0.75). Landing or wall-dragging ends it.
- **Voice line:** "Occupy Mars!" (en-US).

Success means Musk can be picked in the menu or reached by a rescue. His lightning zaps and arcs, the drones follow
and shoot, and the jetpack carries him. Every other bro is unchanged.

## Non-goals

- Broden's electric dash special, Brobocop's auto-aim pistol, The Brocketeer's rocket slam.
- A Cybertruck, Starlink strikes, the Neuralink.
- Mooks shaking in electrified frames; the full-screen lightning flash.
- Broden standing still while the first zaps of a press go off (`AddSpeedLeft` / `AddSpeedRight`): a planted Musk
  would fight the jetpack.

## Asset boundary

Free Lives sprites and values are read from the local install into `game-data/` (gitignored), as before. The sounds
are our own synthesized ones.

## Values

| Key | From | Fields |
| --- | --- | --- |
| `tesla` | `Broden` on "Broden" | `lightningRange` 60, `maxElectricShocks` 4, `fireRate` 0.1 |
| `tesla_zap` | `ElectricZap` on "ElectricZap" | `MaxDeviation` 2, `MaxLife` 0.15, `ZapDuration` 0.15 |
| `drone` | `Drone` on "Drone Machinegun" | `speed` 80, `fireRate` 0.25, `health` 1 |
| `rocketpack` | `TheBrocketeer` on "TheBrocketeer" | `hoverDuration` 2.2, `defaultHoverForce` 0.09, `hoverSinForce` 0.08, `hoverSinSpeed` 12, `hoverSinStart` 20, `jetpackSideDirection` (160, -330), `jetpackDownDirection` (0, -370) |

## Sheets

- `musk`: recipe on Brobocop's body (`BROBOCOP_anim`). The armour's greys become whites, the dark trim stays dark,
  and the red visor becomes cyan. Skin and outline are kept.
- `tesla_gun`: recipe on Brobocop's gun (`BROBOCOP_gun_anim`). The pistol and arm become white, the darkest grey
  becomes a cyan coil, and the muzzle flash becomes cyan.
- `drone`: recipe on `Drone_Armed_anim`, its orange light turned cyan. `drone_gun` is `DroneGun_anim` as it is.

## Engine

- `WEAPONS` adds `tesla`, `SPECIALS` adds `drone`, and `BroDef` gains `jetpack?: true`.
- `tesla` kit: `TestVanDammeAnim.StartFiring` on a press loads 4 shocks; `RunFiring` zaps every `fireRate`. A zap is
  a projectile that does its damage once its head reaches the end (`ZapDuration`), then arcs on.
- `w.drones`: player-team units that projectiles and blasts can hit. They step after the bro (`Drone.CalculateMovement`),
  fire while he fires and die as `Drone.Gib`. The bro's death takes them with him.
- The jetpack lives in its own module. `stepPlayer` runs it after the bro's physics.

## Left to the builder

The drone's hover frames and the lightning's drawing (a jagged cyan line), checked by eye.
