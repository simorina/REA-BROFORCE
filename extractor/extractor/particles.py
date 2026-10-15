"""Unity ParticleSystem (Shuriken) prefabs, written as data the web build simulates and shades itself.

Broforce's explosions (EffectsController.CreateShaderExplosion) and the plumes' fire trails are
ParticleSystem hierarchies drawn with the Unlit/PixelExplosion shader. Each system is flattened depth first
with its parent's index, its local position and the modules it uses: main (duration, looping, start delay,
simulation space), InitialModule, ShapeModule, EmissionModule, Size/Rotation/Velocity/Force/ClampVelocity
over lifetime, SubModule (by system index) and CustomDataModule, plus the renderer's sort mode, vertex
streams and material (main texture, colour ramp, _Brightness, _WorldToPixel).

Curves (MinMaxCurve) are {mode, scalar, min, maxCurve, minCurve} with keys [time, value, inSlope, outSlope].
The shader reads the textures' four channels as data, so each is written as an opaque PNG twice as wide:
RGB on the left, alpha (as grey) on the right; a browser canvas then hands back the exact bytes.
"""
from PIL import Image

from .unity import AssetNotFound

MAX_DUMP = 64  # keys per curve; Unity's own editor caps curves far below this


def _keys(curve: dict) -> list:
    keys = curve.get("m_Curve", [])[:MAX_DUMP]
    return [[round(k["time"], 5), round(k["value"], 5), round(k["inSlope"], 5), round(k["outSlope"], 5)] for k in keys]


def mmc(c: dict) -> dict:
    """A MinMaxCurve: 0 constant (scalar), 1 curve x scalar, 2 between two curves x scalar, 3 between min and scalar."""
    return {"mode": c["minMaxState"], "scalar": round(c["scalar"], 5), "min": round(c["minScalar"], 5),
            "maxCurve": _keys(c["maxCurve"]), "minCurve": _keys(c["minCurve"])}


def _vec(v: dict) -> list:
    return [round(v["x"], 5), round(v["y"], 5), round(v["z"], 5)]


def _shape(s: dict) -> dict:
    return {
        "type": s["type"], "radius": round(s["radius"]["value"], 5), "radiusThickness": round(s["radiusThickness"], 5),
        "arc": round(s["arc"]["value"], 5), "arcMode": s["arc"]["mode"], "arcSpread": round(s["arc"]["spread"], 5),
        "angle": round(s["angle"], 5), "length": round(s["length"], 5), "position": _vec(s["m_Position"]),
        "rotation": _vec(s["m_Rotation"]), "scale": _vec(s["m_Scale"]),
        "randomDirection": round(s["randomDirectionAmount"], 5), "sphericalDirection": round(s["sphericalDirectionAmount"], 5),
        "alignToDirection": bool(s["alignToDirection"]),
    }


def _burst(b: dict) -> dict:
    if "countCurve" in b:
        count = mmc(b["countCurve"])
    else:  # older layout: a min/max count pair
        count = {"mode": 3, "scalar": b["maxCount"], "min": b["minCount"], "maxCurve": [], "minCurve": []}
    return {"time": round(b["time"], 5), "count": count, "cycles": b.get("cycleCount", 1),
            "interval": round(b.get("repeatInterval", 0.01), 5)}


