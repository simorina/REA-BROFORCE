# Broforce: Putin, the second bro — design spec

Date: 2026-10-15
Status: design approved in chat; this document records it.

## Goal

Add a second playable parody bro, **Vladimir Putin**, next to Silvio
Brolusconi. He is a shirtless judoka built on BroLee's sheet and prefab, with a
judo throw as his weapon and an exploding matryoshka as his special. The player
picks the starting bro in the menu, and every rescued prisoner swaps to the
other bro, as in Broforce.

Success: from the menu the user picks either bro and plays level 1. Freeing a
prisoner switches bro mid-level. Putin's judo throw and matryoshka work and
feel like Broforce, and Brolusconi plays exactly as before.

## Non-goals

- More than two bros, unlocks, or a random bro on respawn.
- BroLee's other moves (upward and downward strikes, air dash, his special).
- A real judo grab animation: the throw reuses BroLee's forward strike frames.
- Audio recordings of the real person (same rule as Brolusconi).

## Asset boundary

Unchanged from the Brolusconi spec. BroLee's sheet is read from the local
install and only its repaint, `sprites/putin.png`, is written to `game-data/`
(gitignored). The repo gets the repaint recipe, not pixels. Putin is a parody in
the spirit of Broforce's own. His line is shown in a speech bubble and,
optionally, spoken by the browser's generic Russian voice.

## Bro definitions

`BroDef` gains two fields, and every bro file sets them:

- `base`: the prefab whose unit values the bro uses (`bro_base` for
  Brolusconi, i.e. Double Bro Seven; `bro_lee` for Putin).
- `voiceLang`: BCP 47 tag for the speech synthesis (`it-IT`, `ru-RU`).

`web/src/bros/putin.json`:

```json
{
  "id": "putin",
  "name": "Vladimir Putin",
  "sheet": "putin",
  "base": "bro_lee",
  "weapon": "judo",
  "special": "matryoshka",
  "voiceLine": "Если драка неизбежна, бей первым!",
  "voiceLang": "ru-RU"
}
```

The line is his own 2015 remark about his Leningrad childhood ("If a fight is
inevitable, strike first"). `bros/index.ts` exports `BROS = [BROLUSCONI, PUTIN]`.
`WEAPONS` becomes `['football', 'judo']`, and `SPECIALS` becomes
`['airstrike', 'matryoshka']`.

## Extractor

- `catalog.py`: add `ValuesRef("bro_lee", "BroLee", "BroLee", UNIT_FIELDS)`.
  The measured prefab values are speed 120, jump 260, health 1, fireRate 0.2 s,
  originalSpecialAmmo 2, wall climb, dash and offset 15. BroLee's body sheet is
  read as a repaint source. Every bro sheet shares the 1024×512 grid of 32×32
  frames; this was checked on 22 bro prefabs.
- `repaint.py` becomes a list of recipes, `(output key, source sheet, palette,
  hair mask)`:
  - `brolusconi`: Double Bro Seven with today's `PALETTE_MAP`. The output stays
    byte-identical.
  - `putin`: BroLee. His 13-colour palette was measured: skin `#EEB891`,
    `#D7A17F`, `#C3866D`, `#AA735D`, `#AA7C5D` → pale pink; hair `#161616` →
    light ash-brown; trousers `#161616` → olive camo green. Outline, whites and
    the reds are kept.
- **Hair mask.** Hair and trousers share `#161616`, so a colour map can't split
  them. In each 32×32 frame the 8-connected `#161616` components are labelled:
  the one whose top edge is highest becomes hair, and the rest become trousers.
  Where this misfires (lying, rolling, upside-down poses), the recipe lists
  per-frame overrides `(col, row) → all hair | all trousers`, found by looking
  at the whole output sheet.
- Output: `sprites/putin.png`, plus a `putin` entry in `sheets.json` that copies
  BroLee's frame grid.

## Engine

### Roster and the bro swap

- `createWorld(level, stats, roster, startIndex)`. `World` holds `roster` and
  the current `bro`.
- Unit stats come from `stats.units[bro.base]`. `parseValues` reads both
  `bro_base` and `bro_lee`, and the bro-only flags (no grass hiding, no fire
  panic) apply to both.
- **Rescue** (`RescueBro.Free`): +1 life, as now, then a swap to the next bro
  in the roster. The player unit keeps its position, velocity, facing and rescue
  invulnerability, and takes the new bro's stats. `specialAmmo` resets to the new
  bro's `originalSpecialAmmo`, as for a freshly arrived bro. A judo attack in
  progress is cancelled. Projectiles already in flight are kept.
- **Respawn after death** keeps the current bro. (Broforce gives a random bro;
  this simplification goes in `docs/findings.md`.)

### Kit handlers (`engine/kits.ts`)

`WEAPON_SPAWN`/`SPECIAL_SPAWN` in `world.ts` become handlers:
`fireWeapon[weapon](w, player)` and `useSpecial[special](w, player, ducking)`.
`football` and `airstrike` move there unchanged: same projectiles and events,
and their existing tests pass untouched. The special's speech bubble and
`voice` event stay shared for every special.

### Judo (`judo`): ported from `BroLee.StartFiring` / `RunFiring` / `AnimateAttackForwards`

- Pressing fire with no attack running and `fireCooldown <= 0` starts a forward
  attack: `player.attack = { frame: 0, counter: 0, row, grabbed: false }`.
  `row` alternates 0/1 per attack (`attackSpriteRow`). The cooldown is BroLee's
  `fireRate`, 0.2 s.
- Frames advance every 0.045 s, and the attack ends at frame 8 (0.36 s). During
  the attack the bro doesn't run or turn; gravity and collisions still apply.
- **Strike window**, frames 2–5 (`attackForwardsStrikeFrame` = 2): look for the
  first live enemy in BroLee's hit circle, radius 13 centred on (x + facing·7,
  y + 7) (`Map.HitUnits`).
  - **Grab:** the enemy is removed as a walking unit (`kill` event, counts as a
    kill) and becomes a `body` projectile thrown forward in an arc. The
    projectile stores the enemy kind for its sprite.
  - **Whiff:** at the strike frame, damage the block in front of the bro, at
    (x + facing·9, y + 6) (`FireWeaponGround`).
