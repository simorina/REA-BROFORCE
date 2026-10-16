"""Putin's tank plays the Russian anthem and Trump's jet the US one. They aren't in Broforce, so they are downloaded
once into game-data/audio/."""
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
ANTHEM_US = AudioRef(
    key="audio/anthem_us.ogg",
    url="https://upload.wikimedia.org/wikipedia/commons/6/65/Star_Spangled_Banner_instrumental.ogg",
    sha256="025bb322eee1e3e2638e2aa3b1b4e8c8e5c3798dca97fc4d059e7a9ab250c654",
    source=("The Star-Spangled Banner, instrumental, by the United States Navy Band; Wikimedia Commons, public "
            "domain (a work of the US government; composition published before 1931)"),
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
