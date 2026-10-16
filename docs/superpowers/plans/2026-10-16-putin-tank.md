# Broforce: Putin's tank — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Putin's matryoshka with Broforce's drivable tank (TankBroTank). The signal grenade drops it from
the sky; Putin boards it, drives, fires the mortar and the cannon, climbs out, and it blows up past its damage limit.
The Russian anthem plays while anyone is inside.

**Architecture:**
- **Extractor:** the tank's sheets get two repaint recipes, a palette plus a flag "decal" rectangle. It also extracts
  the tank, turret and projectile values, and gains a separate, network-tolerant step that downloads the anthem.
- **Engine:** `engine/tank.ts` holds the pure tank: its state, the drop-spot search, body physics, the turret state
  machine and the damage model. `engine/driving.ts` holds the world glue: calling the tank in, boarding, the driver's
  controls, crush, the turret's shots and the gib.
- **Projectiles:** the mortar shell (`shell`) and the big rocket (`bigRocket`).
- **UI:** the renderer draws hull and turret. A `Music` player fades the anthem with `anthemShouldPlay`.

**Tech Stack:** Python 3.12, UnityPy, Pillow, pytest · TypeScript 5.7 (`strict`, `noUnusedLocals`), React 18.3, Vite 6, Vitest 2.1.

**Spec:** `docs/superpowers/specs/2026-10-16-putin-tank-design.md`

## Global Constraints

- **Project root:** `C:\Users\rinal\Desktop\REA-BROFORCE` (Git Bash `/c/Users/rinal/Desktop/REA-BROFORCE`). The
  Broforce data dir `C:/Program Files (x86)/Steam/steamapps/common/Broforce/Broforce_beta_Data` is read only.
- **Asset boundary:** `decompiled/`, `game-data/` and `analysis/` are never committed. The anthem goes only to
  `game-data/audio/anthem_ru.ogg`.
- **Units:** pixels, y up, tile 16, fixed step 1/60 s.
- **Sources:** every value ported from the game cites its class/method in a comment. Design values go under
  "Design values" in `constants.ts` and in `docs/findings.md`.
- **Engine:** no DOM. UI copy is Italian.
- **Brolusconi is unchanged.** Putin's judo is unchanged.
- **Anthem:**
  - URL `https://upload.wikimedia.org/wikipedia/commons/4/41/National_Anthem_of_Russia_%282000%29%2C_instrumental%2C_one_verse.ogg`;
  - SHA-256 `b4a7eb9957c20053f0ce8db4f7a7bbfeeebfcf233d4cfc6632601c9ed518bd99`, 3,537,105 bytes;
  - credit "Inno russo: Orchestra presidenziale della Federazione Russa (kremlin.ru, via Wikimedia Commons)".
- **No network in tests.**
- **Gate after every task:** `cd web && npx vitest run && npx tsc --noEmit` is green, plus
  `cd extractor && .venv/Scripts/python -m pytest -q` when the extractor changed.
- **Baseline:** 242 web tests, 21 extractor tests.
- **Commits:** local only; every message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- **Climbing out next to the tank:** he must not be sucked straight back in. He pops up and falls back inside its box,
  and only stepping clear on foot re-arms boarding. Test: Task 4 `after climbing out he stays out until he has stood
  clear of the tank`.
- **The driver can't be killed inside:** enemy bullets and blasts hit the tank instead. Test: Task 6 `enemy bullets hit
  the tank, not the hidden driver`.
- **A tank that falls off the map or into a pit:** it throws the driver out and disappears; nothing keeps tracking a
  dead tank. Test: Task 6 `a tank that falls off the map lets the driver out and is gone`.
- **Pausing, sound off, or a missing anthem file:** the anthem goes silent, never throws, and doesn't start without a
  driver. Tests: Task 8 `anthemShouldPlay` table, `a failed play stays silent`.
- **Reaching the flag or freeing a prisoner while driving:** the level ends with the bro out of the tank, and a rescue
  keeps the new bro driving. Tests: Task 4 `reaching the flag while driving climbs out and extracts`, `a rescue while
  driving keeps the new bro inside`.

---

### Task 1: Extractor — tank sheets, repaints and values

**Files:**
- Modify: `extractor/extractor/repaint.py` (add `Decal`, `OLIVE`, `HULL_MAP`, `TURRET_MAP`, `RU_FLAG`, recipe field `decal`, `repaint(..., decal)`)
- Modify: `extractor/extractor/catalog.py` (4 `SpriteRef`, 4 `ValuesRef`)
- Modify: `extractor/extractor/__main__.py` (pass `recipe.decal`)
- Test: `extractor/tests/test_repaint.py`, `extractor/tests/test_catalog.py`, `extractor/tests/test_integration.py`

**Interfaces:**
- Produces: `sheets.json` keys `tank_ru`, `turret_ru` (48×48), `tank_shell` (32×32), `tank_rocket` (32×16); `values.json` keys `tank` (`speed`, `_jumpForce`, `maxFallSpeed`, `maxDamageBeforeExploding`, `deathCountdownExplodeThreshold`), `tank_turret` (`cannonFireSpeed`), `tank_shell` (`damage`, `range`, `life`), `tank_rocket` (`damage`, `range`, `blastForce`, `blastForceExtraY`, `life`, `horizontalAcceleration`, `crushWallLayers`). `repaint(img, mapping=PALETTE_MAP, hair=None, decal=None)`.

- [ ] **Step 1: Failing tests**

Append to `extractor/tests/test_repaint.py`, and add `HULL_MAP, RU_FLAG, TURRET_MAP` to the `extractor.repaint` import:

```python
def test_tank_greys_become_olive():
    img = Image.new("RGBA", (2, 1))
    img.putpixel((0, 0), (0x67, 0x68, 0x5F, 255))
    img.putpixel((1, 0), (0x3B, 0x3B, 0x3B, 255))
    assert repaint(img, TURRET_MAP).getpixel((0, 0)) == (0x6B, 0x75, 0x47, 255)
    assert repaint(img, HULL_MAP).getpixel((1, 0)) == (0x3C, 0x44, 0x28, 255)


def test_the_turret_flag_becomes_the_russian_tricolour_in_every_frame():
    blue, red, white = (0x49, 0x78, 0xB9, 255), (0x8F, 0x32, 0x32, 255), (0xB8, 0xB3, 0xAF, 255)
    img = Image.new("RGBA", (96, 48))
    for fx in (0, 48):
        for y in range(22, 27):
            for x in range(17, 23):
                img.putpixel((fx + x, y), (blue, red, white)[(x + y) % 3])
    img.putpixel((5, 5), blue)  # the same blue outside the flag stays
    out = repaint(img, TURRET_MAP, decal=RU_FLAG)
    for fx in (0, 48):
        assert [out.getpixel((fx + 18, y))[:3] for y in range(22, 27)] == list(RU_FLAG.stripes)
    assert out.getpixel((5, 5)) == blue


def test_tank_recipes():
    assert [(r.key, r.source) for r in RECIPES][2:] == [("tank_ru", "tank_hull"), ("turret_ru", "tank_turret")]
```

Change `test_recipes_repaint_extracted_sheets_into_new_keys`'s last assert to compare only the first two
recipes: `[(r.key, r.source) for r in RECIPES][:2]`.

- [ ] **Step 2: Run, see them fail**

Run: `cd extractor && .venv/Scripts/python -m pytest -q tests/test_repaint.py`
Expected: collection error, `cannot import name 'HULL_MAP'`.

- [ ] **Step 3: Implement the recipes in `repaint.py`**

After `PUTIN_HAIR`, add:

```python
# TankBroTank: the grey hull and turret plates -> military olive
OLIVE: dict[RGB, RGB] = {
    (0x80, 0x81, 0x78): (0x8A, 0x94, 0x60),
    (0x67, 0x68, 0x5F): (0x6B, 0x75, 0x47),
    (0x4F, 0x4F, 0x47): (0x53, 0x5C, 0x37),
    (0x42, 0x42, 0x3B): (0x44, 0x4C, 0x2C),
    (0x31, 0x31, 0x2C): (0x34, 0x3A, 0x22),
}
HULL_MAP: dict[RGB, RGB] = {
    **OLIVE,
    (0x3B, 0x3B, 0x3B): (0x3C, 0x44, 0x28),
    (0x36, 0x35, 0x35): (0x37, 0x3E, 0x26),
    (0x3D, 0x3D, 0x3D): (0x3E, 0x46, 0x29),
}
TURRET_MAP: dict[RGB, RGB] = dict(OLIVE)


@dataclass(frozen=True)
class Decal:
    """Repaints a fixed rectangle of every frame (the turret's flag) as horizontal stripes, one colour per row.
    Only pixels of the `sources` colours change, so the outline around the flag is kept."""
    x: int
    y: int
    w: int
    h: int
    sources: frozenset
    stripes: tuple
    frame: int = 48


# The turret's US flag (6x5 at 17,22 in every 48x48 frame: blue canton, red and white stripes) -> white-blue-red
RU_FLAG = Decal(
    x=17, y=22, w=6, h=5,
    sources=frozenset({(0x49, 0x78, 0xB9), (0x8F, 0x32, 0x32), (0xB8, 0xB3, 0xAF)}),
    stripes=((0xEE, 0xEE, 0xEE), (0xEE, 0xEE, 0xEE), (0x1F, 0x4F, 0xB0), (0xC8, 0x22, 0x1F), (0xC8, 0x22, 0x1F)),
)
```

Give `Recipe` a fourth field `decal: Decal | None = None`, and extend `RECIPES`:

```python
RECIPES = (
    Recipe("brolusconi", "bro_base", PALETTE_MAP),
    Recipe("putin", "bro_lee", PUTIN_MAP, PUTIN_HAIR),
    Recipe("tank_ru", "tank_hull", HULL_MAP),
    Recipe("turret_ru", "tank_turret", TURRET_MAP, decal=RU_FLAG),
)
```

Change `repaint`'s signature to `def repaint(img, mapping: dict = PALETTE_MAP, hair: HairMask | None = None, decal: Decal | None = None)`
and, after its pixel loop and before `return out`, add:

```python
    if decal:
        src = img.convert("RGBA").load()
        for fy in range(0, height - decal.h + 1, decal.frame):
            for fx in range(0, width - decal.w + 1, decal.frame):
                for dy in range(decal.h):
                    for dx in range(decal.w):
                        x, y = fx + decal.x + dx, fy + decal.y + dy
                        if x >= width or y >= height:
                            continue
                        r, g, b, a = src[x, y]
                        if a and (r, g, b) in decal.sources:
                            px[x, y] = (*decal.stripes[dy], a)
```

In `__main__.py`, `repaint(image, recipe.palette, recipe.hair)` becomes `repaint(image, recipe.palette, recipe.hair, recipe.decal)`.

- [ ] **Step 4: Catalog**

In `catalog.py`, add to `SPRITES` after the `bro_lee` line:

```python
    SpriteRef("tank_hull", "TankBroTank", "TankBrosTank", True),
    SpriteRef("tank_turret", "TankBroTankTurret", "Turret", True),
    SpriteRef("tank_shell", "HeavyShell", "Shell Heavy Tankbro", True),
    SpriteRef("tank_rocket", "RocketMassive", "Rocket Tankbro BIG", True),
```

and to `VALUES` after the `bro_lee` line:

```python
    ValuesRef("tank", "TankBroTank", "TankBrosTank",
              ("speed", "_jumpForce", "maxFallSpeed", "maxDamageBeforeExploding", "deathCountdownExplodeThreshold")),
    ValuesRef("tank_turret", "TankBroTankTurret", "Turret", ("cannonFireSpeed",)),
    ValuesRef("tank_shell", "HeavyShell", "Shell Heavy Tankbro", ("damage", "range", "life")),
    ValuesRef("tank_rocket", "RocketMassive", "Rocket Tankbro BIG",
              ("damage", "range", "blastForce", "blastForceExtraY", "life", "horizontalAcceleration", "crushWallLayers")),
```

In `tests/test_catalog.py` add `"tank_hull", "tank_turret", "tank_shell", "tank_rocket"` to `SPRITE_KEYS` and
`"tank", "tank_turret", "tank_shell", "tank_rocket"` to `VALUE_KEYS`.

In `tests/test_integration.py`, after the `putin` assertions, add:

```python
    assert values["tank"]["speed"] == 60.0 and values["tank"]["_jumpForce"] == 290.0
    assert values["tank"]["maxDamageBeforeExploding"] == 25 and values["tank"]["deathCountdownExplodeThreshold"] == 45
    assert values["tank_turret"]["cannonFireSpeed"] == 44.0
    assert values["tank_shell"]["damage"] == 10 and values["tank_shell"]["range"] == 36.0
    assert values["tank_rocket"]["horizontalAcceleration"] == 120.0 and values["tank_rocket"]["crushWallLayers"] == 3
    assert sheets["tank_ru"]["frameW"] == 48 and sheets["turret_ru"]["frameW"] == 48
    assert sheets["tank_shell"]["frameW"] == 32 and sheets["tank_rocket"]["frameH"] == 16