class SystemWriter:
    """Flattens one prefab's ParticleSystems and collects the textures their materials use."""

    def __init__(self, scene, textures: dict):
        self.scene = scene
        self.textures = textures  # texture name -> {"file", "w", "h"}, shared across prefabs

    def texture(self, tex) -> str:
        name = tex.m_Name
        if name not in self.textures:
            rgba = tex.image.convert("RGBA")
            w, h = rgba.size
            packed = Image.new("RGB", (w * 2, h))
            packed.paste(rgba.convert("RGB"), (0, 0))
            alpha = rgba.getchannel("A")
            packed.paste(Image.merge("RGB", (alpha, alpha, alpha)), (w, 0))
            rel = f"sprites/shuriken/{name}.png"
            self.scene.out.write_png(rel, packed, f"texture {name}, RGB | alpha packed side by side")
            self.textures[name] = {"file": rel, "w": w, "h": h}
        return name

    def material(self, renderer) -> dict:
        for m in renderer.read().m_Materials:
            if not m.m_PathID:
                continue
            mat = m.read()
            floats = dict(mat.m_SavedProperties.m_Floats)
            texs = {}
            for name, te in mat.m_SavedProperties.m_TexEnvs:
                if te.m_Texture.m_PathID:
                    texs[name] = self.texture(te.m_Texture.read())
            if "_MainTex" not in texs or "_Ramp" not in texs:
                raise AssetNotFound(f"material {mat.m_Name} lacks _MainTex or _Ramp")
            shader = mat.m_Shader.read().m_ParsedForm.m_Name
            if shader != "Unlit/PixelExplosion":
                raise AssetNotFound(f"material {mat.m_Name} uses {shader}, not Unlit/PixelExplosion")
            return {"name": mat.m_Name, "mainTex": texs["_MainTex"], "ramp": texs["_Ramp"],
                    "brightness": round(floats.get("_Brightness", 1.0), 5),
                    "worldToPixel": round(floats.get("_WorldToPixel", 1.0), 5)}
        raise AssetNotFound("particle renderer has no material")

    def tree(self, go) -> list:
        systems: list = []
        ids: dict = {}
        self._walk(go, -1, systems, ids)
        for s in systems:
            for sub in s.get("sub", []):
                sub["system"] = ids.get(sub.pop("pathId"))
                if sub["system"] is None:
                    raise AssetNotFound(f"{s['name']}: sub-emitter outside its prefab")
                systems[sub["system"]]["isSub"] = True
        return systems

    def _walk(self, go, parent: int, systems: list, ids: dict) -> None:
        comps = self.scene.components(go)
        tr = comps["Transform"].read()
        index = parent
        if "ParticleSystem" in comps:
            ps = comps["ParticleSystem"]
            ids[ps.path_id] = len(systems)
            index = len(systems)
            systems.append(self._system(go.m_Name, parent, tr, ps.read_typetree(), comps["ParticleSystemRenderer"]))
        for ch in tr.m_Children:
            self._walk(ch.read().m_GameObject.read(), index, systems, ids)

    def _system(self, name: str, parent: int, tr, tt: dict, renderer) -> dict:
        im = tt["InitialModule"]
        out = {
            "name": name, "parent": parent, "isSub": False,
            "position": [round(tr.m_LocalPosition.x, 5), round(tr.m_LocalPosition.y, 5), round(tr.m_LocalPosition.z, 5)],
            "duration": round(tt["lengthInSec"], 5), "looping": bool(tt["looping"]), "startDelay": mmc(tt["startDelay"]),
            "worldSpace": tt["moveWithTransform"] == 1, "simulationSpeed": round(tt["simulationSpeed"], 5),
            "initial": {
                "lifetime": mmc(im["startLifetime"]), "speed": mmc(im["startSpeed"]), "size": mmc(im["startSize"]),
                "sizeY": mmc(im["startSizeY"]), "size3D": bool(im["size3D"]), "rotation": mmc(im["startRotation"]),
                "gravity": mmc(im["gravityModifier"]), "maxParticles": im["maxNumParticles"],
            },
            "shape": _shape(tt["ShapeModule"]) if tt["ShapeModule"]["enabled"] else None,
        }
        em = tt["EmissionModule"]
        # a sub-emitter's own emission is switched off in the editor; its bursts still say what it emits
        out["emission"] = {"enabled": bool(em["enabled"]), "rate": mmc(em["rateOverTime"]),
                           "rateOverDistance": mmc(em["rateOverDistance"]), "bursts": [_burst(b) for b in em["m_Bursts"]]}
        mods = {
            "SizeModule": lambda m: {"curve": mmc(m["curve"]), "y": mmc(m["y"]), "separateAxes": bool(m["separateAxes"])},
            "RotationModule": lambda m: {"curve": mmc(m["curve"])},
            "VelocityModule": lambda m: {"x": mmc(m["x"]), "y": mmc(m["y"]), "worldSpace": bool(m["inWorldSpace"]),
                                         "speedModifier": mmc(m["speedModifier"]) if "speedModifier" in m else None},
            "ForceModule": lambda m: {"x": mmc(m["x"]), "y": mmc(m["y"]), "worldSpace": bool(m["inWorldSpace"]),
                                      "randomizePerFrame": bool(m["randomizePerFrame"])},
            "ClampVelocityModule": lambda m: {"magnitude": mmc(m["magnitude"]), "x": mmc(m["x"]), "y": mmc(m["y"]),
                                              "separateAxis": bool(m["separateAxis"]), "dampen": round(m["dampen"], 5),
                                              "drag": mmc(m["drag"]) if isinstance(m.get("drag"), dict) else None},
        }
        keys = {"SizeModule": "size", "RotationModule": "rotation", "VelocityModule": "velocity", "ForceModule": "force",
                "ClampVelocityModule": "clamp"}
        for mod, fn in mods.items():
            m = tt[mod]
            out[keys[mod]] = fn(m) if m["enabled"] else None
        sub = tt["SubModule"]
        out["sub"] = []
        if sub["enabled"]:
            for s in sub["subEmitters"]:
                if s["emitter"]["m_PathID"]:
                    out["sub"].append({"pathId": s["emitter"]["m_PathID"], "type": s["type"], "properties": s["properties"]})
        cd = tt["CustomDataModule"]
        custom = []
        for i in (0, 1):
            if cd["enabled"] and cd[f"mode{i}"] == 1:
                n = cd[f"vectorComponentCount{i}"]
                custom.append([mmc(cd[f"vector{i}_{k}"]) for k in range(n)])
            else:
                custom.append([])
        out["custom"] = custom
        rt = renderer.read_typetree()
        out["renderer"] = {"sortMode": rt["m_SortMode"], "streams": list(rt["m_VertexStreams"]),
                           "sortingFudge": round(rt["m_SortingFudge"], 5), "material": self.material(renderer)}
        return out
