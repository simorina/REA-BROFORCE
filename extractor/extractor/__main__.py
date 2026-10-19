"""python -m extractor <Broforce_beta_Data dir> <out dir>"""
import argparse
import datetime
import os
import sys

from . import audio, effects, western
from .catalog import SPRITES, TEXTURES, VALUES
from .manifest import OutputWriter
from .repaint import RECIPES, repaint
from .unity import AssetNotFound, Prefabs, load_env


def plain(value):
    return round(value, 4) if isinstance(value, float) else value


def sheet_entry(file: str, width: int, height: int, frame: dict) -> dict:
    return {"file": file, "frameW": frame["w"], "frameH": frame["h"], "offsetY": frame["offset_y"],
            "cols": width // frame["w"], "rows": height // frame["h"]}


def run(data_dir: str, out_dir: str, fetch_audio: bool = True) -> None:
    stale = os.path.join(out_dir, "manifest.json")
    if os.path.exists(stale):
        os.remove(stale)
    prefabs = Prefabs(load_env(os.path.join(data_dir, "StreamingAssets")))
    out = OutputWriter(out_dir)
    sheets: dict[str, dict] = {}
    for ref in SPRITES:
        image, frame = prefabs.sprite(ref.script, ref.gameobject)
        if ref.frame is not None:
            x, y_top, w, h = ref.frame
            frame = {"x": x, "y_top": y_top, "w": w, "h": h, "offset_y": 0.0}
        if frame is None:
            raise AssetNotFound(f"no SpriteSM frame for {ref.gameobject!r}; add a frame override in catalog.py")
        source = f"{ref.gameobject} ({ref.script})"
        file = f"sprites/{ref.key}.png"
        if ref.whole_sheet and ref.strip:
            image = image.crop((0, frame["y_top"], image.width, frame["y_top"] + frame["h"]))
        if ref.whole_sheet:
            out.write_png(file, image, source)
            sheets[ref.key] = sheet_entry(file, image.width, image.height, frame)
        else:
            crop = image.crop((frame["x"], frame["y_top"], frame["x"] + frame["w"], frame["y_top"] + frame["h"]))
            out.write_png(file, crop, source)
            sheets[ref.key] = sheet_entry(file, crop.width, crop.height, frame)
        for recipe in RECIPES:
            if recipe.source == ref.key:
                repainted = f"sprites/{recipe.key}.png"
                out.write_png(repainted, repaint(image, recipe.palette, recipe.hair, recipe.decal, recipe.tone, recipe.star), f"repaint of {source}")
                sheets[recipe.key] = {**sheets[ref.key], "file": repainted}
    for ref in TEXTURES:
        image = prefabs.texture(ref.texture)
        file = f"sprites/{ref.key}.png"
        out.write_png(file, image, f"texture {ref.texture}")
        w, h = ref.frame or (image.height, image.height)
        sheets[ref.key] = sheet_entry(file, image.width, image.height, {"w": w, "h": h, "offset_y": 0.0})
        for recipe in RECIPES:
            if recipe.source == ref.key:
                repainted = f"sprites/{recipe.key}.png"
                out.write_png(repainted, repaint(image, recipe.palette, recipe.hair, recipe.decal, recipe.tone, recipe.star), f"repaint of texture {ref.texture}")
                sheets[recipe.key] = {**sheets[ref.key], "file": repainted}
    values = {}
    for ref in VALUES:
        fields = prefabs.values(ref.script, ref.gameobject, ref.fields)
        values[ref.key] = {"prefab": ref.gameobject, "script": ref.script,
                           **{k: plain(v) for k, v in fields.items()}}
    out.write_json("sheets.json", sheets, "SpriteSM frame grids")
    out.write_json("values.json", values, "prefab MonoBehaviour fields")
    effects.extract(os.path.join(data_dir, "StreamingAssets"), out)
    out.write_bytes("audio/django_western.wav", western.wav_bytes(), "our own spaghetti-western loop, synthesized (extractor/western.py)")
    if fetch_audio:
        for ref in (audio.ANTHEM, audio.ANTHEM_US):
            audio.fetch(ref, out)
    out.finish({"generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(), "dataDir": data_dir})


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="extractor", description="Extract Broforce sprites and prefab values")
    parser.add_argument("data_dir", help="path to Broforce_beta_Data")
    parser.add_argument("out_dir", help="output folder, e.g. ../game-data")
    parser.add_argument("--no-audio", action="store_true", help="skip downloading the anthem")
    args = parser.parse_args(argv)
    try:
        run(args.data_dir, args.out_dir, fetch_audio=not args.no_audio)
    except AssetNotFound as exc:
        print(f"extractor: {exc}", file=sys.stderr)
        return 1
    print(f"extractor: wrote {args.out_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
