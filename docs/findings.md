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
| Tank drop: the five columns around the signal grenade (snapped), lowest pair of equal heights (last wins), falls from screen top + 200 over its middle; ground near the screen top drops it at the left edge | `GrenadeAirstrike.SpawnTank` |
| Tank: speed 60, jump 290, max fall −600, box half-width 15 × 28; treads tick every 0.0334 s and every other pair crushes ahead (units 5 in range 10 at X±8, Y+2; the block ahead 4 at Y+12, 1 at Y+21) | `TankBroTank` prefab, `MookArmouredGuy.Awake`, `TankBroTank.Start`, `AnimateRunning`, `CrushGroundWhileMoving` |
| Turret at 0.0334 s a frame: mortar holds after frames 4 and 5 and fires on 6, a HeavyShell from (X+17, Y+33) at (135, 135); cannon holds 2–5 frames after 3–6 and fires on 7, a RocketMassive from (X+24, Y+22) at 44; a press past the fire frame queues the next; C switches gun over 20 frames | `TankBroTankTurret.FireWeapon`, `Update`, `FireShell`, `FireCannon`, `SwitchGun` |
| Mortar shell: coasts 0.1 s, drags to 0.35 s, then falls under 600 as the drag eases; damage 10, range 36, force 350/300 | `HeavyShell.RunProjectile`, `MakeEffects`, prefab |
| Big rocket: +120 u/s², crushes 3 blocks (15 at X±9) instead of bouncing, damage 15, range 56, life 1 s | `RocketMassive`, prefab |
| Tank damage: past 25 (driven) the death countdown ticks every 0.2667 s after 0.4667, up to 5× faster, gibbing at 45; the gib throws the driver out (yI 180 + 100) and blows (20 damage, 72 × 32, everyone); F climbs out at (X, Y+32) with yI 130 + 100 | `MookArmouredGuy.Damage`, `Update`, `Gib`, `DisChargePilotRPC`, `PressHighFiveMelee`, `TankBroTank.Damage` |
| Rifle: each burst is 3 bullets at 420 from (X+14, Y+8.5) with a vertical jitter of −10…+10, the last two 0.07 s apart; extraFireDelay 0.3 s, then fireRate 0.12; damage 1, life 0.45 | `BroniversalSoldier.UseFire`, `Update`, `FireWeapon`, prefab, "Bullet Rambo" prefab |
| Gun muzzle frames: a shot sets frame 3, counting down every 0.0334 s | `TestVanDammeAnim.RunGun` |
| Jet descent: its last 48 px at 40 u/s; its fire pattern, a pair of shots from (X+32, Y−5) and (X+8, Y−5) at (450, −285) jittered within 12 | `HarrierJet.Start`, `Update` |

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
Tank and jet: the one just left can't be boarded until he stands beside it, clear of its width (climbing out drops him back inside its box; jumping out of a jet in the air lands him under it); the hidden driver has a 0.1 s shield renewed every step, and 0.5 s of invulnerability when the gib throws him clear; the tank faces the way the grenade flew. Our own cannon and mortar sounds. The Russian anthem (National Anthem of Russia (2000), instrumental, one verse, Presidential Orchestra of the Russian Federation, Wikimedia Commons from kremlin.ru) is downloaded by the extractor, pinned by SHA-256, and plays while someone is inside.
Epstein's island (level 1): the Jungle ThemeHolder's sky and hills, jungle earth (DirtBlock5) wearing its grass frame only under open air, beach sand (Desert Earth) and a temple of WallBrick1 repainted white with blue mortar; 300 x 22 tiles, bottomless gaps in the ravine. Jeffrey Epstein, the boss: Double Bro Seven repainted (silver hair, grey sweater), 120 health, speed 60, no mook mind (he never panics, hides or hears noises, and judo can't grab him). Asleep until the bro comes within 176 x 96; then he keeps between 56 and 128 px from him, fires bursts of 3 aimed bullets (0.12 s apart, 260 u/s, within 0.5 rad of level) every 1.6 s, and every 8 s waves in three guards from 32 px above the screen around X + Random.Range(-64, 64), 16 px apart (MookGeneral.UseSpecial), never more than six alive. Under half health: bursts every 1 s, calls every 5 s, a third of the guards suicide mooks. With his Goliath waiting further on he can't die at the temple: at no health he shouts "This isn't over!", runs from the bro for 1.5 s (200 u/s, shots passing through him) and vanishes in smoke; if nobody beat him he vanishes when the Goliath wakes.
Epstein's Goliath (GoliathMech, 300 health from the prefab; its sheet's seven frames turn it from right to left): box 44 x 64 from its feet, wakes with the bro within 240 x 160 ("This time you're finished!"), keeps within 512 px of where it stood. GoliathMechAI's patterns, in our timing: Bombardment, its two chain guns by turns at the bro for 2 s (every 0.12 s, 0.08 under half health; 300 u/s within 0.6 rad); Stomping, rising 80 px at 200 u/s, gliding at 180 u/s toward the bro by at most 8 columns (16 under half health, as GoliathMechAI) and slamming down at 520 u/s with a shockwave of 20 within 80 px; FrontAssault, a volley of four missiles 0.3 s apart at the bro (160 u/s); and under half health its RocketBombardment, four rockets falling at -300 from above the screen over 15 columns around the bro. Its order: bombard, stomp, missiles, stomp, with 1.2 s pauses; under half health stomp, bombard, stomp, rocket rain, with 0.7 s pauses and the chain guns firing while it glides. Only the bro's shots and blasts hurt it. At no health it comes apart in blasts of the bro's for 1.6 s, then goes up with Epstein inside; only then the flag at the end of the pad works.
Jet (the Harrier, which Broforce never lets a player fly): it appears 32 px above the screen over the grenade and comes down at 160 u/s until its last 48 px (every later descent, empty or dry, is at the Harrier's 40); box half-width 24 × 34 (its landing gear and fuselage: the sprite stands on its wheels, the frame's lowest pixels 8 px up its 64, not on the Harrier's mid-air pivot); piloted it flies at up to 110 across and 80 up, reached at 400 u/s², with no gravity, below the map's top row; X fires the Harrier's pair as RocketBombardment rockets (the user asked for rockets) every 0.4 s instead of its heavy bullets every 0.133 s; C drops a bomb from (X, Y−4) at (xI, −50) under gravity with the same blast, 0.5 s apart; F drops him out under it (beside it on the ground); 20 s of fuel spent only in the air, after which it lands, puts him out and, empty, rises away at 80 u/s. Damage, countdown and gib as the tank's. Repainted with a tone (greys to dark slate, the cockpit glass kept) since its art is painted, not palettized. While he flies, the user's own sound plays from game-data/audio/trump_custom.mp3 (never committed); without it, the US anthem (The Star-Spangled Banner, instrumental, United States Navy Band, Wikimedia Commons, public domain), downloaded by the extractor and pinned by SHA-256.
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
`Demonstration.projectilesHitWalls` says. A respawn brings in another bro, as Broforce does: ours is picked at random from the roster, never the one who just died, and comes with his own full specials. The tank has no boost dash, hatch, flag or driver's head; there is no landing crush (its −600 fall cap never reaches FallDamage's −2000); an empty tank gibs past 60 damage instead of staying a husk; only enemy and neutral blasts hurt tanks.

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

