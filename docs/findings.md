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
| Mook AI is an action queue: when empty it "thinks" a batch for its mental state (idle / suspicious / alerted), each step the front action becomes input and is ticked | `PolymorphicAI.Think`, `RunQueue`, `GetInput` |
| Idle: 3–5 × (Wait min–maxIdle, or 50 % Move to a random patrol cell) + LookForEnemy; patrol cells = standable cells up to `patrolBlocksRadius` each side | `PolymorphicAI.DoIdleThink`, `SetupAvailableGridPoints`, `GetNewGridPoint` |
| Sight: player within rangeX/rangeY of (x − dir·5, y + 10), on the looking side, clear ray between both y + 6 (stopping 6 short) | `HeroController.CanSeePlayer`, `IsPlayerNearby` |
| Spotting: Wait 0.2, "!" (GreetPlayer), Wait `sightDelay`, face the player, become alerted | `PolymorphicAI.FullyAlert` |
| Trooper alerted: Fire for `attackTime` (one shot, as 0.06 < fireRate), sometimes a second, up to 3 single steps or 0.4 s waits, Wait `delayBetweenFiring`; turns at random after 3 blind thinks | `MookTrooperAI.DoAlertedThink` |
| Bazooka alerted: fires midway through `delayBetweenFiring`; after 2 blind thinks goes suspicious with a "?" | `MookBazookaAi.DoAlertedThink` |
| Suicide: runs at the player at 140; fuse lit when it starts running: explodes within 24 × 24 ahead after 0.5 s, or after 4 s (2.5× faster when blocked); killed, it explodes 0.7 s later; blast at its feet | `SuicideAI`, `MookSuicide.AnimateRunning/Damage/MakeEffects` |
| Firing: pressing fire primes `fireCounter = fireRate` when fireRate < 0.3, then one shot per fireRate while held | `TestVanDammeAnim.StartFiring`, `RunFiring` |
| Mooks only shoot while on screen; bazooka `fireDelay` 1.4 | `Mook.UseFire`, `MookBazooka.UseFire/FireWeapon` |
| Noises: rockets 80, barrels 120; a mook hears within noise + its `hearingRangeX/Y`; idle → suspicious, "?", turns to look | `Rocket.MakeEffects`, `BarrelBlock`, `Map.DisturbWildLife`, `PolymorphicAI.HearSound` |
| Walking into a mook alerts it (\|dx\| − 8 < width 8, \|y + 3 + 3 − Y\| − 8 < height 6) | `TestVanDammeAnim.AlertNearbyMooks`, `Map.AlertNearbyMooks` |
| When the bro dies, alerted mooks laugh ("!") and go idle | `Map.ForgetPlayer`, `PolymorphicAI.TryLaughAtDeadPlayer/AddLaughAction` |
| Explosions aim at a unit's Y + height/2 (height 6), skip invulnerable units, and also hit corpses | `Map.ExplodeUnits`, prefab `Unit.height` |
| Gib when health drops below −10 (corpses keep taking damage) | `TestVanDammeAnim.gibThreshold`, `Damage` |
| Checkpoint: \|dx\| < 48 (10 when running at it faster than 30), \|cp.Y + 20 − y\| < 40; respawn at (x, y + 16); the blocks under the pole turn to steel when destroyed | `Map.CheckCheckPoint`, `CheckPoint.ActivateInternal/Update` |
| Respawn after 1.8 s, invulnerable 0.5 s (flash: tint 0.5 + sin(t·25)·0.23); a freed prisoner is invulnerable 0.75 s | `HeroController.broRespawnDelay`, `Player.SpawnHero`, `InvulnerabilityFlash`, `RescueBro.Free` |
| Airstrike height h = screen top − Y | `GrenadeAirstrike.Death`, `SortOfFollow.GetScreenMaxY` |
| Judo throw = BroLee's forward strike: 8 frames of 0.045 s, units hit on frames 2–5 in the box range 13 around (X + dir·7, Y + 7); on frame 2 with nothing grabbed, the first block 9–17 px ahead at Y + 6 takes 5; frames column 24+, rows 7/8 alternating | `BroLee.Awake`, `StartFiring`, `RunFiring`, `AnimateAttackForwards`, `BrocSnipes.FireWeaponGround`, `Map.HitUnits` |

## Read from prefabs (game-data/values.json)