```

- [ ] **Step 5: Run the extractor suite**

Run: `cd extractor && .venv/Scripts/python -m pytest -q`
Expected: PASS (24 tests).

- [ ] **Step 6: Re-extract and look**

Run: `cd extractor && .venv/Scripts/python -m extractor "C:/Program Files (x86)/Steam/steamapps/common/Broforce/Broforce_beta_Data" ../game-data`.
Then open `game-data/sprites/tank_ru.png` and `turret_ru.png` with the Read tool, and a composite of hull frame
(0,0) with turret frames (0,0) and (0,2). Expect olive plates, black treads and a white-blue-red flag. If the flag's
5 rows read badly, change only `RU_FLAG.stripes`, re-run Step 5 and note it in the ledger.

- [ ] **Step 7: Commit**

```bash
git add extractor && git commit -m "extractor: TankBroTank sheets repainted Russian, and the tank's values

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Extractor — the anthem download

**Files:**
- Create: `extractor/extractor/audio.py`, `extractor/tests/test_audio.py`
- Modify: `extractor/extractor/manifest.py` (`write_bytes`), `extractor/extractor/__main__.py` (`run(..., fetch_audio=True)`, `--no-audio`)
- Modify: `extractor/tests/test_integration.py` (`fetch_audio=False`)

**Interfaces:**
- Produces: `game-data/audio/anthem_ru.ogg`; `audio.ANTHEM`, `audio.fetch(ref, out, fetcher=http_get) -> bool`; `OutputWriter.write_bytes(rel, data, source)`.

- [ ] **Step 1: Failing tests** — create `extractor/tests/test_audio.py`:

```python
import hashlib

from extractor.audio import AudioRef, fetch
from extractor.manifest import OutputWriter

DATA = b"OggS fake anthem"
REF = AudioRef(key="audio/test.ogg", url="https://example.invalid/test.ogg",
               sha256=hashlib.sha256(DATA).hexdigest(), source="test")


def test_downloads_once_and_records_the_file(tmp_path):
    out = OutputWriter(str(tmp_path))
    calls = []
    assert fetch(REF, out, lambda url: calls.append(url) or DATA) is True
    assert (tmp_path / "audio" / "test.ogg").read_bytes() == DATA
    assert out.entries["audio/test.ogg"]["sha256"] == REF.sha256
    again = OutputWriter(str(tmp_path))
    assert fetch(REF, again, lambda url: calls.append(url) or DATA) is True
    assert calls == [REF.url]  # the good copy on disk was reused
    assert "audio/test.ogg" in again.entries


def test_a_network_error_warns_and_does_not_fail(tmp_path, capsys):
    def offline(url):
        raise OSError("no network")
    assert fetch(REF, OutputWriter(str(tmp_path)), offline) is False
    assert "warning" in capsys.readouterr().err
    assert not (tmp_path / "audio" / "test.ogg").exists()


def test_a_wrong_hash_is_rejected(tmp_path, capsys):
    assert fetch(REF, OutputWriter(str(tmp_path)), lambda url: b"something else") is False
    assert "hash" in capsys.readouterr().err
    assert not (tmp_path / "audio" / "test.ogg").exists()
```

- [ ] **Step 2: Run, see it fail**

Run: `cd extractor && .venv/Scripts/python -m pytest -q tests/test_audio.py`
Expected: collection error, `No module named 'extractor.audio'`.

- [ ] **Step 3: Implement**

`manifest.py`, in `OutputWriter` after `write_json`:

```python
    def write_bytes(self, rel: str, data: bytes, source: str) -> None:
        self._record(rel, data, source)
```

Create `extractor/extractor/audio.py`:

```python
"""Putin's tank plays the Russian anthem. It isn't in Broforce, so it is downloaded once into game-data/audio/."""
import hashlib
import os
import sys
import urllib.request
from dataclasses import dataclass


@dataclass(frozen=True)
class AudioRef:
    key: str      # output path under game-data/
    url: str
    sha256: str   # pinned: a changed upstream file is refused
    source: str


ANTHEM = AudioRef(
    key="audio/anthem_ru.ogg",
    url=("https://upload.wikimedia.org/wikipedia/commons/4/41/"
         "National_Anthem_of_Russia_%282000%29%2C_instrumental%2C_one_verse.ogg"),
    sha256="b4a7eb9957c20053f0ce8db4f7a7bbfeeebfcf233d4cfc6632601c9ed518bd99",
    source=("National Anthem of Russia (2000), instrumental, one verse, by the Presidential Orchestra of the Russian "
            "Federation; Wikimedia Commons, from kremlin.ru (attribution is the only condition of reuse)"),
)
USER_AGENT = "REA-BROFORCE-extractor/1.0 (personal, non-commercial game remake)"


def http_get(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def fetch(ref: AudioRef, out, fetcher=http_get) -> bool:
    """Puts ref in the output, re-using a good copy already there. False (with a warning) when it can't."""
    path = os.path.join(out.out_dir, ref.key)
    if os.path.isfile(path):
        with open(path, "rb") as fh:
            data = fh.read()
        if hashlib.sha256(data).hexdigest() == ref.sha256:
            out.write_bytes(ref.key, data, ref.source)
            return True
    try:
        data = fetcher(ref.url)
    except Exception as exc:  # offline or an HTTP error: the game runs without it
        print(f"extractor: warning: could not download {ref.key}: {exc}", file=sys.stderr)
        return False
    if hashlib.sha256(data).hexdigest() != ref.sha256:
        print(f"extractor: warning: {ref.key} does not match its pinned hash; skipped", file=sys.stderr)
        return False
    out.write_bytes(ref.key, data, ref.source)
    return True
```

`__main__.py`:
- add `from . import audio, effects` (replacing `from . import effects`);
- `def run(data_dir: str, out_dir: str, fetch_audio: bool = True) -> None:`;
- right after `effects.extract(...)`: `if fetch_audio: audio.fetch(audio.ANTHEM, out)`;
- in `main`: `parser.add_argument("--no-audio", action="store_true", help="skip downloading the anthem")` and
  `run(args.data_dir, args.out_dir, fetch_audio=not args.no_audio)`.

In `tests/test_integration.py`, replace every `run(DATA, str(tmp_path))` with `run(DATA, str(tmp_path), fetch_audio=False)`.

- [ ] **Step 4: Run the suite, then fetch the real file**