- **Body projectile:** gravity, and it explodes when it hits a block or another
  enemy, or when its fuse runs out. Its blast is the football's (small). A
  thrown suicide mook uses `suicide_blast` (big) instead.

### Matryoshka (`matryoshka`)

- Thrown like the airstrike grenade (`BroBase.UseSpecial`: 200/150, or 30/70
  when ducking). It bounces with the marker's extracted `bounceM`/`frictionM`.
- After `AIRSTRIKE_FUSE` (1 s), or on touching an enemy, it **opens**: two
  shell halves fly off (visual only) and 3 small dolls burst out in a fan.
- Each small doll bounces and explodes on touching an enemy, after a bounce
  limit, or when its fuse runs out. Its blast uses the extracted
  `RocketBombardment` values (`stats.bomb`).
- Ammo: BroLee's `originalSpecialAmmo` (2).

### Design values (not in Broforce)

The body throw velocity and fuse, the doll fan velocities, the small dolls'
fuse and bounce limit go in `constants.ts` with "tuned in playtesting"
comments, like `FOOTBALL`, and in the "Design values" section of
`docs/findings.md`.

## Render

- The renderer reads the player sheet from `w.bro.sheet` every frame, so a swap
  shows at once. `putin` joins `SHEET_KEYS`.
- Judo frames: column 24 + attack frame, on sheet row 7 + `attack.row` (from
  the top). BroLee sets `lowerLeftPixel.y = 32·(8 + attackSpriteRow)`. This is
  checked against the sheet while implementing.
- Body projectile: its sheet's falling-death frame (column 4, row 0), spinning.
- Dolls: our own pixel art drawn on the canvas like the football. The body is
  red with a white face oval, black eyes and a gold trim; the big doll is about
  10×14 px and the small ones about 6×9. When it opens, two half shells fly
  apart and fade. Blasts: the body uses the football's small explosion, and the
  small dolls use the airstrike bomb's effects.
- The speech bubble already uses Consolas, which has Cyrillic glyphs. Checked on
  screen.

## UI, voice and sound

- **Menu:** the title is "BROFORCE" plus the selected bro's name. Two cards
  (portrait + name) are switched with ← → or a click, and Enter starts. The
  last choice is saved in `localStorage` (wrapped in try/catch like the other
  settings). The controls table shows the selected bro's weapon and special,
  from a map keyed by weapon/special id (e.g. judo: "Presa di judo: afferra e
  scaraventa un mook"; matryoshka: "Matrioska esplosiva (con ↓ la lanci
  corta)").
- **HUD:** the portrait follows the current bro (the HUD store carries the
  sheet). The ammo label becomes generic: "Special: n".
- **Voice:** the `voice` event carries the bro's `voiceLang`.
  `speak(text, lang, enabled)` picks a voice whose `lang` starts with the
  language prefix; if there is none, it sets only `utterance.lang` and the
  browser decides.
- **Sound:** one new synthesized effect, a swish for the judo strike. The body
  and matryoshka throws reuse `throw`, and the doll opening reuses `pop`.

## Error handling

- `parseBro` rejects unknown `base`, `weapon` and `special` values and a missing
  `voiceLang`, as it does today for weapon and special.
- An old `game-data/` without `putin`/`bro_lee` shows the existing "Mancano i
  dati del gioco" screen naming what's missing. The extractor has to be re-run.

## Testing

- **Extractor (pytest):**
  - the Putin palette;
  - the hair mask on a synthetic 32×32 frame (two dark blobs, the upper one
    becomes hair);
  - per-frame overrides;
  - the Brolusconi repaint stays identical to today's mapping;
  - the integration test checks for `putin` in `sheets.json` and `bro_lee` in
    `values.json`.
- **Engine (Vitest):**
  - `parseBro` with `base`/`voiceLang`;
  - rescue swaps the bro: stats, full special ammo, same position and velocity;
  - respawn keeps the bro;
  - judo: no grab before frame 2, grab within frames 2–5, radius 13, the
    grabbed mook becomes a `body` that explodes on a block or an enemy, a
    thrown suicide mook gives the big blast, a whiff damages the block in
    front, and the attack ends after 8 frames;
  - matryoshka: the throw matches the marker's, it opens after the fuse or on
    an enemy into 3 small dolls, and each explodes with `stats.bomb`;
  - the existing football and airstrike tests pass unchanged.
- **Render:** the judo attack frame selection.
- **Manual:**
  - re-run the extractor and look at the whole `putin.png` sheet;
  - play in the browser through REA's `capture_browser_scenario`: menu choice,
    judo, matryoshka, swap on rescue, and the Cyrillic bubble.

## Risks

- The hair mask may misfire on some poses. Mitigation: per-frame overrides,
  checked visually.
- No Russian voice on the user's system: the browser may stay silent or read
  the line with another voice. The bubble still shows the line.
- The body throw and the doll numbers need playtesting to feel right.