Brolusconi = Double Bro Seven: jump 260, speed 110, health 1, fireRate 0.27, specials 4, wall climb, dash.
Putin = BroLee: jump 260, speed 120, health 1, fireRate 0.2, specials 2, wall climb, dash.
Mook: health 3, speed 70, jump 200, fireRate 0.17, hearing 50 × 0. Bazooka mook: health 4. Suicide mook: health 3,
range 40, hearing 100 × 50.
AI components (`sightRangeX/Y`, `attackTime`, `sightDelay`, `delayBetweenFiring`, `patrolBlocksRadius`, idle wait):
`MookTrooperAI` on ZMook 300/20, 0.06, 1.66, 1.78, 2, 0.3–1; `MookBazookaAi` on ZMookBazooka 300/64, 0.3, 1.66, 1.76;
`SuicideAI` on ZMookSuicide 300/20, 7, 0.55, 1.25.
Bullet: damage 1, life 0.45. Bazooka rocket (`RocketSeeking`): damage 10, range 28, life 3.
Airstrike bomb (`RocketBombardment`): damage 10, range 28, life 5. Airstrike grenade: bounce 0.4, friction 0.6.
Blocks: dirt 5, brick 5, steel 500000, barrel 1 (range 50).

Brolusconi's repaint maps Double Bro Seven's palette: the red lapel flower becomes a blue pocket square,
the bow tie stays black (it shares the outline colour).
Putin's repaint maps BroLee's palette (skin → pale pink). His hair and trousers share `#161616` with `#000000`
shading, so each 32×32 frame is flood-filled: a dark region touching a shoe (`#0E0E0E`) or sock (`#F1F2F6`) is
trousers (olive), any other is hair (ash-brown, darker sides). Right on every frame the game draws.

## Design values (not in Broforce)