Run: `cd extractor && .venv/Scripts/python -m pytest -q`. Expected: PASS (27 tests).
Then run the extractor (Task 1's command). Expected: `extractor: wrote ../game-data`, and `game-data/audio/anthem_ru.ogg`
exists with `sha256sum` `b4a7eb99…bd99`. Running it a second time doesn't download again.

- [ ] **Step 5: Commit**

```bash
git add extractor && git commit -m "extractor: download the Russian anthem once, pinned by hash, tolerant of no network

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Engine — the matryoshka goes, the tank special drops a tank

**Files:**
- Create: `web/src/engine/tank.ts`, `web/src/engine/tank.test.ts`, `web/src/engine/driving.ts`
- Delete: `web/src/render/shells.ts`, `web/src/render/shells.test.ts`
- Modify: `types.ts`, `constants.ts`, `stats.ts`, `testStats.ts`, `bro.ts`, `kits.ts`, `projectiles.ts`, `world.ts`, `bros/putin.json`, `render/renderer.ts`, `app/sfx.ts`, `ui/Menu.tsx`, `docs/findings.md`
- Test: `tank.test.ts`, `world.test.ts`, `projectiles.test.ts`, `bro.test.ts`, `stats.test.ts`, `app/sfx.test.ts`

**Interfaces:**
- Produces:
  - `SPECIALS = ['airstrike', 'tank']`;
  - `GameStats.tank: TankStats { speed, jumpForce, maxFallSpeed, maxDamage, countdownThreshold, cannonFireSpeed }`,
    `GameStats.tankShell: { damage, range, life }`,
    `GameStats.tankRocket: RocketStats & { acceleration, crushLayers }`;
  - `Projectile.call?: 'tank'`, `Projectile.dip?: number`, `Projectile.crush?: number`;
  - `throwTankMarker(id, u, ducking)`; `ProjectileEvent` `{ type: 'callTank'; x; y; dir: 1 | -1 }`;
  - `tank.ts`: `Tank`, `Turret`, `TankDrive`, `NO_DRIVE`, `makeTank(id, x, y, facing)`,
    `tankDrop(map, x, y, screenMaxY, screenMinX): { x, y, fallback }`,
    `stepTankBody(k, drive, map, s, t): number` (crush ticks);
  - `driving.ts`: `callTank(w, x, y, facing)`, `stepTanks(w, t, blasts)`;
  - `World.tanks: Tank[]`, `World.driving: Tank | null`, `World.reboard: Tank | null`.

- [ ] **Step 1: Remove the matryoshka**

Delete, exactly:
- `constants.ts`: the `MATRYOSHKA` line and the comment above it.
- `types.ts`: `| 'doll' | 'dollSmall'` from `ProjectileKind`.
- `projectiles.ts`: `MATRYOSHKA` from the constants import, the `dollOpen` member of `ProjectileEvent`, the functions
  `throwDoll` and `openDoll` with their doc comments, and the `case 'doll'` and `case 'dollSmall'` blocks.
- `kits.ts`: `throwDoll` from the import and the `matryoshka: throwDoll,` entry.
- `world.ts`: `openDoll` from the projectiles import, the `dollOpen` member of `GameEvent` (end the union at the
  `flex` line with `;`), and the `else if (ev.type === 'dollOpen') {…}` branch in `stepProjectiles`.
- `render/renderer.ts`: the `./shells` import, the `shells` field, the `dollOpen` line in `onEvent`, the
  `stepShells` line in `render`, the shells draw loop, the `case 'doll'`/`case 'dollSmall'` blocks and the
  `drawDoll` method with its comment.
- `app/sfx.ts`: `case 'doll':` and the `case 'dollOpen': return 'pop';` lines.
- `ui/Menu.tsx`: the `matryoshka` entry of `SPECIAL_HINT`.
- Files: `git rm web/src/render/shells.ts web/src/render/shells.test.ts`.
- Tests: `projectiles.test.ts`'s `describe("the matryoshka …")` block and `openDoll, … throwDoll` from its import;
  `world.test.ts`'s `describe('the matryoshka in the world')` block; the two `doll`/`dollOpen` lines in `sfx.test.ts`.
- `docs/findings.md`: the "Matryoshka: …" sentence in "Design values".

- [ ] **Step 2: Failing tests**

Create `web/src/engine/tank.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { FIXED_DT } from './constants';
import { TileMap, makeBlock } from './map';
import { NO_DRIVE, makeTank, stepTankBody, tankDrop } from './tank';
import { TEST_STATS } from './testStats';

/** Floor on row 0 (top at y 8); `heights` raises columns to that many extra blocks. */
function ground(cols = 40, heights: Record<number, number> = {}): TileMap {
  const m = new TileMap(cols, 20);
  for (let c = 0; c < cols; c++) for (let r = 0; r <= (heights[c] ?? 0); r++) m.set(c, r, makeBlock('dirt', TEST_STATS));
  return m;
}

describe('tankDrop (GrenadeAirstrike.SpawnTank)', () => {
  it('over flat ground the last equal pair wins: one and a half columns right of the grenade', () => {
    expect(tankDrop(ground(), 160, 20, 200, 0)).toEqual({ x: 160 + 16 + 8, y: 400, fallback: false });
  });

  it('takes the lowest flat pair', () => {
    // columns 8,9 low (top 8); 10 at 24; 11 at 40; 12 at 56: the grenade at column 10
    const map = ground(40, { 10: 1, 11: 2, 12: 3 });
    expect(tankDrop(map, 160, 30, 200, 0).x).toBe(128 + 8);
  });

  it('rolls in from the left edge when the ground is near the top of the screen', () => {
    expect(tankDrop(ground(), 160, 20, 20, -40)).toEqual({ x: -40, y: 68, fallback: true });
  });
});

describe('the tank body', () => {
  it('falls in and lands on the ground, no faster than maxFallSpeed', () => {
    const k = makeTank(1, 160, 200, 1);
    let minYI = 0;
    for (let i = 0; i < 120; i++) {
      stepTankBody(k, NO_DRIVE, ground(), TEST_STATS.tank, FIXED_DT);
      minYI = Math.min(minYI, k.yI);
    }
    expect(k.onGround).toBe(true);
    expect(k.y).toBeCloseTo(8, 3);
    expect(minYI).toBeGreaterThanOrEqual(-600);
  });
});
```

In `world.test.ts` append:

```ts
describe("Putin's tank special (GrenadeAirstrike with callInTank)", () => {
  const TANKER: BroDef = { ...BROLUSCONI, id: 'tanker', base: 'bro_lee', special: 'tank' };

  it('throws the signal grenade; after its fuse a tank falls in from above the screen and lands, no airstrike', () => {
    const w = createWorld(EMPTY, TEST_STATS, [TANKER], () => 0.5);
    const prev = play(w, { special: true }, 1);
    expect(w.specialAmmo).toBe(1);
    expect(w.projectiles.find((p) => p.kind === 'marker')?.call).toBe('tank');
    play(w, {}, 62, prev);
    expect(w.tanks).toHaveLength(1);
    expect(w.tanks[0].y).toBeGreaterThan(200);
    play(w, {}, 120);
    expect(w.tanks[0].onGround).toBe(true);
    expect(w.tanks[0].y).toBeCloseTo(24, 3);
    expect(w.projectiles.filter((p) => p.kind === 'bomb')).toHaveLength(0);
  });
});
```

In `bro.test.ts`, change Putin's expected `special: 'matryoshka'` to `special: 'tank'` and the test name to
`'Putin throws mooks with judo and calls in a tank, in Russian'`, and add to `rejects unknown weapons and specials`:
`expect(() => parseBro({ ...valid, special: 'matryoshka' })).toThrow("unknown special 'matryoshka'");`

In `stats.test.ts`, inside `describe('parseValues')`:

```ts
  it('reads the tank, its turret and its two projectiles', () => {
    const s = parseValues(RAW_VALUES);
    expect(s.tank).toEqual({ speed: 60, jumpForce: 290, maxFallSpeed: -600, maxDamage: 25, countdownThreshold: 45, cannonFireSpeed: 44 });
    expect(s.tankShell).toEqual({ damage: 10, range: 36, life: 6 });
    expect(s.tankRocket).toEqual({ damage: 15, range: 56, blastForce: 16, blastForceExtraY: 220, life: 1, acceleration: 120, crushLayers: 3 });
  });
```

- [ ] **Step 3: Run, see them fail**

Run: `cd web && npx vitest run src/engine`
Expected: FAIL (`./tank` missing, `w.tanks` undefined, `s.tank` undefined, `'tank'` unknown special).

- [ ] **Step 4: Types, constants, stats, test stats**

`types.ts`:
- `ProjectileKind` adds `| 'shell' | 'bigRocket'`;
- in `Projectile`, after `body?`:

```ts
  call?: 'tank'; // a 'marker' that calls in the tank instead of the airstrike (GrenadeAirstrike.callInTank)
  dip?: number; // HeavyShell.dipCounter
  crush?: number; // RocketMassive.crushWallLayers left
```

- after `GrenadeStats`:

```ts
/** TankBroTank and its turret's cannon speed. */
export interface TankStats {
  speed: number;
  jumpForce: number;
  maxFallSpeed: number;
  maxDamage: number; // maxDamageBeforeExploding
  countdownThreshold: number; // deathCountdownExplodeThreshold
  cannonFireSpeed: number; // TankBroTankTurret.cannonFireSpeed
}
```

- in `GameStats` after `marker`:

```ts
  tank: TankStats;
  tankShell: { damage: number; range: number; life: number }; // HeavyShell "Shell Heavy Tankbro"
  tankRocket: RocketStats & { acceleration: number; crushLayers: number }; // RocketMassive "Rocket Tankbro BIG"
```

`constants.ts`, with the ported values (after the `JUDO_*` lines):

```ts
export const TANK_BOX = { halfWidth: 15, height: 28 }; // MookArmouredGuy.Awake: halfWidth 15; TankBroTank.Start: height 28
export const TANK_RUN_FRAME_RATE = 0.0334; // TankBroTank prefab runningFrameRate
export const TANK_DROP_HEIGHT = 200; // GrenadeAirstrike.SpawnTank: screenMaxY + 200
```

`stats.ts`, in `parseValues` after `marker`:

```ts
    tank: {
      speed: num(raw, 'tank', 'speed'),
      jumpForce: num(raw, 'tank', '_jumpForce'),
      maxFallSpeed: num(raw, 'tank', 'maxFallSpeed'),
      maxDamage: num(raw, 'tank', 'maxDamageBeforeExploding'),
      countdownThreshold: num(raw, 'tank', 'deathCountdownExplodeThreshold'),
      cannonFireSpeed: num(raw, 'tank_turret', 'cannonFireSpeed'),
    },
    tankShell: { damage: num(raw, 'tank_shell', 'damage'), range: num(raw, 'tank_shell', 'range'), life: num(raw, 'tank_shell', 'life') },
    tankRocket: {
      ...rocket(raw, 'tank_rocket'),
      acceleration: num(raw, 'tank_rocket', 'horizontalAcceleration'),
      crushLayers: num(raw, 'tank_rocket', 'crushWallLayers'),
    },
```

`testStats.ts`, `RAW_VALUES` after `marker`:

```ts
  tank: { speed: 60, _jumpForce: 290, maxFallSpeed: -600, maxDamageBeforeExploding: 25, deathCountdownExplodeThreshold: 45 },
  tank_turret: { cannonFireSpeed: 44 },
  tank_shell: { damage: 10, range: 36, life: 6 },
  tank_rocket: { damage: 15, range: 56, blastForce: 16, blastForceExtraY: 220, life: 1, horizontalAcceleration: 120, crushWallLayers: 3 },
```

and `TEST_STATS` after `marker`:

```ts
  tank: { speed: 60, jumpForce: 290, maxFallSpeed: -600, maxDamage: 25, countdownThreshold: 45, cannonFireSpeed: 44 },
  tankShell: { damage: 10, range: 36, life: 6 },
  tankRocket: { damage: 15, range: 56, blastForce: 16, blastForceExtraY: 220, life: 1, acceleration: 120, crushLayers: 3 },
```

- [ ] **Step 5: `web/src/engine/tank.ts`**

```ts
import { ACCEL_M, GRAVITY, GROUND_FRICTION_M, HALF_TILE, TANK_BOX, TANK_DROP_HEIGHT, TANK_RUN_FRAME_RATE, TILE } from './constants';
import { cellBottom, cellLeft, getColumn, getRow, type TileMap } from './map';
import type { TankStats } from './types';

/** TankBroTankTurret: which gun (0 mortar, 1 cannon) and where its firing or gun-switch animation is. */
export interface Turret {
  gun: 0 | 1;
  firing: boolean;
  frame: number;
  counter: number;
  queued: boolean; // queuedFire
  switching: boolean; // gunSwitching
  switchFrame: number; // gunSwitchingFrame, 0 (mortar) to 20 (cannon)
}

export interface TankDrive {
  dir: -1 | 0 | 1;
  jump: boolean;
}

export const NO_DRIVE: TankDrive = { dir: 0, jump: false };

/** TankBroTank: a vehicle beside the units. `y` is its feet, like a unit's. */
export interface Tank {
  id: number;
  x: number;
  y: number;
  xI: number;
  yI: number;
  facing: 1 | -1;
  onGround: boolean;
  animTime: number;
  bob: number; // TankBroTank.tankBobFrame
  bobCounter: number;
  driven: boolean;
  drive: TankDrive; // the driver's controls this step
  damage: number; // MookArmouredGuy.shieldDamage + fireAmount
  countdown: number; // deathCountdown ticks, -1 until the death countdown starts
  countdownCounter: number;
  turret: Turret;
  exploded: boolean;
}

export function makeTank(id: number, x: number, y: number, facing: 1 | -1): Tank {
  return {
    id, x, y, xI: 0, yI: 0, facing, onGround: false, animTime: 0, bob: 0, bobCounter: 0, driven: false, drive: NO_DRIVE,
    damage: 0, countdown: -1, countdownCounter: 0,
    turret: { gun: 0, firing: false, frame: 0, counter: 0, queued: false, switching: false, switchFrame: 0 },
    exploded: false,
  };
}

export interface TankDrop {
  x: number;
  y: number;
  fallback: boolean;
}

/** Where a ray cast down from above column c lands: its highest block's top, or 0 (Unity's empty hit point). */
function columnTop(map: TileMap, c: number): number {
  for (let r = map.rows - 1; r >= 0; r--) if (map.get(c, r)) return r * TILE + HALF_TILE;
  return 0;
}

/**
 * GrenadeAirstrike.SpawnTank: probe the five columns around the grenade (snapped to the grid) and take the lowest
 * pair of equal heights; the last pair found wins a tie. The tank falls in from 200 above the screen, over the middle
 * of that pair. With the ground near the top of the screen it drops at the screen's left edge instead.
 */
export function tankDrop(map: TileMap, x: number, y: number, screenMaxY: number, screenMinX: number): TankDrop {
  const snapped = Math.round(x / TILE) * TILE;
  const tops = [-2, -1, 0, 1, 2].map((i) => ({ x: snapped + i * TILE, y: columnTop(map, getColumn(snapped + i * TILE)) }));
  let low = tops[2].y;
  let lowX = snapped;
  for (let j = 0; j < tops.length - 1; j++) {
    if (tops[j].y === tops[j + 1].y && tops[j].y <= low) {
      low = tops[j].y;
      lowX = tops[j].x;
    }
  }
  if (low > screenMaxY - 16) return { x: screenMinX, y: y + 48, fallback: true };
  return { x: lowX + 8, y: screenMaxY + TANK_DROP_HEIGHT, fallback: false };
}

const EPS = 0.001;

function boxHits(map: TileMap, x: number, y: number): boolean {
  return map.boxHitsSolid(x - TANK_BOX.halfWidth, y, x + TANK_BOX.halfWidth, y + TANK_BOX.height);
}

/**
 * One fixed step of the tank's movement: TestVanDammeAnim's run, jump and gravity with the tank's values and box.
 * Returns how many crush ticks the treads made (TankBroTank.AnimateRunning: a running frame every 0.0334 s, and
 * CrushGroundWhileMoving on every other pair of them while a direction is held on the ground).
 */
export function stepTankBody(k: Tank, drive: TankDrive, map: TileMap, s: TankStats, t: number): number {
  k.animTime += t;
  k.onGround = k.yI <= 0 && boxHits(map, k.x, k.y - 0.5);
  if (drive.dir !== 0) {
    k.facing = drive.dir;
    k.xI += drive.dir * s.speed * ACCEL_M * t; // TestVanDammeAnim.AddSpeedLeft/Right
    if (k.xI * drive.dir > s.speed) k.xI = drive.dir * s.speed;
  } else if (k.onGround) {
    k.xI *= 1 - Math.min(1, t * GROUND_FRICTION_M);
  }
  if (drive.jump && k.onGround) {
    k.yI = s.jumpForce;
    k.onGround = false;
  }
  if (k.onGround) {
    if (k.yI < 0) k.yI = 0;
  } else {
    k.yI -= GRAVITY * t;
  }
  if (k.yI < s.maxFallSpeed) k.yI = s.maxFallSpeed;
  const nx = k.x + k.xI * t;
  if (boxHits(map, nx, k.y)) {
    if (k.xI > 0) k.x = cellLeft(getColumn(nx + TANK_BOX.halfWidth)) - TANK_BOX.halfWidth - EPS;
    else if (k.xI < 0) k.x = cellLeft(getColumn(nx - TANK_BOX.halfWidth)) + TILE + TANK_BOX.halfWidth + EPS;
    k.xI = 0;
  } else {
    k.x = nx;
  }
  const ny = k.y + k.yI * t;
  if (boxHits(map, k.x, ny)) {
    if (k.yI <= 0) {
      k.y = cellBottom(getRow(ny)) + TILE;
      k.onGround = true;
    } else {
      k.y = cellBottom(getRow(ny + TANK_BOX.height)) - TANK_BOX.height - EPS;
    }
    k.yI = 0;
  } else {
    k.y = ny;
  }
  let crushes = 0;
  if (k.onGround && drive.dir !== 0) {
    k.bobCounter += t;
    while (k.bobCounter >= TANK_RUN_FRAME_RATE) {
      k.bobCounter -= TANK_RUN_FRAME_RATE;
      k.bob++;
      if (Math.floor(k.bob / 2) % 2 !== 0) crushes++;
    }
  }
  return crushes;
}
```

- [ ] **Step 6: `web/src/engine/driving.ts`** (first version)

```ts
import { screenMaxY, VIEW_W } from './camera';
import type { Blast } from './explosions';
import { NO_DRIVE, makeTank, stepTankBody, tankDrop } from './tank';
import type { World } from './world';

/** GrenadeAirstrike.SpawnTank: the tank falls in over the flattest ground near the grenade, facing the throw. */
export function callTank(w: World, x: number, y: number, facing: 1 | -1): void {
  const d = tankDrop(w.map, x, y, screenMaxY(w.camera), w.camera.x - VIEW_W / 2);
  w.tanks.push(makeTank(w.nextId++, d.x, d.y, d.fallback ? 1 : facing));
}

/** Every tank's step: its body for now (driving, the turret and damage come next). */
export function stepTanks(w: World, t: number, _blasts: Blast[]): void {
  for (const k of w.tanks) {
    if (k.exploded) continue;
    stepTankBody(k, k.driven ? k.drive : NO_DRIVE, w.map, w.stats.tank, t);
  }
  w.tanks = w.tanks.filter((k) => !k.exploded);
}
```

(`_blasts` is used from Task 4 on; the underscore keeps `noUnusedParameters` quiet until then.)

- [ ] **Step 7: The special, the projectile event, the world**

`bro.ts`: `export const SPECIALS = ['airstrike', 'tank'] as const;`. `bros/putin.json`: `"special": "tank"`.

`projectiles.ts`:
- add to `ProjectileEvent`: `| { type: 'callTank'; x: number; y: number; dir: 1 | -1 }`;
- after `throwMarker`:

```ts
/** TankBro's signal grenade: the airstrike grenade with callInTank set (GrenadeAirstrike.Death -> SpawnTank). */
export function throwTankMarker(id: number, u: Unit, ducking: boolean): Projectile {
  const p = throwMarker(id, u, ducking);
  p.call = 'tank';
  return p;
}
```

- in `case 'marker'`, replace `events.push({ type: 'airstrike', x: p.x, y: p.y });` with

```ts
        events.push(p.call === 'tank'
          ? { type: 'callTank', x: p.x, y: p.y, dir: p.xI < 0 ? -1 : 1 }
          : { type: 'airstrike', x: p.x, y: p.y });
```

`kits.ts`: import `throwTankMarker` with `throwMarker`, and `SPECIAL_KITS` gets `tank: throwTankMarker,`.

`world.ts`:
- import `{ callTank, stepTanks } from './driving'` and `type Tank` from `./tank`;
- in `World`, after `doorPoints`:

```ts
  tanks: Tank[]; // TankBroTank vehicles on the map
  driving: Tank | null; // the tank the player is in
  reboard: Tank | null; // the tank just left: no boarding it until he stands clear of it
```

- in `createWorld`'s returned object add `tanks: [], driving: null, reboard: null,`;
- in `stepWorld`, right after `stepPlayer(w, controls, prev, t, blasts);` add `stepTanks(w, t, blasts);`;
- in `stepProjectiles`, before the final `else {` (the airstrike branch):

```ts
      else if (ev.type === 'callTank') {
        w.events.push({ type: 'airstrike', x: ev.x, y: ev.y }); // GrenadeAirstrike.MakeEffects
        callTank(w, ev.x, ev.y, ev.dir);
      }
```

`ui/Menu.tsx`, `SPECIAL_HINT`: `tank: 'Carro armato: lancia il segnale e salici sopra (X spara, C cambia arma, F scendi)',`.

- [ ] **Step 8: Run all web tests and the typecheck**

Run: `cd web && npx vitest run && npx tsc --noEmit`
Expected: PASS (241 tests: 242 − 7 matryoshka/shell tests + 6 new), no type errors.

- [ ] **Step 9: Commit**

```bash
git add -A web/src docs/findings.md && git commit -m "engine: Putin's special calls in a tank instead of the matryoshka

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Driving — board, drive, crush, climb out

**Files:**
- Modify: `web/src/engine/units.ts` (export `inHitBox`, moved from `judo.ts`), `web/src/engine/judo.ts` (import it)
- Modify: `web/src/engine/driving.ts`, `web/src/engine/world.ts` (`stepPlayer`, `GameEvent`), `web/src/engine/constants.ts`
- Test: `web/src/engine/world.test.ts`, `web/src/engine/tank.test.ts`

**Interfaces:**
- Consumes: Task 3's `Tank`, `stepTankBody`, `World.tanks/driving/reboard`.
- Produces: `inHitBox(u, x, y, range)` in `units.ts`; `driving.ts`: `boardTanks(w)`, `exitTank(w, disChargeYI)`, `driveTank(w, controls, prev)`, `stepTanks` (body, crush, driver sync); `GameEvent` `{ type: 'boardTank' | 'exitTank'; x; y }`; constants `TANK_CRUSH`, `TANK_EXIT_YI`, `TANK_EXIT_Y`, `TANK_EXIT_BOOST`, `TANK_DRIVER_SHIELD`.

- [ ] **Step 1: Failing tests**

`tank.test.ts`, inside `describe('the tank body')`:

```ts
  it('drives at up to its speed of 60, faces the way it drives, and jumps at 290', () => {
    const k = makeTank(1, 160, 8, 1);
    let maxSpeed = 0;
    for (let i = 0; i < 60; i++) {
      stepTankBody(k, { dir: -1, jump: false }, ground(), TEST_STATS.tank, FIXED_DT);
      maxSpeed = Math.max(maxSpeed, Math.abs(k.xI));
    }
    expect(k.facing).toBe(-1);
    expect(maxSpeed).toBeCloseTo(60, 5);
    expect(k.x).toBeLessThan(130);
    stepTankBody(k, { dir: 0, jump: true }, ground(), TEST_STATS.tank, FIXED_DT);
    expect(k.yI).toBeGreaterThan(270); // 290 less one step of gravity
  });

  it('crushes on every other pair of running frames while driving on the ground', () => {
    const k = makeTank(1, 160, 8, 1);
    let crushes = 0;
    for (let i = 0; i < 60; i++) crushes += stepTankBody(k, { dir: 1, jump: false }, ground(), TEST_STATS.tank, FIXED_DT);
    expect(crushes).toBeGreaterThanOrEqual(14); // 1 s = 29.9 running frames, half of them crush
    expect(crushes).toBeLessThanOrEqual(16);
  });
```

`world.test.ts`: add `import { makeTank } from './tank';` and append:

```ts
describe('driving the tank (MookArmouredGuy / TankBroTank)', () => {
  const TANKER: BroDef = { ...BROLUSCONI, id: 'tanker', base: 'bro_lee', special: 'tank' };
  /** A landed, empty tank `dx` to the right of the bro on EMPTY's floor. */
  function withTank(dx = 10, lvl = EMPTY, roster: BroDef[] = [TANKER]): World {
    const w = createWorld(lvl, TEST_STATS, roster, () => 0.5);
    const k = makeTank(900, w.player.x + dx, 24, 1);
    k.onGround = true;
    w.tanks.push(k);
    return w;
  }

  it('walking into a landed tank climbs in: the bro is hidden, shielded, and goes where the tank goes', () => {
    const w = withTank();
    play(w, {}, 1);
    expect(w.driving).toBe(w.tanks[0]);
    expect(w.player.invulnerable).toBeGreaterThan(0);
    play(w, { right: true }, 60, NO_CONTROLS);
    expect(w.tanks[0].x).toBeGreaterThan(w.spawn.x + 40);
    expect(w.player.x).toBe(w.tanks[0].x);
    expect(w.events).toContainEqual(expect.objectContaining({ type: 'boardTank' }));
  });

  it('F climbs out of the hatch: at (X, Y + 32) with yI 130 + 100', () => {
    const w = withTank();
    let prev = play(w, {}, 1);
    prev = play(w, { gesture: true }, 1, prev);
    expect(w.driving).toBeNull();
    expect(w.tanks[0].driven).toBe(false);
    expect(w.player.y).toBeGreaterThan(24 + 32 - 5); // one step of flight after appearing at Y + 32
    expect(w.player.yI).toBeGreaterThan(200);
  });

  it('after climbing out he stays out until he has stood clear of the tank', () => {
    const w = withTank(0);
    let prev = play(w, {}, 1);
    prev = play(w, { gesture: true }, 1, prev);
    prev = play(w, {}, 60, prev); // he falls back down inside the tank's box
    expect(w.player.onGround).toBe(true);
    expect(w.driving).toBeNull();
    prev = play(w, { right: true }, 30, prev); // walks clear
    expect(w.driving).toBeNull();
    play(w, { left: true }, 40, prev); // and back in
    expect(w.driving).toBe(w.tanks[0]);
  });

  it('driving into a mook runs it over (CrushGroundWhileMoving: 5 crush damage)', () => {
    const w = withTank(10, level([[2, 'P'], [8, 'm'], [27, 'F']]));
    play(w, { right: true }, 90);
    expect(w.enemies.every((m) => m.dead)).toBe(true); // its corpse lies there for CORPSE_TIME
    expect(w.events).toContainEqual(expect.objectContaining({ type: 'kill', kind: 'mook' }));
  });

  it('driving into a dirt wall grinds through it', () => {
    const w = withTank(10, level([[2, 'P'], [6, 'd'], [27, 'F']]));
    play(w, { right: true }, 90);
    expect(w.map.get(6, 2)).toBeNull();
  });

  it('a rescue while driving keeps the new bro inside', () => {
    const w = withTank(10, level([[2, 'P'], [20, 'c'], [27, 'F']]), [TANKER, BROLUSCONI]);
    play(w, {}, 1);
    w.prisoners[0].x = w.player.x;
    play(w, {}, 1);
    expect(w.bro).toBe(BROLUSCONI);
    expect(w.driving).toBe(w.tanks[0]);
  });

  it('reaching the flag while driving climbs out and extracts', () => {
    const w = withTank();
    play(w, {}, 1);
    w.tanks[0].x = w.flag.x - 4;
    play(w, {}, 2);
    expect(w.state).toBe('extracting');
    expect(w.driving).toBeNull();
  });
});
```

- [ ] **Step 2: Run, see them fail**

Run: `cd web && npx vitest run src/engine/world.test.ts src/engine/tank.test.ts`
Expected: FAIL (no boarding: `w.driving` stays `null`; the tank-body tests may already pass, since Task 3 wrote
`stepTankBody`). If they do pass, note in the ledger that they pin existing behaviour.

- [ ] **Step 3: Move `inHitBox`, add constants and events**

Cut `inHitBox` (with its doc comment) from `judo.ts` into `units.ts` as an `export function`, add `UNIT_BOX_HEIGHT, UNIT_WIDTH`
to `units.ts`'s constants import, and in `judo.ts` import `inHitBox` from `./units` (drop `UNIT_BOX_HEIGHT, UNIT_WIDTH`
from its constants import if no longer used).

`constants.ts`, ported:

```ts
export const TANK_CRUSH = { units: 5, unitsRange: 10, offset: 8, ground: 4, top: 1, groundRange: 11 }; // TankBroTank.AnimateRunning: CrushGroundWhileMoving(4, 5, 10, 8)
export const TANK_EXIT_YI = 130; // MookArmouredGuy.PressHighFiveMelee: DisChargePilot(130)
export const TANK_EXIT_Y = 32; // MookArmouredGuy.DisChargePilotRPC: the pilot appears at Y + 32 ...
export const TANK_EXIT_BOOST = 100; // ... with yI = disChargeYI + 100
```

and in "Design values": `export const TANK_DRIVER_SHIELD = 0.1; // the hidden driver can't be hit (renewed every step he is inside)`.

`world.ts` `GameEvent`: add `| { type: 'boardTank'; x: number; y: number } | { type: 'exitTank'; x: number; y: number }`.

- [ ] **Step 4: `driving.ts`** — replace the file with:

```ts
import { screenMaxY, VIEW_W } from './camera';
import {
  TANK_BOX, TANK_CRUSH, TANK_DRIVER_SHIELD, TANK_EXIT_BOOST, TANK_EXIT_Y, TANK_EXIT_YI, TILE, UNIT_HALF_WIDTH, UNIT_HEIGHT,
} from './constants';
import { barrelBlast, type Blast } from './explosions';
import { NO_DRIVE, makeTank, stepTankBody, tankDrop, type Tank } from './tank';
import { damageUnit, inHitBox, knock } from './units';
import type { Controls } from './types';
import type { World } from './world';

/** GrenadeAirstrike.SpawnTank: the tank falls in over the flattest ground near the grenade, facing the throw. */
export function callTank(w: World, x: number, y: number, facing: 1 | -1): void {
  const d = tankDrop(w.map, x, y, screenMaxY(w.camera), w.camera.x - VIEW_W / 2);
  w.tanks.push(makeTank(w.nextId++, d.x, d.y, d.fallback ? 1 : facing));
}

const overlaps = (x: number, y: number, k: Tank): boolean =>
  Math.abs(x - k.x) < UNIT_HALF_WIDTH + TANK_BOX.halfWidth && y < k.y + TANK_BOX.height && y + UNIT_HEIGHT > k.y;

/** Unit.PilotUnit: walking into a landed, empty tank climbs in (the one just left only after standing clear of it). */
export function boardTanks(w: World): void {
  const p = w.player;
  if (w.reboard && p.onGround && !overlaps(p.x, p.y, w.reboard)) w.reboard = null;
  if (w.driving || p.dead) return;
  for (const k of w.tanks) {
    if (k.driven || k.exploded || !k.onGround || k === w.reboard || !overlaps(p.x, p.y, k)) continue;
    k.driven = true;
    w.driving = k;
    p.attack = null;
    p.flex = null;
    p.wallClimbing = false;
    w.events.push({ type: 'boardTank', x: k.x, y: k.y });
    return;
  }
}

/** MookArmouredGuy.DisChargePilotRPC: the driver pops out of the hatch at (X, Y + 32) with yI = disChargeYI + 100. */
export function exitTank(w: World, disChargeYI: number): void {
  const k = w.driving;
  if (!k) return;
  const p = w.player;
  p.x = k.x;
  p.y = k.y + TANK_EXIT_Y;
  p.xI = k.xI;
  p.xIBlast = 0;
  p.yI = disChargeYI + TANK_EXIT_BOOST;
  p.onGround = false;
  k.driven = false;
  k.drive = NO_DRIVE;
  w.driving = null;
  w.reboard = k;
  w.events.push({ type: 'exitTank', x: k.x, y: k.y });
}

/** The driver's controls: arrows drive, jump jumps, and the gesture climbs out (PressHighFiveMelee). */
export function driveTank(w: World, controls: Controls, prev: Controls): void {
  const k = w.driving;
  if (!k) return;
  k.drive = { dir: controls.left === controls.right ? 0 : controls.left ? -1 : 1, jump: controls.jump && !prev.jump };
  if (controls.gesture && !prev.gesture) exitTank(w, TANK_EXIT_YI);
}

/** TankBroTank.CrushGroundWhileMoving(4, 5, 10, 8): the units and the block just ahead of the treads. */
function crushAhead(w: World, k: Tank, blasts: Blast[]): void {
  const ux = k.x + k.facing * TANK_CRUSH.offset;
  for (const m of w.enemies) {
    if (m.dead || m.invulnerable > 0 || !inHitBox(m, ux, k.y + 2, TANK_CRUSH.unitsRange)) continue;
    knock(m, k.xI, 40); // Map.HitLivingUnits(..., xI, 40, ...)
    damageUnit(m, TANK_CRUSH.units);
  }
  const gx = k.x + k.facing * (TANK_CRUSH.offset + 2);
  for (const [gy, damage] of [[k.y + 21, TANK_CRUSH.top], [k.y + 12, TANK_CRUSH.ground]] as const) {
    for (const [c, r] of w.map.cellsInCircle(gx, gy, TANK_CRUSH.groundRange / 2)) {
      const kind = w.map.damage(c, r, damage);
      if (kind) w.events.push({ type: 'block', x: c * TILE, y: r * TILE, kind, damage });
      if (kind === 'barrel') blasts.push(barrelBlast(c * TILE, r * TILE, w.stats.barrelRange));
    }
  }
}

/** Every tank: its body and its crush, then the driver is carried along, hidden and shielded. */
export function stepTanks(w: World, t: number, blasts: Blast[]): void {
  for (const k of w.tanks) {
    if (k.exploded) continue;
    const crushes = stepTankBody(k, k.driven ? k.drive : NO_DRIVE, w.map, w.stats.tank, t);
    for (let i = 0; i < crushes; i++) crushAhead(w, k, blasts);
  }
  const k = w.driving;
  if (k) {
    const p = w.player;
    p.x = k.x;
    p.y = k.y;
    p.xI = k.xI;
    p.yI = k.yI;
    p.facing = k.facing;
    p.onGround = k.onGround;
    p.invulnerable = Math.max(p.invulnerable, TANK_DRIVER_SHIELD);
  }
  w.tanks = w.tanks.filter((x) => !x.exploded);
}
```

- [ ] **Step 5: `stepPlayer`**

In `world.ts`, import `boardTanks, driveTank, exitTank` with `callTank, stepTanks` from `./driving`, and `TANK_EXIT_YI`
from `./constants`. In `stepPlayer`, wrap the foot controls in `if (w.driving) … else …`:

```ts
  if (p.invulnerable > 0) p.invulnerable = p.invulnerable - t > 1e-9 ? p.invulnerable - t : 0;
  if (w.driving) {
    driveTank(w, controls, prev);
  } else {
    // (unchanged) the flex, stepUnit, the weapon, stepJudo and the special, from `if (!p.attack) startOrStopFlex`
    // through the end of the `if (controls.special …) { … }` block
  }
  if (p.y < -64 && !w.driving) {
```

Move the existing lines from `if (!p.attack) startOrStopFlex(p, controls, prev);` through the closing `}` of the
special block into the `else`, unchanged. Change the fall-off check `if (p.y < -64) {` to
`if (p.y < -64 && !w.driving) {`. After `if (p.dead) return;` add `boardTanks(w);`. In the flag check, make the first
line of the block `if (w.driving) exitTank(w, TANK_EXIT_YI);`.

- [ ] **Step 6: Run all web tests and the typecheck**

Run: `cd web && npx vitest run && npx tsc --noEmit`
Expected: PASS (250 tests), no type errors.

- [ ] **Step 7: Commit**

```bash
git add web/src && git commit -m "engine: board the tank, drive it, run mooks over, climb out with F

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The turret — mortar, cannon, gun switch, and their projectiles

**Files:**
- Modify: `web/src/engine/tank.ts` (`pressFire`, `switchGun`, `stepTurret`), `projectiles.ts` (`fireShell`, `fireBigRocket`, `shell`/`bigRocket` steps), `explosions.ts` (`shellBlast`, sources), `driving.ts`, `world.ts` (`GameEvent`), `constants.ts`, `render/fx/controller.ts` (source type)
- Test: `tank.test.ts`, `projectiles.test.ts`, `world.test.ts`

**Interfaces:**
- Produces: `pressFire(tu)`, `switchGun(tu)`, `stepTurret(tu, t): 'shell' | 'cannon' | null`; `fireShell(id, k, stats)`, `fireBigRocket(id, k, stats)`; `shellBlast(x, y, s, team)`; `Blast['source']` adds `'shell' | 'bigRocket' | 'tank'`; `GameEvent` `{ type: 'gunSwitch'; x; y }`; `shot` weapon includes `'shell' | 'bigRocket'`.

- [ ] **Step 1: Failing tests**

`tank.test.ts`: import `pressFire, stepTurret, switchGun` too, and append:

```ts
/** Steps the turret until it fires (at most `max` steps); returns [the step it fired on, the shot]. */
function fireAfterPress(gun: 0 | 1, max = 80): [number, string | null] {
  const k = makeTank(1, 0, 0, 1);
  k.turret.gun = gun;
  pressFire(k.turret);
  for (let i = 1; i <= max; i++) {
    const shot = stepTurret(k.turret, FIXED_DT);
    if (shot) return [i, shot];
  }
  return [-1, null];
}

describe('the turret (TankBroTankTurret.FireWeapon / Update)', () => {
  it('the mortar fires on frame 6: 9 turret frames of 0.0334 s after the press', () => {
    const [step, shot] = fireAfterPress(0);
    expect(shot).toBe('shell');
    expect(step).toBeGreaterThanOrEqual(18);
    expect(step).toBeLessThanOrEqual(20);
  });

  it('the cannon winds up longer and fires on frame 7: 21 turret frames', () => {
    const [step, shot] = fireAfterPress(1);
    expect(shot).toBe('cannon');
    expect(step).toBeGreaterThanOrEqual(41);
    expect(step).toBeLessThanOrEqual(44);
  });

  it('a press from frame 6 on queues the next shot', () => {
    const k = makeTank(1, 0, 0, 1);
    pressFire(k.turret);
    let shots = 0;
    for (let i = 0; i < 70; i++) {
      if (k.turret.frame === 7 && shots === 1 && !k.turret.queued) pressFire(k.turret);
      if (stepTurret(k.turret, FIXED_DT)) shots++;
    }
    expect(shots).toBe(2);
  });

  it('switching gun plays the 20-frame transform and fires nothing meanwhile', () => {
    const k = makeTank(1, 0, 0, 1);
    switchGun(k.turret);
    expect(k.turret.gun).toBe(1);
    let shots = 0;
    for (let i = 0; i < 30; i++) if (stepTurret(k.turret, FIXED_DT)) shots++;
    expect(k.turret.switching).toBe(true);
    for (let i = 0; i < 20; i++) stepTurret(k.turret, FIXED_DT);
    expect(k.turret.switching).toBe(false);
    expect(k.turret.switchFrame).toBe(20);
    expect(shots).toBe(0);
  });
});
```

`projectiles.test.ts`: import `fireBigRocket, fireShell`, and append:

```ts
describe("the tank's projectiles", () => {
  const tank = { x: 80, y: 8, facing: 1 as const };

  it('the mortar shell leaves at (X + 17, Y + 33) at (135, 135), coasts, slows, then falls and blows up', () => {
    const p = fireShell(1, tank, TEST_STATS);
    expect([p.kind, p.x, p.y, p.xI, p.yI]).toEqual(['shell', 97, 41, 135, 135]);
    steps(p, world(floorMap()), 6); // 0.1 s: no drag yet
    expect(p.xI).toBeCloseTo(135, 5);
    steps(p, world(floorMap()), 15); // 0.35 s: slowed
    expect(p.xI).toBeLessThan(130);
    const e = steps(p, world(floorMap()), 400).find((x) => x.type === 'explode');
    expect(e?.type === 'explode' && [e.blast.source, e.blast.groundDamage, e.blast.unitRange, e.blast.force]).toEqual(['shell', 10, 36, 350]);
  });

  it('the big rocket leaves at (X + 24, Y + 22) at 44 and gains 120 u/s² of speed', () => {
    const p = fireBigRocket(1, tank, TEST_STATS);
    expect([p.kind, p.x, p.y, p.xI, p.crush]).toEqual(['bigRocket', 104, 30, 44, 3]);
    steps(p, world(new TileMap(60, 10)), 30);
    expect(p.xI).toBeCloseTo(44 + 120 * 0.5, 0);
  });

  it('the big rocket crushes through a wall layer instead of bouncing', () => {
    const map = new TileMap(60, 10);
    for (let r = 1; r <= 3; r++) map.set(8, r, makeBlock('dirt', TEST_STATS)); // x 120..136
    const p = fireBigRocket(1, { x: 70, y: 10, facing: 1 }, TEST_STATS);
    steps(p, world(map), 40);
    expect(map.get(8, 2)).toBeNull();
    expect(p.crush).toBe(2);
    expect(p.x).toBeGreaterThan(136);
  });

  it('the big rocket blows up after its 1 s life with its own blast', () => {
    const p = fireBigRocket(1, tank, TEST_STATS);
    const e = steps(p, world(new TileMap(60, 10)), 70).find((x) => x.type === 'explode');
    expect(e?.type === 'explode' && [e.blast.source, e.blast.groundDamage, e.blast.killRange]).toEqual(['bigRocket', 15, 56]);
  });
});
```

`world.test.ts`, inside `describe('driving the tank …')`:

```ts
  it('inside, X fires the turret and C switches gun without using a special', () => {
    const w = withTank();
    let prev = play(w, {}, 1);
    prev = play(w, { fire: true }, 1, prev);
    prev = play(w, {}, 25, prev);
    expect(w.projectiles.some((p) => p.kind === 'shell')).toBe(true);
    prev = play(w, { special: true }, 1, prev);
    expect(w.tanks[0].turret.gun).toBe(1);
    expect(w.specialAmmo).toBe(2);
    expect(w.events).toContainEqual(expect.objectContaining({ type: 'gunSwitch' }));
    prev = play(w, {}, 45, prev);
    prev = play(w, { fire: true }, 1, prev);
    play(w, {}, 45, prev);
    expect(w.events).toContainEqual(expect.objectContaining({ type: 'shot', weapon: 'bigRocket' }));
  });
```

- [ ] **Step 2: Run, see them fail**

Run: `cd web && npx vitest run src/engine`
Expected: FAIL (`pressFire` and `fireShell` not exported; no shell in the world).

- [ ] **Step 3: Constants and blasts**

`constants.ts`, ported:

```ts
export const TURRET_FRAME_RATE = 0.0334; // TankBroTankTurret.frameRate
export const TANK_SHELL = { ox: 17, oy: 33, speed: 150, m: 0.9 }; // TankBroTankTurret.FireShell: (X + dir*17, Y + 33) at (dir*150, 150) * 0.9
export const TANK_CANNON = { ox: 24, oy: 22 }; // TankBroTankTurret.FireCannon: (X + dir*24, Y + 22) at dir*cannonFireSpeed
export const HEAVY_SHELL_DIP = { coast: 0.1, slow: 0.35, fall: 0.4, drag: 1.5, gravity: 600 }; // HeavyShell.RunProjectile
export const SHELL_BLAST = { force: 350, extraY: 300 }; // HeavyShell.MakeEffects: ExplodeUnits(..., 350, 300)
export const TANK_ROCKET_CRUSH = { damage: 15, range: 16, ox: 9 }; // RocketMassive.Bounce: DamageGround(15, Crush, 16, X + dir*9, Y)
```

`explosions.ts`: change the `source` member of `Blast` to
`source: 'rocket' | 'bomb' | 'football' | 'barrel' | 'suicide' | 'shell' | 'bigRocket' | 'tank'; // whose MakeEffects to show`,
add `SHELL_BLAST` to its constants import, and add:

```ts
/** HeavyShell.MakeEffects: DamageGround(damage, range); ExplodeUnits(damage, range, range, 350, 300); DamageDoodads(1, range * 0.6). */
export function shellBlast(x: number, y: number, s: { damage: number; range: number }, team: Team): Blast {
  return {
    x, y, groundDamage: s.damage, groundRange: s.range, unitDamage: s.damage, unitRange: s.range, killRange: s.range,
    force: SHELL_BLAST.force, extraY: SHELL_BLAST.extraY, team, big: true, noise: NOISE_ROCKET, source: 'shell',
    doodadDamage: 1, doodadRange: s.range * 0.6,
  };
}
```

`render/fx/controller.ts`: `private explosion(source: 'rocket' | 'bomb' | 'football' | 'barrel' | 'suicide', …)`
becomes `private explosion(source: Blast['source'], …)`, with `import type { Blast } from '../../engine/explosions';`
(the existing `default:` branch draws the new sources until Task 7).

- [ ] **Step 4: The turret in `tank.ts`**

Add `TURRET_FRAME_RATE` to the constants import and append:

```ts
export type TurretShot = 'shell' | 'cannon' | null;

/** TankBroTankTurret.FireWeapon: start firing, or queue another shot once the current one is past its fire frame. */
export function pressFire(tu: Turret): void {
  if (!tu.firing) {
    tu.firing = true;
    tu.counter = 0;
    tu.frame = 0;
  } else if (tu.gun === 0) {
    if (tu.frame >= 8) {
      tu.counter = 0;
      tu.frame = 0;
    } else if (tu.frame >= 6) {
      tu.queued = true;
    }
  } else if (tu.frame >= 9) {
    tu.counter = 0;
    tu.frame = 0;
  } else if (tu.frame >= 7) {
    tu.queued = true;
  }
}

/** TankBroTank.PressSpecial -> TankBroTankTurret.SwitchGun: the other gun, with the transform animation. */
export function switchGun(tu: Turret): void {
  tu.gun = tu.gun === 0 ? 1 : 0;
  tu.switching = true;
  tu.firing = false;
}

/**
 * TankBroTankTurret.Update for one fixed step (at most one turret frame per step, as in the original). The mortar
 * holds an extra frame after frame 4 and two after frame 5, and fires on frame 6. The cannon holds 2, 3, 4 and 5
 * extra frames after frames 3-6, and fires on frame 7. Returns the shot fired this step.
 */
export function stepTurret(tu: Turret, t: number): TurretShot {
  const rate = TURRET_FRAME_RATE;
  if (tu.switching) {
    tu.counter += t;
    if (tu.counter >= rate) {
      tu.counter -= rate;
      tu.switchFrame += tu.gun === 1 ? 1 : -1;
      if (tu.switchFrame >= 20 || tu.switchFrame <= 0) {
        tu.switchFrame = tu.gun === 1 ? 20 : 0;
        tu.switching = false;
      }
    }
    return null;
  }
  if (!tu.firing) return null;
  tu.counter += t;
  if (tu.counter < rate) return null;
  tu.counter -= rate;
  tu.frame++;
  let shot: TurretShot = null;
  if (tu.gun === 0) {
    if (tu.frame === 4) tu.counter -= rate;
    else if (tu.frame === 5) tu.counter -= rate * 2;
    else if (tu.frame === 6) shot = 'shell';
    else if (tu.frame === 9 && tu.queued) {
      tu.frame = 1;
      tu.queued = false;
    } else if (tu.frame === 10) {
      tu.frame = 0;
      if (tu.queued) tu.queued = false;
      else tu.firing = false;
    }
  } else {
    if (tu.frame >= 3 && tu.frame <= 6) tu.counter -= rate * (tu.frame - 1);
    else if (tu.frame === 7) shot = 'cannon';
    else if (tu.frame === 10 && tu.queued) {
      tu.frame = 1;
      tu.queued = false;
    } else if (tu.frame === 11) {
      tu.frame = 0;
      if (tu.queued) tu.queued = false;
      else tu.firing = false;
    }
  }
  return shot;
}
```

- [ ] **Step 5: The projectiles in `projectiles.ts`**

Add `HEAVY_SHELL_DIP, TANK_CANNON, TANK_ROCKET_CRUSH, TANK_SHELL` to the constants import and `shellBlast` to the
explosions import. After `throwTankMarker`:

```ts
interface Gun {
  x: number;
  y: number;
  facing: 1 | -1;
}

/** TankBroTankTurret.FireShell: a HeavyShell from (X + dir*17, Y + 33) at (dir*150, 150) * 0.9. */
export function fireShell(id: number, k: Gun, stats: GameStats): Projectile {
  const v = TANK_SHELL.speed * TANK_SHELL.m;
  return make(id, 'shell', 'player', k.x + k.facing * TANK_SHELL.ox, k.y + TANK_SHELL.oy, k.facing * v, v, stats.tankShell.life);
}

/** TankBroTankTurret.FireCannon: a RocketMassive from (X + dir*24, Y + 22) at dir*cannonFireSpeed. */
export function fireBigRocket(id: number, k: Gun, stats: GameStats): Projectile {
  const p = make(id, 'bigRocket', 'player', k.x + k.facing * TANK_CANNON.ox, k.y + TANK_CANNON.oy,
    k.facing * stats.tank.cannonFireSpeed, 0, stats.tankRocket.life);
  p.crush = stats.tankRocket.crushLayers;
  return p;
}

/** RocketMassive.Bounce: instead of bouncing off the wall, crush it (while it has layers left). */
function crushWall(p: Projectile, w: ProjectileWorld, dir: 1 | -1, events: ProjectileEvent[]): void {
  for (const [c, r] of w.map.cellsInCircle(p.x + dir * TANK_ROCKET_CRUSH.ox, p.y, TANK_ROCKET_CRUSH.range / 2)) {
    const kind = w.map.damage(c, r, TANK_ROCKET_CRUSH.damage);
    if (kind) events.push({ type: 'block', c, r, kind, damage: TANK_ROCKET_CRUSH.damage });
    if (kind === 'barrel') events.push({ type: 'explode', blast: barrelBlast(c * TILE, r * TILE, w.stats.barrelRange) });
  }
}
```

In `stepProjectile`'s `switch`, add:

```ts
    case 'shell': {
      // HeavyShell.RunProjectile: coast for 0.1 s, drag in from 0.1 to 0.35 s, then fall as the drag eases off
      const d = (p.dip = (p.dip ?? 0) + t);
      const s = HEAVY_SHELL_DIP;
      if (d >= s.coast && d < s.slow) {
        const n = (d - s.coast) / (s.slow - s.coast);
        p.xI *= 1 - t * s.drag * n;
        p.yI *= 1 - t * s.drag * n;
      } else if (d >= s.slow) {
        const n = Math.min(1, Math.max(0, 1 - (d - s.slow) / s.fall));
        p.xI *= 1 - t * s.drag * n;
        p.yI *= 1 - t * s.drag * n;
        p.yI -= s.gravity * t * (1 - n);
      }
      p.x += p.xI * t;
      p.y += p.yI * t;
      if (w.map.blockAt(p.x, p.y) || unitAt(w.units, p.x, p.y, p.team) || p.life <= 0) {
        p.dead = true;
        events.push({ type: 'explode', blast: shellBlast(p.x, p.y, w.stats.tankShell, p.team) });
      }
      break;
    }
    case 'bigRocket': {
      const dir = p.xI < 0 ? -1 : 1;
      p.xI += dir * w.stats.tankRocket.acceleration * t; // RocketMassive.RunProjectile
      const nx = p.x + p.xI * t;
      if (w.map.blockAt(nx, p.y)) {
        if ((p.crush ?? 0) <= 0) {
          p.dead = true;
          events.push({ type: 'explode', blast: rocketBlast(p.x, p.y, w.stats.tankRocket, p.team, true, 'bigRocket') });
          break;
        }
        p.crush = (p.crush ?? 0) - 1;
        crushWall(p, w, dir, events);
      } else {
        p.x = nx;
      }
      p.y += p.yI * t;
      if (unitAt(w.units, p.x, p.y, p.team) || p.life <= 0) {
        p.dead = true;
        events.push({ type: 'explode', blast: rocketBlast(p.x, p.y, w.stats.tankRocket, p.team, true, 'bigRocket') });
      }
      break;
    }
```

- [ ] **Step 6: Wire the turret in `driving.ts` and `world.ts`**

`driving.ts`:
- import `pressFire, stepTurret, switchGun` from `./tank` and `fireBigRocket, fireShell` from `./projectiles`;
- in `driveTank`, before the gesture line:

```ts
  if (controls.fire && !prev.fire) pressFire(k.turret); // TankBroTank.StartFiring -> turret.FireWeapon
  if (controls.special && !prev.special) {
    switchGun(k.turret); // TankBroTank.PressSpecial
    w.events.push({ type: 'gunSwitch', x: k.x, y: k.y });
  }
```

- in `stepTanks`'s loop, after the crush loop:

```ts
    const shot = stepTurret(k.turret, t);
    if (shot === 'shell') {
      w.projectiles.push(fireShell(w.nextId++, k, w.stats));
      w.events.push({ type: 'shot', weapon: 'shell', x: k.x, y: k.y, facing: k.facing });
    } else if (shot === 'cannon') {
      w.projectiles.push(fireBigRocket(w.nextId++, k, w.stats));
      w.events.push({ type: 'shot', weapon: 'bigRocket', x: k.x, y: k.y, facing: k.facing });
    }
```

`world.ts` `GameEvent`: add `| { type: 'gunSwitch'; x: number; y: number }`.

- [ ] **Step 7: Run all web tests and the typecheck**

Run: `cd web && npx vitest run && npx tsc --noEmit`
Expected: PASS (259 tests), no type errors.

- [ ] **Step 8: Commit**

```bash
git add web/src && git commit -m "engine: the tank's turret, mortar shell and big rocket, ported from TankBroTankTurret

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Damage — the tank takes the hits, counts down, blows up

**Files:**
- Modify: `web/src/engine/tank.ts` (`damageTank`, `stepCountdown`, `tankAt`, `tankInBlast`), `explosions.ts` (`tankBlast`), `projectiles.ts` (enemy shots hit tanks), `driving.ts` (`hitTank`, `gibTank`, countdown, fall-off), `world.ts` (`stepProjectiles`, `resolveBlasts`), `constants.ts`
- Test: `tank.test.ts`, `world.test.ts`

**Interfaces:**
- Produces: `damageTank(k, amount, s): boolean`, `stepCountdown(k, s, t): boolean`, `tankAt(tanks, x, y): Tank | null`, `tankInBlast(k, b): boolean`; `tankBlast(x, y, massive)`; `ProjectileWorld.tanks?`; `ProjectileEvent` `{ type: 'hitTank'; tank: Tank; damage: number }`; `driving.ts`: `hitTank(w, k, damage, blasts)`, `gibTank(w, k, blasts)`.

- [ ] **Step 1: Failing tests**

`tank.test.ts`: import `damageTank, stepCountdown`, and append:

```ts
describe('tank damage (MookArmouredGuy.Damage / Update / TankBroTank.Damage)', () => {
  it('a driven tank past 25 starts its death countdown; an empty one gibs past 60', () => {
    const k = makeTank(1, 0, 0, 1);
    k.driven = true;
    expect(damageTank(k, 25, TEST_STATS.tank)).toBe(false);
    expect(k.countdown).toBe(-1);
    expect(damageTank(k, 1, TEST_STATS.tank)).toBe(false);
    expect(k.countdown).toBe(0);
    const empty = makeTank(2, 0, 0, 1);
    expect(damageTank(empty, 60, TEST_STATS.tank)).toBe(false);
    expect(damageTank(empty, 1, TEST_STATS.tank)).toBe(true);
  });

  it('the countdown ticks faster as it goes and ends at 45 ticks, about 5 s in', () => {
    const k = makeTank(1, 0, 0, 1);
    k.countdown = 0;
    let time = 0;
    while (!stepCountdown(k, TEST_STATS.tank, FIXED_DT) && time < 20) time += FIXED_DT;
    expect(k.countdown).toBe(45);
    expect(time).toBeGreaterThan(4);
    expect(time).toBeLessThan(7);
  });
});
```

`world.test.ts`: add `import { fireMookBullet } from './projectiles';` (merge with the existing projectiles import) and
`import { hitTank } from './driving';`; inside `describe('driving the tank …')`:

```ts
  it('enemy bullets hit the tank, not the hidden driver', () => {
    const w = withTank();
    play(w, {}, 1);
    const shooter = makeUnit(901, 'mook', 'enemy', w.player.x + 80, 24, TEST_STATS.units.mook);
    w.projectiles.push(fireMookBullet(w.nextId++, shooter, TEST_STATS, () => 0.5));
    play(w, {}, 30);
    expect(w.tanks[0].damage).toBe(1);
    expect(w.player.dead).toBe(false);
  });

  it('past its limit it counts down, throws the driver clear and blows up', () => {
    const w = withTank();
    play(w, {}, 1);
    hitTank(w, w.tanks[0], 26, []);
    expect(w.tanks[0].countdown).toBe(0);
    play(w, {}, 420);
    expect(w.tanks).toHaveLength(0);
    expect(w.driving).toBeNull();
    expect(w.player.dead).toBe(false);
    expect(w.events).toContainEqual(expect.objectContaining({ type: 'explosion', source: 'tank' }));
  });

  it('an empty tank blows up at once past 60', () => {
    const w = withTank(200);
    const blasts: Blast[] = [];
    hitTank(w, w.tanks[0], 61, blasts);
    expect(w.tanks[0].exploded).toBe(true);
    expect(blasts[0].source).toBe('tank');
  });

  it('a tank that falls off the map lets the driver out and is gone', () => {
    const w = withTank();
    play(w, {}, 1);
    w.tanks[0].y = -70;
    play(w, {}, 1);
    expect(w.tanks).toHaveLength(0);
    expect(w.driving).toBeNull();
  });
```

(`world.test.ts` needs `import { makeUnit } from './units';` merged with `damageUnit`, and `import type { Blast } from './explosions';`.)

- [ ] **Step 2: Run, see them fail**

Run: `cd web && npx vitest run src/engine`
Expected: FAIL (`damageTank` not exported; the bullet passes through; no countdown).

- [ ] **Step 3: Constants, the tank blast, the damage model**

`constants.ts`, ported:

```ts
export const TANK_COUNTDOWN = { first: 0.4667, step: 0.2667, speedup: 4 }; // MookArmouredGuy.Update: deathCountdownCounter
export const TANK_EMPTY_LIMIT = 60; // MookArmouredGuy.Damage: shieldDamage > 60
export const TANK_GIB_YI = 180; // MookArmouredGuy.Gib: DisChargePilot(180)
export const TANK_GIB = { ground: 15, damage: 20, killRange: 32, force: 200, extraY: 150, yOffset: 6 }; // MookArmouredGuy.Gib: ExplodeUnits(20, ..., 200, 150, -15); DamageGround(15, ...)
export const TANK_GIB_RANGE = { massive: 72, small: 36, smallUnits: 48 }; // ... range 72 after the countdown, else 36 (ground) / 48 (units)
```

and in "Design values": `export const TANK_EJECT_INVULNERABLE = 0.5; // the driver thrown clear by the gib outlives its blast`.

`explosions.ts`: add `NOISE_BARREL, TANK_GIB, TANK_GIB_RANGE` to the constants import and:

```ts
/** MookArmouredGuy.Gib: the countdown's massive blast or the smaller one; fired as playerNum -15, it hurts everyone. */
export function tankBlast(x: number, y: number, massive: boolean): Blast {
  const ground = massive ? TANK_GIB_RANGE.massive : TANK_GIB_RANGE.small;
  return {
    x, y: y + TANK_GIB.yOffset, groundDamage: TANK_GIB.ground, groundRange: ground, unitDamage: TANK_GIB.damage,
    unitRange: massive ? TANK_GIB_RANGE.massive : TANK_GIB_RANGE.smallUnits, killRange: TANK_GIB.killRange,
    force: TANK_GIB.force, extraY: TANK_GIB.extraY, team: 'neutral', big: true, noise: NOISE_BARREL, source: 'tank',
    doodadDamage: TANK_GIB.ground, doodadRange: ground,
  };
}
```

`tank.ts`: add `TANK_COUNTDOWN, TANK_EMPTY_LIMIT` to the constants import and `import type { Blast } from './explosions';`, then append:

```ts
/**
 * MookArmouredGuy.Damage / TankBroTank.Damage: hits add up. Past maxDamageBeforeExploding a driven tank starts its
 * death countdown. True when the tank must gib at once: an empty one past 60.
 */
export function damageTank(k: Tank, amount: number, s: TankStats): boolean {
  k.damage += amount;
  if (k.driven && k.damage > s.maxDamage && k.countdown < 0) k.countdown = 0;
  return !k.driven && !k.exploded && k.damage > TANK_EMPTY_LIMIT;
}

/** MookArmouredGuy.Update (deathCount > 2): a tick every 0.2667 s after the first 0.4667, speeding up to 5x. */
export function stepCountdown(k: Tank, s: TankStats, t: number): boolean {
  if (k.countdown < 0) return false;
  k.countdownCounter += t * (1 + Math.min(TANK_COUNTDOWN.speedup, Math.max(0, (k.countdown / s.countdownThreshold) * TANK_COUNTDOWN.speedup)));
  if (k.countdownCounter >= TANK_COUNTDOWN.first) {
    k.countdownCounter -= TANK_COUNTDOWN.step;
    k.countdown += 1;
  }
  return k.countdown >= s.countdownThreshold;
}

const HIT_MARGIN = 2;

/** The first standing tank whose box holds (x, y): enemy shots stop on it. */
export function tankAt(tanks: readonly Tank[], x: number, y: number): Tank | null {
  for (const k of tanks) {
    if (k.exploded) continue;
    if (Math.abs(x - k.x) <= TANK_BOX.halfWidth + HIT_MARGIN && y >= k.y - HIT_MARGIN && y <= k.y + TANK_BOX.height + HIT_MARGIN) return k;
  }
  return null;
}

/** Map.ExplodeUnits reaching the tank: its box within the blast's unit range. */
export function tankInBlast(k: Tank, b: Blast): boolean {
  return Math.abs(k.x - b.x) < b.unitRange + TANK_BOX.halfWidth
    && Math.abs(k.y + TANK_BOX.height / 2 - b.y) < b.unitRange + TANK_BOX.height / 2;
}
```

- [ ] **Step 4: Enemy shots stop on tanks (`projectiles.ts`)**

- `import { tankAt, type Tank } from './tank';`;
- `ProjectileWorld` gets `tanks?: readonly Tank[];`;
- `ProjectileEvent` gets `| { type: 'hitTank'; tank: Tank; damage: number }`;
- in `case 'bullet'`, right after the block check's `break; }`:

```ts
      const tank = p.team === 'enemy' ? tankAt(w.tanks ?? [], p.x, p.y) : null;
      if (tank) {
        events.push({ type: 'hitTank', tank, damage: w.stats.bullet.damage });
        p.dead = true;
        break;
      }
```

- in `case 'rocket': case 'bomb':`, extend the explode condition with
  `|| (p.team === 'enemy' && tankAt(w.tanks ?? [], p.x, p.y) !== null)`.

- [ ] **Step 5: Hits, gib, countdown, fall-off (`driving.ts`) and the world**

`driving.ts`:
- add `TANK_EJECT_INVULNERABLE, TANK_GIB_YI` to the constants import, `tankBlast` to the explosions import, and
  `damageTank, stepCountdown` to the tank import;
- append:

```ts
/** MookArmouredGuy.Gib: the driver is thrown clear, then the tank blows up. */
export function gibTank(w: World, k: Tank, blasts: Blast[]): void {
  if (k.exploded) return;
  const massive = k.countdown >= 0; // deathCount > 9000: the countdown's massive blast
  if (k.driven) {
    exitTank(w, TANK_GIB_YI);
    w.player.invulnerable = Math.max(w.player.invulnerable, TANK_EJECT_INVULNERABLE);
    w.reboard = null;
  }
  k.exploded = true;
  blasts.push(tankBlast(k.x, k.y, massive));
}

/** A hit on a tank: past its limit an empty one gibs at once, a driven one counts down (damageTank). */
export function hitTank(w: World, k: Tank, damage: number, blasts: Blast[]): void {
  if (!k.exploded && damageTank(k, damage, w.stats.tank)) gibTank(w, k, blasts);
}
```

- in `stepTanks`'s loop, after the turret block:

```ts
    if (stepCountdown(k, w.stats.tank, t)) {
      gibTank(w, k, blasts);
    } else if (k.y < -64) {
      if (k.driven) exitTank(w, 0); // fell off the map: the driver drops out, the tank is gone
      k.exploded = true;
    }
```

`world.ts`:
- import `hitTank` from `./driving` and `tankInBlast` from `./tank`;
- in `stepProjectiles`, `const pw = { map: w.map, units: [w.player, ...w.enemies], stats: w.stats, tanks: w.tanks };`,
  and add the branch `else if (ev.type === 'hitTank') hitTank(w, ev.tank, ev.damage, blasts);`;
- in `resolveBlasts`, after `damageGrass(w, b);`:

```ts
    // Map.ExplodeUnits on the tanks: enemy and neutral blasts (the player's own don't hurt his tanks)
    if (b.team !== 'player') for (const k of w.tanks) if (!k.exploded && tankInBlast(k, b)) hitTank(w, k, b.unitDamage, blasts);
```

- [ ] **Step 6: Run all web tests and the typecheck**

Run: `cd web && npx vitest run && npx tsc --noEmit`
Expected: PASS (265 tests), no type errors.

- [ ] **Step 7: Commit**

```bash
git add web/src && git commit -m "engine: the tank takes enemy fire, counts down past 25 damage and blows up, throwing the driver clear

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Rendering the tank

**Files:**
- Modify: `web/src/render/assets.ts` (`SHEET_KEYS`), `web/src/render/animation.ts` (`tankHullFrame`, `turretFrame`), `web/src/render/renderer.ts`, `web/src/render/fx/controller.ts`
- Test: `web/src/render/animation.test.ts`, `web/src/render/assets.test.ts`

**Interfaces:**
- Consumes: `Tank`, `Turret` (Tasks 3–6).
- Produces: `tankHullFrame(k): Frame`, `turretFrame(tu): Frame`; sheet keys `tank_ru`, `turret_ru`, `tank_shell`, `tank_rocket`.

- [ ] **Step 1: Failing tests**

`animation.test.ts`: import `tankHullFrame, turretFrame` and `makeTank` from `../engine/tank`, then append:

```ts
describe('the tank (TankBroTank.Animate*, TankBroTankTurret.SetTurretFrame)', () => {
  it('idles on column 0, rolls through columns 0-2 at 0.0334 s, and uses row 1 by yI in the air', () => {
    const k = makeTank(1, 0, 0, 1);
    k.onGround = true;
    expect(tankHullFrame(k)).toEqual({ col: 0, row: 0 });
    Object.assign(k, { xI: 60, animTime: 0.07 });
    expect(tankHullFrame(k)).toEqual({ col: 2, row: 0 });
    Object.assign(k, { onGround: false, yI: 120 });
    expect(tankHullFrame(k)).toEqual({ col: 1, row: 1 });
    Object.assign(k, { yI: -100 });
    expect(tankHullFrame(k)).toEqual({ col: 7, row: 1 });
  });

  it('the turret: mortar firing on row 0, the transform on row 1, the cannon on row 2', () => {
    const tu = makeTank(1, 0, 0, 1).turret;
    expect(turretFrame(tu)).toEqual({ col: 0, row: 0 });
    Object.assign(tu, { firing: true, frame: 5 });
    expect(turretFrame(tu)).toEqual({ col: 5, row: 0 });
    Object.assign(tu, { firing: false, switching: true, switchFrame: 12, gun: 1 });
    expect(turretFrame(tu)).toEqual({ col: 12, row: 1 });
    Object.assign(tu, { switching: false, firing: true, frame: 7 });
    expect(turretFrame(tu)).toEqual({ col: 7, row: 2 });
    Object.assign(tu, { firing: false });
    expect(turretFrame(tu)).toEqual({ col: 0, row: 2 });
  });
});
```

`assets.test.ts`, inside `describe('loadData')`:

```ts
  it('the tank sheets are required', () => {
    const old: Record<string, unknown> = { ...sheets };
    delete old.tank_ru;
    delete old.tank_rocket;
    expect(missingSheets(old)).toEqual(['tank_ru', 'tank_rocket']);
  });
```

- [ ] **Step 2: Run, see them fail**

Run: `cd web && npx vitest run src/render`
Expected: FAIL (`tankHullFrame` not exported; `tank_ru` not a sheet key).

- [ ] **Step 3: Sheet keys and frames**

`assets.ts` `SHEET_KEYS`: add `'tank_ru', 'turret_ru', 'tank_shell', 'tank_rocket'` after `'putin'`. (The
`missingSheets` order follows `SHEET_KEYS`, so the test above expects `['tank_ru', 'tank_rocket']`.)

`animation.ts`: add `TANK_RUN_FRAME_RATE` to the constants import, `import type { Tank, Turret } from '../engine/tank';`, and:

```ts
/** TankBroTank: AnimateActualIdleFrames (0, 0); AnimateRunning, columns 0-2 at runningFrameRate; AnimateJumping, row 1 by yI. */
export function tankHullFrame(k: Tank): Frame {
  if (!k.onGround) {
    const col = k.yI > 100 ? 1 : k.yI > 66 ? 2 : k.yI > 33 ? 3 : k.yI > 0 ? 4 : k.yI > -33 ? 5 : k.yI > -66 ? 6 : 7;
    return { col, row: 1 };
  }
  if (Math.abs(k.xI) > 1) return { col: Math.floor(k.animTime / TANK_RUN_FRAME_RATE) % 3, row: 0 };
  return { col: 0, row: 0 };
}

/** TankBroTankTurret.SetTurretFrame: the mortar's frames on row 0, the gun switch on row 1, the cannon's on row 2. */
export function turretFrame(tu: Turret): Frame {
  if (tu.switching) return { col: tu.switchFrame, row: 1 };
  const row = tu.gun === 0 ? 0 : 2;
  return { col: tu.firing ? tu.frame : 0, row };
}
```

- [ ] **Step 4: Draw it (`renderer.ts`)**

- imports: add `tankHullFrame, turretFrame` to the `./animation` import, and `import type { Tank } from '../engine/tank';`;
- in `render`, after `this.drawPrisoners(w);`: `for (const k of w.tanks) this.drawTank(k);`;
- the player draw line becomes `if (!boarded && !w.driving) this.drawUnit(w.player, w.time);`;
- add the method after `drawUnit`:

```ts
  /** TankBroTank's hull with the turret on top (bobbing a pixel while it rolls), flashing in its death countdown. */
  private drawTank(k: Tank): void {
    const hull = tankHullFrame(k);
    const top = turretFrame(k.turret);
    const y = k.y + this.assets.sheets.tank_ru.offsetY;
    const bob = k.onGround && Math.abs(k.xI) > 1 && Math.floor(k.bob / 2) % 2 === 0 ? 1 : 0; // TankBroTank.AnimateRunning
    const flash = k.countdown >= 0 && k.countdown % 2 === 1;
    if (flash) this.ctx.filter = 'brightness(2.2)';
    this.sprite('tank_ru', hull.col, hull.row, k.x, y, k.facing < 0);
    this.sprite('turret_ru', top.col, top.row, k.x, y + bob, k.facing < 0);
    if (flash) this.ctx.filter = 'none';
  }
```

- in `drawProjectile`'s `switch`:

```ts
      case 'shell':
        this.sprite('tank_shell', 0, 0, p.x, p.y, false, angle);
        break;
      case 'bigRocket':
        this.sprite('tank_rocket', loopFrame(time, 0.05, this.assets.sheets.tank_rocket.cols), 0, p.x, p.y, p.xI < 0);
        break;
```

`fx/controller.ts`, in `explosion`'s `switch`, before `default:`:

```ts
      case 'shell':
        // HeavyShell.MakeEffects: a range pop and a medium explosion
        this.rangePop(x, y, range * 3);
        this.sparkShower(x, y, 50, 3, 160, 0, 60, 0.6, 0.33);
        this.shaderExplosion('medium', x, y);
        return;
      case 'bigRocket':
        // Rocket.MakeEffects, then RocketMassive's three plumes
        this.rangePop(x, y, range * 3);
        this.sparkShower(x, y, 60, 3, 160, 0, 60, 0.6, 0.33);
        this.shaderExplosion('medium', x + ux * range * 0.05, y + uy * range * 0.05);
        this.plumes(x, y, 3, 15, 240, 0, 0);
        return;
      case 'tank':
        // MookArmouredGuy.Gib: CreateMassiveExplosion
        this.rangePop(x, y, range * 2);
        this.sparkShower(x, y, 70, 3, 200, 0, 250, 0.6, 0.5);
        this.plumes(x, y, 5, 10, 315, 0, 0);
        this.shaderExplosion('large', x, y);
        return;
```

and in `onEvent`'s `case 'shot'`, after the rocket branch:

```ts
        } else if (e.weapon === 'bigRocket') {
          this.puff('muzzleFlash', e.x + e.facing * 24, e.y + 22, e.facing, e.facing * 2, 0); // CreateMuzzleFlashTankCannonEffect
```

- [ ] **Step 5: Run all web tests and the typecheck**

Run: `cd web && npx vitest run && npx tsc --noEmit`
Expected: PASS (268 tests), no type errors.

- [ ] **Step 6: Commit**

```bash
git add web/src && git commit -m "render: the Russian tank's hull, turret, shells and big rockets

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: The anthem, the tank's sounds and the menu credit

**Files:**
- Create: `web/src/app/music.ts`, `web/src/app/music.test.ts`
- Modify: `web/src/app/sfx.ts`, `web/src/app/sfx.test.ts`, `web/src/ui/GameView.tsx`, `web/src/ui/Menu.tsx`, `docs/findings.md`

**Interfaces:**
- Produces: `anthemShouldPlay(driving: boolean, state: string, paused: boolean, sound: boolean): boolean`; `class Music { constructor(audio: AudioLike | null); update(on: boolean, dt: number): void; dispose(): void; readonly level: number }`; sfx `mortar`, `cannon`.

- [ ] **Step 1: Failing tests** — create `web/src/app/music.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Music, anthemShouldPlay, type AudioLike } from './music';

function fakeAudio(fail = false) {
  const a = {
    volume: 1, loop: false, paused: true, plays: 0, pauses: 0,
    play() { this.plays++; this.paused = false; return fail ? Promise.reject(new Error('no file')) : Promise.resolve(); },
    pause() { this.pauses++; this.paused = true; },
  };
  return a as AudioLike & { plays: number; pauses: number };
}

describe('the anthem', () => {
  it('plays only with someone in a tank, while playing, unpaused, with sound on', () => {
    expect(anthemShouldPlay(true, 'playing', false, true)).toBe(true);
    expect(anthemShouldPlay(false, 'playing', false, true)).toBe(false);
    expect(anthemShouldPlay(true, 'playing', true, true)).toBe(false);
    expect(anthemShouldPlay(true, 'playing', false, false)).toBe(false);
    expect(anthemShouldPlay(true, 'extracting', false, true)).toBe(false);
  });

  it('fades in over 0.5 s, loops, and fades out over 0.5 s before pausing', () => {
    const a = fakeAudio();
    const m = new Music(a);
    expect(a.loop).toBe(true);
    m.update(true, 0.25);
    expect(m.level).toBeCloseTo(0.5);
    expect(a.plays).toBe(1);
    m.update(true, 0.5);
    expect(m.level).toBe(1);
    m.update(false, 0.25);
    expect(a.pauses).toBe(0);
    m.update(false, 0.5);
    expect(m.level).toBe(0);
    expect(a.pauses).toBe(1);
  });

  it('a failed play stays silent and never throws; no audio at all is fine too', async () => {
    const a = fakeAudio(true);
    const m = new Music(a);
    m.update(true, 0.1);
    await Promise.resolve();
    expect(() => m.update(true, 0.1)).not.toThrow();
    expect(a.plays).toBe(1);
    expect(() => new Music(null).update(true, 1)).not.toThrow();
  });
});
```

`sfx.test.ts`, in `maps game events to sounds`:

```ts
    expect(sfxFor({ type: 'shot', weapon: 'shell', x: 0, y: 0, facing: 1 })).toBe('mortar');
    expect(sfxFor({ type: 'shot', weapon: 'bigRocket', x: 0, y: 0, facing: 1 })).toBe('cannon');
    expect(sfxFor({ type: 'gunSwitch', x: 0, y: 0 })).toBe('throw');
```

- [ ] **Step 2: Run, see them fail**

Run: `cd web && npx vitest run src/app`
Expected: FAIL (`./music` missing; no `mortar`).

- [ ] **Step 3: `web/src/app/music.ts`**

```ts
/** The parts of an HTMLAudioElement the music player uses (a fake in tests). */
export interface AudioLike {
  volume: number;
  loop: boolean;
  paused: boolean;
  play(): Promise<void> | void;
  pause(): void;
}

/** The Russian anthem plays while someone is in a tank, the level is running, the game isn't paused and sound is on. */
export function anthemShouldPlay(driving: boolean, state: string, paused: boolean, sound: boolean): boolean {
  return driving && state === 'playing' && !paused && sound;
}

const FADE = 2; // full volume in 0.5 s
const VOLUME = 0.6;

/** One looped track that fades in while `on` and out when not, pausing once silent. A failed play stays silent. */
export class Music {
  private fade = 0;
  private broken = false;

  constructor(private readonly audio: AudioLike | null) {
    if (audio) {
      audio.loop = true;
      audio.volume = 0;
    }
  }

  get level(): number {
    return this.fade;
  }

  update(on: boolean, dt: number): void {
    const a = this.audio;
    if (!a || this.broken) return;
    this.fade = Math.min(1, Math.max(0, this.fade + (on ? FADE : -FADE) * dt));
    a.volume = this.fade * VOLUME;
    if (this.fade > 0 && a.paused) {
      try {
        const started = a.play();
        if (started) started.catch(() => { this.broken = true; });
      } catch {
        this.broken = true;
      }
    } else if (this.fade === 0 && !a.paused) {
      a.pause();
    }
  }

  dispose(): void {
    this.audio?.pause();
  }
}
```

- [ ] **Step 4: Sounds, GameView, menu**

`sfx.ts`:
- `SfxName` adds `| 'mortar' | 'cannon'`;
- the `shot` switch adds `case 'shell': return 'mortar';` and `case 'bigRocket': return 'cannon';`, and gains a
  top-level `case 'gunSwitch': return 'throw';`;
- `RECIPES` adds:

```ts
  mortar: (s, o, t) => {
    s.tone(o, t, 'sine', 110, 45, 0.25, 0.7);
    s.hiss(o, t, 'lowpass', 900, 200, 0.2, 0.4);
  },
  cannon: (s, o, t) => {
    s.hiss(o, t, 'lowpass', 1600, 150, 0.6, 0.8);
    s.tone(o, t, 'sawtooth', 70, 30, 0.45, 0.5);
  },
```

`GameView.tsx`:
- `import { Music, anthemShouldPlay } from '../app/music';`;
- in the effect, after `const sfx = new Sfx(sound);`:
  `const music = new Music(sound ? new Audio('/audio/anthem_ru.ogg') : null);`;
- the render callback becomes:

```tsx
      (frameTime) => {
        const paused = pause.get();
        renderer.render(world, paused ? 0 : frameTime);
        music.update(anthemShouldPlay(world.driving !== null, world.state, paused, sound), paused ? 1 : frameTime);
      },
```

- in the cleanup, add `music.dispose();`.

`Menu.tsx`: below the existing note add
`<p className="note">Inno russo: Orchestra presidenziale della Federazione Russa (kremlin.ru, via Wikimedia Commons).</p>`.

`docs/findings.md`:
- add to "Ported from code": the tank rows (drop spot, physics, crush, turret timings, the two projectiles, damage
  and countdown, the gib, the exit) with their sources, as written in the spec's Engine section;
- add to "Design values": the re-board rule, the 0.1 s driver shield, the 0.5 s eject invulnerability, the tank
  facing the throw, and our cannon and mortar sounds. Also the anthem recording and its source;
- add to "Simplified or left out": no boost dash, hatch, flag or driver's head; no landing crush (the −600 fall cap
  never reaches FallDamage's −2000); empty tanks gib past 60 instead of being husks; only enemy and neutral blasts
  hurt tanks.

- [ ] **Step 5: Run all web tests, the typecheck and the build**

Run: `cd web && npx vitest run && npx tsc --noEmit && npx vite build`
Expected: PASS (271 tests), no type errors, the build succeeds.

- [ ] **Step 6: Commit**

```bash
git add web/src docs/findings.md && git commit -m "web: the Russian anthem while in the tank, the tank's sounds and the credit

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Check it in the browser

- [ ] **Step 1:** Run both suites: `cd web && npx vitest run && npx tsc --noEmit && cd ../extractor && .venv/Scripts/python -m pytest -q`.
  Expected: all green (271 web, 27 extractor).
- [ ] **Step 2:** Start `npx vite --port 5199 --strictPort` in `web/` in the background.
- [ ] **Step 3:** Run REA `capture_browser_scenario` (launch Chrome, `http://localhost:5199/`). Steps:
  1. menu, `ArrowRight` (Putin), `Enter` on body, wait 1 s;
  2. `KeyC`, wait 1.5 s (the tank falls), screenshot;
  3. `ArrowRight` taps until the tank is boarded, screenshot (the bro hidden, the olive tank with the tricolour);
  4. `KeyX`, wait 0.5 s, screenshot (mortar shell);
  5. `KeyC`, wait 0.8 s, `KeyX`, wait 0.9 s, screenshot (cannon rocket);
  6. `KeyF`, screenshot (out of the hatch).

  Add `console` and `page-errors` events and check that there are no errors. Decode the screenshots with Python and
  look at them.
- [ ] **Step 4:** The anthem can't be heard through the tool. To check that it plays, add a temporary
  `console.log('anthem', music.level)` once per second in the render callback, run the scenario with `console`
  events, and check that the level rises to 1 after boarding and falls to 0 after F. **Remove the temporary log** and
  confirm with `git diff`.
- [ ] **Step 5:** Stop the server. Commit fixes, if any, each with a test where testable.
