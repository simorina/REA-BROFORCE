# Broforce: Brolusconi — design spec

Date: 2026-10-14
Status: design approved in chat; this document records it.

## Goal

A small, polished, playable Broforce remake that runs in the browser (React),
built from reverse engineering the user's own Steam install of Broforce
(Unity 2017.4.7f1, Mono). One custom playable bro: **Silvio Brolusconi**.
Gameplay values come from the decompiled C# and from the original prefabs, and
each one is traceable to its source.

Success: the user opens the app locally, plays one level start to finish as
Brolusconi, and it *feels* like Broforce: movement, one-hit deaths, destructible
terrain, explosions, rescues and the helicopter extraction.

## Non-goals (first version)

- Original bros (Rambro etc.) as playable characters.
- Multiplayer, co-op, level editor, multiple levels, bosses.
- Importing real campaign levels from `levels.assetbundle` (custom binary
  format; a separate RE task for later).
- Publishing online. See the asset boundary below.

## Asset boundary

Sprites, prefab data and decompiled code belong to Free Lives. They are
extracted from the local install into `game-data/` and `decompiled/`, which are
never committed or published (both listed in `.gitignore`). The app loads
`game-data/` at runtime from the local dev server. The repo itself contains
only our code, our level file and the repaint script (no original pixels).

Brolusconi is a parody character in the spirit of Broforce's own parodies.
His voice line is shown as a speech bubble and, optionally, spoken through the
browser's generic Italian speech synthesis. No recordings of the real person
are used.

## Project layout (`Desktop/REA-BROFORCE`)

```
analysis/     REA evidence JSON (done)
decompiled/   dnSpyEx C# output, 1,951 files (done, local only)
docs/         specs, plans, findings.md (value -> source citations)
extractor/    Python 3.12 + UnityPy: extraction + Brolusconi repaint
game-data/    generated output, local only
web/          React 18 + Vite + TypeScript game
```

## Extractor (`extractor/`)

Python, run once (`python -m extractor <BroforceDataDir> <outDir>`). It reads
the install read-only and writes `game-data/`:

- `sprites/*.png` for the units, projectiles, blocks, effects, prisoner cage,
  helicopter and flag sprites used by the game. Each sheet's frame grid
  (frame width/height, rows) is recorded from the prefab's sprite component
  (SpriteSM pixel dimensions), not guessed.
- `units.json` with prefab values per unit (`_jumpForce`, `speed`, `health`,
  `fireRate`, `maxFallSpeed`, `canWallClimb`, `canDash`, `originalSpecialAmmo`,
  `halfWidth`, `headHeight`, …) keyed by prefab name, with source bundle and
  path ID.
- `brolusconi.png`, produced by the repaint step from Double Bro Seven's body
  sheet: a deterministic colour-to-colour remap of the sheet's 29-colour
  palette (tuxedo → navy suit, white shirt kept, red flower → blue tie,
  hair → slicked near-black, skin → tan). It's a script, so colours can be
  tuned and rerun.
- `manifest.json` listing every output with its SHA-256 and source.

The extractor fails loudly if an expected asset is missing. It never writes
inside the Broforce install.

## Game (`web/`)

React for the shell (menu, HUD, pause, win/lose screens); the game itself runs
in a plain TypeScript engine drawing to one `<canvas>`. React never renders
per-frame state; the HUD subscribes to a small throttled store.

Engine modules, each with one job and testable without a browser:

- `loop`: fixed timestep 1/60 s with accumulator (frame time clamped).
- `map`: 16 px tile grid (`Map.TileSize = 16`, `GetCollumn(x) = (x+8)/16`).
  Block types: dirt, brick (destructible, with health), steel
  (indestructible), explosive barrel. Damage and destruction follow `Block`
  and `MapController.DamageGround`; loose blocks don't fall in v1.
- `physics`: unit movement ported from `TestVanDammeAnim`: gravity
  1100 u/s² (`ApplyNormalGravity`), `maxFallSpeed` −400, run `speed`,
  `jumpForce` with grace jump (<0.1 s after landing), wall climb, dash,
  `halfWidth`/`headHeight` collision against the tile grid.
- `units`: player, mooks, prisoners. Health/damage/death per `Unit`/
  `TestVanDammeAnim.Damage`; bros have health 1.
- `weapons`: projectiles, explosions (block damage + unit damage + knockback
  in a radius), the football and the airstrike.
- `ai`: mook behaviour reduced from `EnemyAI`/`PolymorphicAI`: patrol, notice
  the player (line of sight), shoot at `fireRate`; suicide mook runs at the
  player and explodes.
- `render`: sprite-sheet animation, camera following the player (like
  `SortOfFollow`), integer pixel scaling, screen shake on explosions.
- `input`: keyboard (arrows/WASD move, jump, fire, special, dash). Gamepad
  is a later extra.

### Brolusconi (bro definition `web/src/bros/brolusconi.json`)

Bros are data: name, sprite sheet, weapon id, special id, voice line. Every
bro sheet shares TestVanDammeAnim's frame layout and the physics of the
extracted bro prefab, so adding a bro means adding a file and a sheet.

- Stats: Double Bro Seven's prefab values: jump 260, speed 110, health 1,
  wall climb, dash, fireRate 0.27 s (used as the kick interval), special
  ammo 4.
- Weapon, **exploding football** (new mechanic, not from the code): a kicked
  ball on an arc with gravity, bouncing off tiles with restitution and
  exploding on contact with a unit, or after N bounces or a fuse time. The
  explosion reuses the game's explosion damage/terrain logic. Numbers are
  tuned in playtesting and recorded in the bro file.
- Special, **airstrike**: a speech bubble reading
  *"Siete solo dei poveri comunisti!"* (plus optional browser TTS, it-IT,
  toggle in settings), then an airstrike modelled on `GrenadeAirstrike`:
  bombs carpet the ground ahead of him. Ammo = his base prefab's
  `originalSpecialAmmo`.

### Rest of the game

- Enemies: basic mook (`ZMook`: health 3, speed 70, jump 200, fire 0.17 s),
  suicide mook (`MookSuicide`), and bazooka mook (`MookBazooka`, fires
  rockets that use the shared explosion logic).
- Prisoners: caged; freeing one = +1 life (no bro swap, since there is one bro).
- Level: one hand-built level (`web/src/levels/level1.json`, our own tile
  format) using original block sprites: start, terrain with destructible
  sections, enemies, 2–3 prisoners, flag at the end, helicopter extraction = win.
- Lose: lives reach 0.

## Error handling

- `game-data/` missing or incomplete → the app shows a clear screen saying
  how to run the extractor, instead of a broken canvas.
- Extractor: hard failure with the missing asset name; no partial manifest.

## Testing

- Engine unit tests (Vitest): gravity/jump arcs and max fall speed against the
  code's numbers, tile collision, `GetCollumn`/grid conversion, block damage
  and destruction, explosion radius damage, football bounce/fuse,
  airstrike spawn pattern, unit death and lives.
- Extractor tests (pytest) on the parts that don't need the game: repaint
  palette mapping, manifest writing. One integration check runs against the
  real install when it's present.
- Manual playtest in the browser for feel.

## Risks / unknowns

- Sprite frame layout (SpriteSM) must be read from prefabs; if a sheet's
  frame map can't be recovered automatically, map that sheet by hand
  (recorded in the bro or unit file).
- The repaint quality depends on Double Bro Seven's palette separation; the
  fallback is hand-tuned region masks per frame row.
- The ported physics will be simplified (no water, quicksand, ladders,
  ziplines, parachutes); each simplification is listed in `docs/findings.md`.
