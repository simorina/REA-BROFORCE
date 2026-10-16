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


def test_the_us_anthem_is_pinned():
    from extractor.audio import ANTHEM_US
    assert ANTHEM_US.key == "audio/anthem_us.ogg"
    assert ANTHEM_US.sha256 == "025bb322eee1e3e2638e2aa3b1b4e8c8e5c3798dca97fc4d059e7a9ab250c654"
    assert ANTHEM_US.url.endswith("/6/65/Star_Spangled_Banner_instrumental.ogg")
