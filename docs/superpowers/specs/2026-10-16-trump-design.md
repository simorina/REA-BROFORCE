# Broforce: Donald Trump and his jet — design spec

Date: 2026-10-16
Status: design agreed in chat (the user chose every option and supplied the custom sound); this document records it.

## Goal

A third playable parody bro, **Donald Trump**:
- **Weapon:** a normal rifle (Broniversal Soldier's assault rifle and its burst fire).
- **Special:** the signal grenade calls in a jet. It is Broforce's Harrier, repainted stealth grey and standing in for
  the B-2. It comes down vertically and lands, and Trump climbs in like Putin into his tank.
- **Flying:** the arrows fly it freely. X fires pairs of rockets diagonally down-forward, C drops a bomb straight down
  and F jumps out.
- **Limits:** it has 20 s of fuel and can be shot down like the tank.
- **Music:** while anyone flies it, the user's own sound plays ("WTF is a kilometer"), or the US national anthem when
  that file is missing.

Success means Trump is picked in the menu, or reached by a rescue, and plays level 1 with the rifle. The special
brings the jet down; walking into it boards it; flying, firing, bombing, the fuel running out, getting out and being
shot down all work. The music plays only while inside. Brolusconi and Putin, the tank included, are unchanged.

## Non-goals

- A real B-2 sprite: Broforce has none. The Harrier is the jet.
- Mooks shooting back at the jet any differently from the tank; anti-air; enemy jets.
- Downloading the meme audio: it is someone else's copyrighted voiceover. The user supplies the file.
- The Harrier's own strafing behaviour (it hovers and fires heavy bullets by itself).

## Asset boundary

- Free Lives sprites and values are read from the local install into `game-data/` (gitignored), as before.
- The US anthem goes to `game-data/audio/anthem_us.ogg`. It is the US Navy Band recording on Wikimedia Commons,
  public domain as a work of the US government, with a composition published before 1931.
- The user's sound is copied by hand into `game-data/audio/trump_custom.mp3`. It is never committed or distributed.

## Bro definition

`web/src/bros/trump.json`:

```json
{
  "id": "trump",
  "name": "Donald Trump",
  "sheet": "trump",
  "base": "bro_soldier",
  "weapon": "rifle",
  "special": "jet",
  "voiceLine": "Make America Great Again!",
  "voiceLang": "en-US"
}
```

- `BRO_BASES` adds `bro_soldier`. `WEAPONS` adds `rifle` and `SPECIALS` adds `jet`.
- `BROS` becomes `[BROLUSCONI, PUTIN, TRUMP]`, which is also the order a rescue cycles through.

## Extractor

- **Values:**
  - `bro_soldier`: Broniversal Soldier's `UNIT_FIELDS` (speed 110, jump 260, fireRate 0.12, specials 3) plus
    `extraFireDelay` (0.3);
  - `rifle_bullet`: the soldier's projectile, "Bullet Rambo": `damage` 1, `life` 0.45;
  - `jet`: the Harrier's sprite frame (96×64, offset 12).
- **Sheets:**
  - `trump.png`: a recipe on Double Bro Seven's sheet. The tuxedo becomes a dark navy suit; the white shirt is kept;
    the red flower stays red, as the tie; the hair becomes blond-orange; the skin becomes orange tan. The palette is
    measured and checked by eye.
  - `rifle_gun.png`: the texture "Broniversal Soldier Gun Anim", 1024×64, 32×32 frames.
  - `jet_us.png`: a recipe on the Harrier's sheet ("Jet Support Attack", 512×64, 96×64 frames). Its light greys
    become dark stealth greys.
- **Anthem:** a second `AudioRef` for
  `https://upload.wikimedia.org/wikipedia/commons/6/65/Star_Spangled_Banner_instrumental.ogg` (SHA-256
  `025bb322eee1e3e2638e2aa3b1b4e8c8e5c3798dca97fc4d059e7a9ab250c654`, 3,391,706 bytes), written to
  `audio/anthem_us.ogg`, with the same offline-tolerant rules as the Russian one.

## Engine

### Vehicles

The tank's piloting layer is generalized so the jet shares it:
- boarding by touch, and the "stand clear before re-boarding" rule;
- the driver hidden, shielded and carried along;
- climbing out; enemy hits and blasts; the damage limit (25), the death countdown (45 ticks) and the gib throwing
  the pilot clear; an empty vehicle gibbing past 60; leaving the map.

A `Vehicle` base holds the shared fields. `Tank` and `Jet` extend it with a `kind`. `World` keeps `tanks`, adds
`jets`, and `driving` becomes `Vehicle | null`. The tank's behaviour and tests stay as they are.

### The rifle (`rifle`): ported from `BroniversalSoldier.UseFire` / `FireWeapon`

- Each burst is 3 bullets at 420 from (X + dir·14, Y + 8.5), with a vertical jitter of −10…+10. `UseFire` fires
  the first; `burstShotsLeft = 2` fires the other two 0.07 s apart (`burstFireCounter`). `UseFire` also sets
  `fireDelay = extraFireDelay` (0.3 s), so the next burst comes once that has run out and the `fireRate` (0.12)
  counter allows it (`TestVanDammeAnim.RunFiring`, like the mooks' `runFiring`).
- Holding fire keeps firing bursts.
- The bullets are player `bullet`s that use `rifle_bullet`'s damage and life: they hurt enemies and chip blocks like
  the mooks' bullets do.

### The jet (`jet`)

- **Call:** the signal grenade (`call: 'jet'`). When it pops, the jet appears above the screen over the grenade,
  clamped inside the map, and comes straight down: fast (design: 160 u/s), then for the last 48 px at the Harrier's
  40 u/s (`HarrierJet.Start`/`Update`). It lands on the ground below.
- **Box:** half-width 24, height 20 (design, fitting the 96×64 sprite's body).
- **Flying** (design; the Harrier was never player-driven):
  - piloted, the arrows set a target velocity of 110 horizontally and 80 vertically, reached with an acceleration of
    400 u/s²; no gravity while piloted;
  - it collides with blocks, stays inside the map, and can't rise above its top row;
  - it faces the way it last moved horizontally.
- **X, rockets:** the Harrier's firing pattern (`HarrierJet.Update`), with rockets instead of its heavy bullets as the
  user asked. A pair from (X + dir·32, Y − 5) and (X + dir·8, Y − 5) at (dir·450, −285), plus a random jitter in a
  12 px circle. The first pair leaves on the press; holding fire repeats it every 0.4 s (design: the Harrier's
  0.133 s with rockets would be too strong). Each rocket flies straight and blows up with `RocketBombardment`'s
  values (`stats.bomb`) on a block, an enemy or the end of its life.
- **C, bomb:** a bomb straight down from (X, Y − 4), with the jet's xI and yI −50, falling under gravity. It blows up
  with `stats.bomb` on contact. 0.5 s between bombs (design). Inside the jet, C costs no special.
- **F, out:** Trump drops out from under it (at Y − 15, yI 0), and the empty jet comes straight down at 40 u/s and
  lands.
- **Fuel:** 20 s (design), spent only while piloted and in the air. At 0 it comes down at 40 u/s, lands, and Trump is
  put out beside it. The empty, dry jet then rises off the top of the screen and is removed. A jet that still has
  fuel stays and can be boarded again.
- **Damage:** as the tank.

### Design values

Descent speeds and the fast phase, the box, flying speeds and acceleration, the rocket cadence, the bomb launch and
cooldown, the fuel and the dry jet leaving: all in `constants.ts` under "Design values" and in `docs/findings.md`.

## Render

- Trump's sheet, and the rifle drawn over him from `rifle_gun.png`, centred like the body:
  - frame 0 normally;
  - firing frames 1–3 for a moment after each shot (`gunFrame = 3` counting down, as `FireWeapon` sets);
  - hidden while dead, wall-climbing, flexing, or in a vehicle.
- The jet from `jet_us.png`, flipped by facing, looping its frames slowly; it flashes in its death countdown like the
  tank.
- The rockets use the existing `bomb` sprite, rotated along their velocity; the dropped bomb uses it pointing down.
- HUD: a fuel bar while flying.

## Music

- Flying the jet plays the first source that loads: `/audio/trump_custom.mp3`, then `/audio/anthem_us.ogg`.
- `Music` takes a list of sources and moves to the next on the element's `error` event.
- The tank keeps `/audio/anthem_ru.ogg`. One player per vehicle kind, both driven by `anthemShouldPlay` with the kind
  being driven.
- Same fades, pause and silent-on-failure rules as now.

## UI

- The menu gets a third card; the hints come from the weapon and special maps:
  - rifle: "Fucile d'assalto (raffiche da tre)";
  - jet: "Jet: lancia il segnale e salici sopra (frecce per volare, X razzi, C bomba, F salti giù)".
- Credits: "Inno USA: United States Navy Band (pubblico dominio, via Wikimedia Commons)". The custom sound is the
  user's and isn't credited in the app.

## Error handling

- `game-data/` without the new sheets or values shows the "missing data" screen.
- No custom sound: the US anthem plays. Neither file: silence, no error.

## Testing

- **Extractor:**
  - the Trump and jet palettes;
  - the new values;
  - the US anthem `AudioRef` (offline, like the Russian one's tests);
  - integration: the new sheets and values.
- **Engine:**
  - the rifle's burst timing (3 shots, the last two 0.07 s apart; the next burst after the 0.3 s fireDelay) and the
    bullet origin and speed;
  - jet: the call and descent (fast, then 40 u/s for the last 48 px), landing, boarding;
  - flying: speeds, no gravity, the map top;
  - X: the rocket pair, origin, velocity and the 0.4 s repeat; C: the bomb and its cooldown;
  - fuel: it spends only when airborne and piloted; at 0 it lands, puts Trump out, and the jet leaves;
  - F out; damage and the gib (shared with the tank);
  - the tank's tests unchanged.
- **Music:** fallback to the next source on error; one player per kind.
- **Manual:** re-extract, copy the user's sound in, and play in the browser through REA: Trump firing, calling the
  jet, flying, rockets, bombs, fuel running out; the music level rises while flying.

## Risks

- Generalizing the tank's layer touches tested code. The tank's tests must pass unchanged.
- The meme clip is short (93 KB) and loops for up to 20 s.