Football: kick (220, 160), bounce 0.7, friction 0.85, explodes on contact / after 3 bounces / 1.6 s,
damage 5, range 32. Airstrike fuse 1.0 s (the prefab's `life` is 0; the real fuse is set elsewhere). Coyote time 0.1 s after
walking off a ledge.
Judo: the grabbed mook (instead of BroLee's back somersault) is thrown at (180, 240) from 10 px ahead and 10 up, and blows up on a block, an enemy or after 2 s with the football's blast (a suicide mook with its own, on the bro's side).
Lives 3, extraction 3 s; a checkpoint flag takes 0.6 s to climb. Freeing a prisoner gives the bro the freed
prisoner's 0.75 s of invulnerability and swaps to the next bro (HeroController.SwapBro respawns a new bro; ours takes over in place). The suicide mook's warning flash speeds up as its fuse
runs down. The pathfinder's budget is 60 expanded points per millisecond of the C#'s time limit. Our own art and sound:
the football, the speech bubble and WebAudio-synthesized effects; no Broforce audio is used. The level layout, hill
and grass placement, scout and door placement are ours.

## Simplified or left out

No water, quicksand, ladders, ziplines, parachutes, air dash, wall drag, falling blocks, burning blocks or
spreading fire (only mooks escaping a collapsing door burn), homing rockets or co-op. `DoIdleThink`'s duplicated
AddAction is a one-frame no-op and is dropped. Only MookGeneral/Satan ("evil" units) can block a checkpoint, so ours
never are. `Map.ExplodeUnits` multiplies its `yI` argument for every unit it visits after a close one; the port keeps
that boost per unit. Bullets skip corpses: every `Map.HitUnits` variant requires `health > 0`, whatever
`Demonstration.projectilesHitWalls` says. A respawn keeps the current bro (Broforce brings in another one).

## Effects, background and more AI (second pass)

Extracted from the install by `extractor/extractor/effects.py` into `game-data/` (local only): the Desert
ThemeHolder's sky, BlueSky clouds and parallax hills (`ParallaxFollow` factors 0.3/0.4/0.6, sky 1.0); the
EffectsController / EffectsHolderTheme particle emitters (dirt, blood big/small/dots, sparks, dust) with their
`ParticleCollisionAnimator` values; Puff animations (blood gush/spurt/splash, foot and land poofs, muzzle flash,
smoke, stun stars); the ZMook's "!"/"?" ReactionBubbles; the desert long grass; block blood sprays; the shared
GibHolderBro (pieces cut from each unit's own sheet). Ported: `ParticleCollisionAnimator.Update`, `Puff.Update`,
`Shrapnel`/`BloodyShrapnel`/`Gib`, `Map.ConstrainToBlocks`, `Block.CreateDecal`, `WobbleSprite`, the
EffectsController call sites (block collapse, bullet hits, deaths, gibs, rocket/barrel explosions, mook muzzle
flash and bazooka smoke, foot/land poofs). Hill placement along level 1 is our design. (The plumes and the shader
explosions, left out here, came in the fourth pass.)

AI: hiding in long grass (`HideInGrass`, `DoHidingThink`, hidingLookXRange, JumpOutOfHiding), panic
(`Mook.Panic`/`PolymorphicAI.Panic` with `blindTime`, set off by `Grenade.RunWarnings` on the airstrike grenade),
blindness (`Mook.Blind`, blind trooper turning away, stun stars) and attraction (`Attract`, `DoAttractedThink`) with
`Map.BlindUnits`/`AttractMooks` (nothing in Brolusconi's kit blinds; the flex attracts, see the fourth pass), the off-screen freeze of idle
mooks, the shared laugh index, `MookSuicide.AnimateSpecial2`, `TestVanDammeAnim.Knock` with `xIBlast` (knockback is
no longer additive), the bazooka recoil and the second `CheckCheckPoint` probe at ground height + 32.

## Pathfinding, the scout and mook doors (third pass)

`engine/pathfinding.ts` ports `PathfindingController.FindPath`: A* over cells with a Manhattan heuristic, its
`GetAccessiblePoints` kept as a lazy generator so the open/closed checks interleave with the loop as in the C#
(walk ±1; jump straight up `1..jumpHeight-1` at cost 2+i; diagonal jumps at 1.5+1.5j, at most one cell beside a wall;
drift ±1 down from the air when the fall began on the ground or in a jump; drop when the fall is shorter than
`maxDropDistance`; wall climbing), with both fallbacks (best point by heuristic). `Map.IsBlockSolid` counts every cell
outside the map as solid. The C# stops after 10 ms (FollowPath) or 100 ms (MookDoor.AlarmMooks); the port counts
expanded points instead, `PATH_EXPANSIONS_PER_MS` = 60 (a design value), so a path does not depend on the machine.
`engine/pathagent.ts` ports `PathAgent.GetMove`: node advance against the previous call's positions, the jump
run-up to `tileStartPos`, `ApplyNaiveDirectionalMovement` (and its xI halving), jumping when blocked or past
0.75 × agentSize, skipping ahead to a node it stands on, letting go of every key at 0.6–0.7 s stuck and dropping the
path after 1 s, and jitter prevention in the air. `FollowPath` in `RunQueue`: repath while the path is gone, give up
after more than 5 repaths. `GetPath` assigns the field, not the property, and is only called with no path, so
`MergePaths` never merges. Values from the prefabs' PathAgent: ZMook/ZMookBazooka jumpHeight 3, maxDropDistance 4;
ZMookSuicide 4/5; ZMookScout 4/3; agentSize 9. Ladders, roof climbing and flying are left out (no such content).

ScoutMook / ScoutAI (ZMookScout: speed 80, jump 160, runSpeed 100, hearing 350 × 150, cannot hide; sightDelay 0.2,
idle waits 0.3–0.6): its own idle think (looks only when 8 inside the screen); `FullyAlert` remembers the player's
cell, runs at runSpeed for the nearest `ScoutMookInterestPoint` (each mook door is one) or 32 columns away from the
noise, then `UseSpecial2` and twelve paces either side of it; while alerted, every 0.7–1.5 s it waves (`FireWeapon`
sets waveTime 0.4, no bullet; frames 21–24 of row 0) with the `ramboBubble` up (an American flag, a still
ReactionBubble that tweens in and out), and shouts `Map.AlertNearbyMooks(64, 40)` while running; at the door
(within 32) it calls `MookDoor.AlarmMooks(startPoint)`. Its greeting restarts the flag bubble instead of "!"
(`RestartExclamationBubble_Networked`), it ignores noises once alerted, and it wears `disarmedMaterial` unless idle
or suspicious. `ForgetPlayer` clears its door and start point.

MookDoor (DoodadMookDoor): every `spawningRate` × (0.9–1.1) s a mook walks out while the door is on screen and fewer
than `maxMookCount` (3) of its mooks live (`RegisterOriginDoor`: a tile to one side, behind the frame, walking to the
door's x, invulnerable 0.6 s; `Mook.Death` counts it out); after an alarm the next `maxAlarmedMooksCount` (5) come
out every 0.3–0.8 s, on screen or not, each following the door's path to the scout's start point. One in three is a
suicide mook. The door is not damageable (`isDamageable` 0): it collapses with the block under it
(`Doodad.AttachDownwards`, 48 down; `Block.Collapse` collapses attached doodads), then for 1.5–3 s lets out up to
`maxMooksOnCollapse` (8) mooks on fire, four times as fast, before `DestroyDoor` swaps in the destroyed materials and
throws 40 sparks (`SparkShrapnel` via `CreateShrapnel`), six delayed smoke puffs, six delayed flames and four
delayed shader explosions (drawn with the explosion strips). Burning (`Mook.Damage` with Fire, `RunBurning`,
`StopBurning`): the damage is saved in `burnDamage`, the mook panics with burnTime 1, which runs down twice as fast
while it lives, throwing a FlickerFader flame every 0.13 s; when it goes out the saved damage kills it, ignoring
invulnerability (`Map.KnockAndDamageUnit` doesn't check it). Extracted: the door frame and inside with their
destroyed materials, Smoke1/Smoke2, SparkShrapnel, Flame1–3 (each FlickerFader's textures packed into a strip),
`ScoutMook.disarmedMaterial` and the scout's `ramboBubble`. Level 1 places a scout past the brick tower (column 99)
and a door between the last prisoner and the flag (column 108); the placement is our design.

## Shader explosions, plumes, fire and the flex (fourth pass)

Every explosion in Broforce is `EffectsController.CreateShaderExplosion`: a ParticleSystem prefab (Tiny, Small,
Medium = `Explosion`, Large) whose children (fireball, shockwave, outline, streaks, detail, smoke) all draw with
the `Unlit/PixelExplosion` shader. `extractor/extractor/particles.py` writes each prefab's systems to
`shuriken.json` (main, InitialModule, Shape, Emission with bursts, Size/Rotation/Velocity/Force/ClampVelocity over
lifetime, Birth sub-emitters, CustomData curves, renderer streams and material) and the textures it uses, packed
RGB | alpha into opaque PNGs so a canvas returns their bytes exactly. The shader exists in the build as a single
DXBC variant (the materials' COLOURADD/PARTICLE keywords were stripped), disassembled with Windows'
`d3dcompiler_47.dll` (`D3DDisassemble`). With the renderer's vertex streams `[Position, Custom1XYZW, UV, SizeXY,
Rotation, Custom2XYZ]` it reads: each fragment samples the particle texture at the corner of its world pixel
(`_WorldToPixel` 1); `shape = sat(sat(R * c1.x + A) - G * c1.y)`, discarded when `shape * (5 * c2.x * noise + 1) - 1 +
0.99 * c1.w < 0`, where noise is the texture's blue channel at `floor(world) * c2.z * 0.01 + (0, c2.y * _Time.y)`;
the heat `sat((c2.x * noise + 1) * (R * c1.x + c1.z - G * c1.y))` picks a colour from the `_Ramp` (fireRamp, smokeRamp,
flashRamp), brightened by `1 + rampAlpha * (_Brightness - 1)`; opaque. `render/fx/shuriken.ts` simulates the systems
(Hermite AnimationCurves, the four MinMaxCurve modes, Sphere/Cone/Circle shapes with BurstSpread arcs, rate over
time and distance, bursts, force, the speed limit with its dampen taken per frame at 30 fps, Birth sub-emitters that
inherit their parent particle's size, depth then sort-mode ordering) and `render/fx/pixelShader.ts` shades each
particle into a buffer of world pixels drawn over the scene. A sub-emitter's own Emission module is switched off
in the prefabs; its bursts are used anyway, as the smoke shows they must be.

Call sites, each from its MakeEffects: Rocket (`ExplosionRangePop` at range x 3, sparks, one Medium), the airstrike's
RocketBombardment (the same, plus three plumes, and `Map.HitUnits(1, Fire, range x 1.2)`, an overload with no team
check, so it sets fire to the mooks around and singes corpses), BarrelBlock (`fullExplosion`: range pop, sparks, three
plumes at 315, two Medium and a Large), MookSuicide (range pop, 40 pieces of `SparkShrapnel Fire1`, four Smoke1/2
puffs, three explosions of its `explosionSize` Small, Flame1-3, and `Map.BurnUnitsAround(5, 1, range + 30)`:
`Mook.BurnInternal` makes the mooks around panic with a point of burn damage; a hero's BurnInternal is empty),
GrenadeAirstrike (calling the strike in: SparkShrapnel and six puffs) and the mook door's final blast (two Medium,
two Large). Plumes are `CreateShrapnelCircle(plumeShrapnelPrefab)`: 1-pixel sparks (lifeM 0.14, gravity 1.6, dead
on their first bounce) each dragging a world-space `FireTrailSmall` that emits 0.17 particles per unit moved and is
let go when its plume dies. `ExplosionRangePop` is a white ring, one 128-unit column per 8 units of range over 24,
shown for about two frames behind the blocks (z 12). Our football's blast uses a Small explosion (our choice). The
old `ExplosionBallFlame` strips are no longer extracted.

The flex: the gesture button (F/L) plays the bro's own row 11 (`AnimateGesture`, Flex: 24 frames at 0.0667 s, frames
7, 12 and 19 held 0.24 s, held on frame 23), with `TriggerFlexEvent` on frames 8 and 18; pressing it again restarts
from frame 20 on, and since `blockMovementForGesture` stays set the pose holds until a direction is pressed.
`FlexPowerMapType.SpawnWithAllure` on level 1 gives the Alluring flex: each flex event calls
`Map.AttractMooks(X, Y, 96, 30)`, so the mooks around come over for a look (`DoAttractedThink`). Blindness keeps no
trigger: in the original it comes from flashbangs, stun damage and other bros' weapons, none of them Brolusconi's.
