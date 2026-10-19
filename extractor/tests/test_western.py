import io
import wave

from extractor.western import DURATION, RATE, render, wav_bytes


def test_is_eight_bars_at_96_bpm():
    assert DURATION == 20.0
    assert len(render()) == round(DURATION * RATE)


def test_is_loud_but_never_clips():
    peak = max(abs(s) for s in render())
    assert 0.5 < peak <= 0.9


def test_starts_and_ends_silent_so_it_loops_without_a_click():
    s = render()
    assert abs(s[0]) < 1e-3 and abs(s[-1]) < 1e-3


def test_writes_the_same_mono_16_bit_wav_every_time():
    data = wav_bytes()
    with wave.open(io.BytesIO(data)) as w:
        assert (w.getnchannels(), w.getsampwidth(), w.getframerate()) == (1, 2, RATE)
        assert w.getnframes() == round(DURATION * RATE)
    assert wav_bytes() == data
