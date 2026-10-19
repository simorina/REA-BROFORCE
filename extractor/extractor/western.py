"""Our own spaghetti-western loop for Samuel's Django mode, synthesized here (no recording is used or copied).

A whistled tune in D minor over a twangy guitar arpeggio, a plucked bass and a whip crack, eight bars at 96 bpm.
The game plays the user's own `audio/django_custom.mp3` when there is one, and this loop otherwise.
"""
import io
import math
import random
import struct
import wave
from functools import lru_cache

RATE = 22050
BPM = 96
BEAT = 60 / BPM
BARS = 8
DURATION = BARS * 4 * BEAT  # 20 s

# (MIDI note or None for a rest, beats): D4 = 62
MELODY = [
    (69, 1.5), (74, 0.5), (72, 1), (69, 1),
    (65, 1), (67, 1), (69, 2),
    (69, 1), (72, 1), (74, 1), (76, 1),
    (77, 1.5), (76, 0.5), (74, 2),
    (74, 1), (72, 1), (70, 1), (69, 1),
    (67, 1.5), (69, 0.5), (70, 2),
    (69, 1), (67, 1), (65, 1), (64, 1),
    (62, 3), (None, 1),
]
# a guitar voicing per bar: Dm Dm C Dm Bb Gm A Dm
CHORDS = [(50, 57, 62, 65), (50, 57, 62, 65), (48, 55, 60, 64), (50, 57, 62, 65),
          (46, 53, 58, 62), (43, 50, 55, 58), (45, 52, 57, 61), (50, 57, 62, 65)]
ARPEGGIO = (0, 1, 2, 3, 2, 1, 2, 1)  # chord tones on the eighths of a bar
WHIPS = (3 * 4 + 3.5, 7 * 4 + 2.5)  # beats where the whip cracks


def _freq(note: int) -> float:
    return 440.0 * 2 ** ((note - 69) / 12)


def _whistle(buf: list, start: float, beats: float, note: int) -> None:
    f = _freq(note)
    n0, n = int(start * RATE), int(beats * BEAT * RATE)
    attack, release = 0.04 * RATE, 0.12 * RATE
    phase = 0.0
    for i in range(n):
        if n0 + i >= len(buf):
            break
        t = i / RATE
        vib = 1 + 0.006 * math.sin(2 * math.pi * 5.5 * t) * min(1.0, t / 0.25)  # the vibrato comes in on long notes
        phase += 2 * math.pi * f * vib / RATE
        env = min(1.0, i / attack, (n - i) / release)
        buf[n0 + i] += 0.3 * env * (math.sin(phase) + 0.06 * math.sin(2 * phase))


def _pluck(buf: list, start: float, note: int, amp: float, decay: float, rng: random.Random, seconds: float = 0.9) -> None:
    """Karplus-Strong: a burst of noise through a delay line the length of the string, averaged as it goes round."""
    period = max(2, int(RATE / _freq(note)))
    line = [rng.uniform(-1, 1) for _ in range(period)]
    n0 = int(start * RATE)
    for i in range(int(seconds * RATE)):
        if n0 + i >= len(buf):
            break
        j = i % period
        out = line[j]
        line[j] = decay * 0.5 * (out + line[(j + 1) % period])
        buf[n0 + i] += amp * out


def _whip(buf: list, start: float, rng: random.Random) -> None:
    n0, prev = int(start * RATE), 0.0
    for i in range(int(0.18 * RATE)):
        if n0 + i >= len(buf):
            break
        noise = rng.uniform(-1, 1)
        buf[n0 + i] += 0.2 * math.exp(-i / (0.03 * RATE)) * (noise - prev)  # a crack: high-passed, fast decay
        prev = noise


@lru_cache(maxsize=1)
def render() -> tuple:
    rng = random.Random(1966)
    buf = [0.0] * round(DURATION * RATE)
    beat = 0.0
    for note, beats in MELODY:
        if note is not None:
            _whistle(buf, beat * BEAT, beats, note)
        beat += beats
    for bar, chord in enumerate(CHORDS):
        for k, tone in enumerate(ARPEGGIO):
            _pluck(buf, (bar * 4 + k * 0.5) * BEAT, chord[tone], 0.16, 0.996, rng)
        for b in (0, 2):
            _pluck(buf, (bar * 4 + b) * BEAT, chord[0] - 12, 0.28, 0.998, rng, 1.2)
    for b in WHIPS:
        _whip(buf, b * BEAT, rng)
    fade_in, fade_out = int(0.01 * RATE), int(0.05 * RATE)
    for i in range(fade_in):
        buf[i] *= i / fade_in
    for i in range(fade_out):
        buf[-1 - i] *= i / fade_out
    peak = max(abs(s) for s in buf) or 1.0
    return tuple(s * 0.89 / peak for s in buf)


def wav_bytes() -> bytes:
    out = io.BytesIO()
    with wave.open(out, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b"".join(struct.pack("<h", int(round(s * 32767))) for s in render()))
    return out.getvalue()
