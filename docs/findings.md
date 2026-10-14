# Broforce RE findings used by the remake

Target: Broforce (Steam, `Broforce_beta_Data`), Unity 2017.4.7f1, Mono. Code decompiled with dnSpyEx 6.6.0
from `Assembly-CSharp.dll` (SHA-256 6059336e…f3a9; REA identified it as unity-mono CIL). Prefab values read
with UnityPy 1.25.4 from `networkobjects`, `sharedtextures` and `sharedassets` bundles.

## Ported from code

| Value | Source |
|---|---|
| Tile 16, cell c centred at x = 16c | `Map.TileSize`, `Map.GetCollumn`, `Map.GetRow` |
| Gravity 1100 | `TestVanDammeAnim.ApplyNormalGravity` |
| Run accel speed·2 (dash ·4), start at 25, extra ·2.6 below 50 | `TestVanDammeAnim.AddSpeedLeft/Right` |
| Dash ×1.33 | `TestVanDammeAnim.dashSpeedM` |
| Ground friction 10 | `TestVanDammeAnim.frictionM` |
| Held jump: yI stays at jumpForce for JUMP_TIME 0.123 s while jump is held; a ceiling ends it | `TestVanDammeAnim.JUMP_TIME`, `jumpTime` handling |
| Jump buffer 0.2 s: jump pressed in the air fires on landing if still held | `pressedJumpInAirSoJumpIfTouchGroundGrace` |
| Wall climb: boost 190, gravity ×0.66, 8 frames × 0.033 s | `AnimateWallClimb`, `ApplyWallClimbingGravity` |
| Half width 6, head height 15 | `TestVanDammeAnim.halfWidth`, `Unit.headHeight` |
| Mook bullet 250, bazooka rocket 100, bazooka delay 1.4 s | `Mook.UseFire`, `MookBazooka.UseFire/FireWeapon` |
| Sight 300 × 20 | `EnemyAI.sightRangeX/Y` |
| Explosion maths (ground r = range/2; units range·1.5, kill range, force blastForce·20, extra Y) | `Rocket.MakeEffects`, `Map.ExplodeUnits`, `MapController.DamageGround` |
| Suicide mook blast 10/9, force ·40, fuse 0.6–0.8 s | `MookSuicide.MakeEffects`, `MookSuicide.Start` |
| Barrel blast 12, range ·1.2, force 200, hurts everyone | `BarrelBlock` |
| Airstrike: throw (200,150)/(30,70); 5 bombs at 45°, y offsets 580…420, x − 480 − h, speed 200 + 0–30 | `BroBase.UseSpecial`, `GrenadeAirstrike.Death` |
| Animation rows: idle 0, run 1 (8 frames, 0.025 s), jump/climb 2, dash 3; death cols 4/5 | `TestVanDammeAnim.Animate*` |
| Caged prisoner idles on `Hobro_anim` columns 0–3 (4–5 are its death poses) | observed in the extracted sheet |

## Read from prefabs (game-data/values.json)

Brolusconi = Double Bro Seven: jump 260, speed 110, health 1, fireRate 0.27, specials 4, wall climb, dash.
Mook: health 3, speed 70, jump 200, fireRate 0.17. Bazooka mook: health 4. Suicide mook: health 3, range 40.
Bullet: damage 1, life 0.45. Bazooka rocket (`RocketSeeking`): damage 10, range 28, life 3.
Airstrike bomb (`RocketBombardment`): damage 10, range 28, life 5. Airstrike grenade: bounce 0.4, friction 0.6.
Blocks: dirt 5, brick 5, steel 500000, barrel 1 (range 50).

Brolusconi's repaint maps Double Bro Seven's palette: the red lapel flower becomes a blue pocket square,
the bow tie stays black (it shares the outline colour).

## Design values (not in Broforce)

Football: kick (220, 160), bounce 0.7, friction 0.85, explodes on contact / after 3 bounces / 1.6 s,
damage 5, range 32. Airstrike fuse 1.0 s (the prefab's `life` is 0; the real fuse is set elsewhere). Coyote time 0.1 s after
walking off a ledge.
Mook bursts of 3, 1 s pause, 0.4 s reaction, turn every 2.5 s. Lives 3, respawn 1.5 s, extraction 3 s.

## Simplified or left out

No water, quicksand, ladders, ziplines, parachutes, air dash, wall drag, falling blocks, gibs, fire,
homing rockets, mook jumping AI or co-op. Knockback is additive. `Map.ExplodeUnits` multiplies its
`yI` argument for every unit it visits after a close one; the port keeps that boost per unit.