## The campaign and three more enemies (fifth pass)

Three missions on a world map: the desert (the first level, on sand), the burning jungle (new, 220 columns) and
Epstein's island. The map is our own 2D art, not Broforce's globe; Broforce's helicopter flies from the mission done to
the next, on `Helicopter.StartIdleAnim`'s idle frame (0 facing right, 4 facing left: the AnimatedTexture is off while
it hovers, frames 1-3 and 5-7 are only its turn). The extraction helicopter in the levels now hovers on frame 0 too;
it used to cycle through the turn and the sheet's empty frames. Progress is saved in localStorage; a loss retries the
mission.

`MookRiotShield`: the shield is his gun sprite (`mook_shield_anim`). `Damage` lets a hit through from behind
(`direction == sign(localScale.x)`) and stops one at his face with `Knock(xI * 0.05, 15)`; an explosion, melee or
more than 35 of `shieldDamage` disarms him (`DisarmShield`: the shield flies off as shrapnel). `FireWeapon` is
empty: he never shoots. `MookGrenadier` (15 health) runs `MookBazookaAi` and lobs `GrenadeEvilSmall Long fuse`
(bounceM 0.4, frictionM 0.44, gravityM 0.75, damage 10, range 42) from (X + dir 8, Y + 24) at (dir 130, 130),
and `DropDeathGrenade` leaves one where he dies. `MookDog` (1 health) runs `DogAI` like a suicide mook, at
`awareRunSpeed` 140 once alerted, and bites with `HitLivingUnits(3, Melee, 6, X, Y + 4)`. Design values: the
throw's speed scales with the distance (0.5x to 1.5x at 160 units), a 1.5 s pause after a throw, a 2.5 s fuse and
0.5 s between bites. Left out: the shield mook panicking or dropping his shield on fire.

