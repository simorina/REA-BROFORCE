"""Writes extractor outputs and a manifest (sha256 + source per file). The manifest is written last."""
import hashlib
import io
import json
import os

from PIL import Image


class OutputWriter:
    def __init__(self, out_dir: str):
        self.out_dir = out_dir
        self.entries: dict[str, dict] = {}
        os.makedirs(out_dir, exist_ok=True)

    def _record(self, rel: str, data: bytes, source: str) -> None:
        path = os.path.join(self.out_dir, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as fh:
            fh.write(data)
        self.entries[rel.replace(os.sep, "/")] = {"sha256": hashlib.sha256(data).hexdigest(), "source": source}

    def write_png(self, rel: str, image: Image.Image, source: str) -> None:
        buf = io.BytesIO()
        image.save(buf, format="PNG")
        self._record(rel, buf.getvalue(), source)

    def write_json(self, rel: str, obj, source: str) -> None:
        self._record(rel, json.dumps(obj, indent=2, sort_keys=True).encode("utf-8"), source)

    def write_bytes(self, rel: str, data: bytes, source: str) -> None:
        self._record(rel, data, source)

    def finish(self, meta: dict) -> None:
        manifest = {"version": 1, **meta, "files": dict(sorted(self.entries.items()))}
        with open(os.path.join(self.out_dir, "manifest.json"), "w", encoding="utf-8") as fh:
            json.dump(manifest, fh, indent=2)