The burning jungle's ThemeHolder art is the jungle's blue; its look is `ColorShiftController` on the
BackgroundCamera, which grades the background with an Amplify Color LUT per theme and weather
(`colorMapBurningJungleDay` = `Preset_Burning_Jungle`; the jungle's is `Preset_Blank`, the desert has none). The
extractor bakes that LUT into the burning background's sprites (32 slices of 32x32, blue across slices, red across,
green up), so the sky comes out smoky while the level itself keeps its colours, as in the game.

## Broforce's globe for the world map (sixth pass)

The campaign map is now Broforce's `WorldMap3D` scene drawn with three.js; the 2D map stays as the fallback when WebGL
or `game-data/worldmap` is missing. The extractor bakes the scene's meshes into world space (z flipped for three.js,
winding reversed) and merges them by material, about 261k vertices with the one lightmap (RGBM: rgb x a x 5). The
shaders are ported from their DXBC: `Custom/Fake3D` tints by `lerp(_Shadow, _Color, N.L)`, adds a
`(1 - N.V)^_FresPow x _FresCol` rim and multiplies by the lightmap; `Fake3DTree` sways and leans away from
`_HelicopterPos`; `PixelWater` scrolls two normal maps and sparkles where its reflection crosses `_Cutoff` (the
cubemap is approximated by the sun); `MapBorder` scrolls its dashes. The main camera carries two quads: `backGlow`
(`Custom/backgroundTransparent`: BlueGlow x (0.058, 0.163, 0.353, 0.443), in the background queue, behind the globe)
and `Blue Glow` (`Particles/Additive`: worldGlow x 2 x `_TintColor`, 10.74 ahead, round the rim).

`WorldCamera.FollowClampedTransform` keeps the camera 16.68 out over the helicopter, looking at the centre, its
latitude halved as the view widens (`GetHelicopterPosition`); `RunZoom` moves the field of view between 30 and 18
(`SmoothZoom`: by the sine of the zoom), in while the helicopter waits and out once it is 5 units off. `Helicopter3D`
flies 5.9 from the centre at 25 degrees a second; ours flies itself to the chosen mission along the great circle. Its
nose turns after its way (`RotateTowards` at 2 + 6 |bank| + 6 trick radians a second), it rolls 40 degrees into a
turn (`bankingSideSpeed` 5) and dips 16 while it flies (`DoBanking`); to land it drops to the territory's
`LandingPoint` (plus `LandingOffset` 0.15) over two seconds, and `TransportArriveAt` comes after three.

`WorldTerritory3D`: its dashed border (`Outline`) shows only while it is selected, with the helicopter over it. Its
`WMIcon` (a 16-pixel red disc with the terror level; ours shows the mission's number) is drawn by the UI camera
(orthographic size 48, the icon 8 units) over `centreObject`; it pops up on a spring, bounces when the territory is
selected, and gives way to `WorldmapArrow` at the rim once `dot(camera, centre)` drops under 0.3, pointing back at
the globe from 1.3 to 3.2 half-heights out as the view zooms. A liberated territory raises the US flag on its
`WorldMapFlagPole`. Selecting a territory on the 3D map shows `GeneralUI`: the general's head, the description and
"THREAT LEVEL:" with a colour's name (Salmon, Burgundy, Infinite...); ours keeps the briefing under the map with a
threat level that climbs from Giallo to Infinito. The panel that slides up from the bottom
(`WorldMapInterfaceTerritoryDetails`, "GOD SPEED BROFORCE!") belongs to the old 2D map (`Helicopter2D`); ours borrows
its farewell for the landing. Left out: flying freely with the arrows, the territories' states (burning, infested,
terror spreading), the general, the birds and seagulls and the map's mooks.
