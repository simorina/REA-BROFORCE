"""Reads prefabs, sprites and textures from Broforce's asset bundles (read only)."""
import os

import UnityPy

from .catalog import BUNDLES


class AssetNotFound(Exception):
    pass


def load_env(streaming_assets: str):
    paths = [os.path.join(streaming_assets, name) for name in BUNDLES]
    missing = [p for p in paths if not os.path.isfile(p)]
    if missing:
        raise AssetNotFound(f"missing bundles: {missing}")
    return UnityPy.load(*paths)


def frame_from_spritesm(tree: dict) -> dict:
    """SpriteSM.lowerLeftPixel is the frame's bottom-left corner, measured from the top of the texture."""
    ll, dims = tree["lowerLeftPixel"], tree["pixelDimensions"]
    w, h = int(dims["x"]), int(dims["y"])
    return {"x": int(ll["x"]), "y_top": int(ll["y"]) - h, "w": w, "h": h, "offset_y": float(tree["offset"]["y"])}


def _component(ptr):
    return ptr.deref() if hasattr(ptr, "deref") else ptr.component


class Prefabs:
    """Index of MonoBehaviours by (script class, GameObject name); the first match wins."""

    def __init__(self, env):
        self._index: dict[tuple[str, str], tuple] = {}
        self._textures: dict[str, object] = {}
        for obj in env.objects:
            if obj.type.name == "Texture2D":
                try:
                    self._textures.setdefault(obj.peek_name(), obj)
                except Exception:
                    pass
            elif obj.type.name == "MonoBehaviour":
                try:
                    mb = obj.read()
                    script = mb.m_Script.read().m_ClassName
                    go = mb.m_GameObject.read()
                except Exception:
                    continue
                self._index.setdefault((script, go.m_Name), (obj, go))

    def _find(self, script: str, gameobject: str):
        try:
            return self._index[(script, gameobject)]
        except KeyError:
            raise AssetNotFound(f"prefab {gameobject!r} with script {script!r}") from None

    def behaviour(self, script: str, gameobject: str):
        """A prefab's MonoBehaviour (its object reader), to follow its PPtr fields."""
        obj, _ = self._find(script, gameobject)
        return obj

    def values(self, script: str, gameobject: str, fields) -> dict:
        obj, _ = self._find(script, gameobject)
        tree = obj.read_typetree()
        missing = [f for f in fields if f not in tree]
        if missing:
            raise AssetNotFound(f"{gameobject!r}: fields {missing} not found on {script}")
        return {f: tree[f] for f in fields}

    def sprite(self, script: str, gameobject: str):
        _, go = self._find(script, gameobject)
        texture, frame = None, None
        for ptr in go.m_Components:
            comp = _component(ptr)
            if comp.type.name == "MeshRenderer" and texture is None:
                for mat_ptr in comp.read().m_Materials:
                    for _, tex_env in mat_ptr.read().m_SavedProperties.m_TexEnvs:
                        if tex_env.m_Texture.m_PathID and texture is None:
                            texture = tex_env.m_Texture.read()
            elif comp.type.name == "MonoBehaviour":
                try:
                    is_sprite = comp.read().m_Script.read().m_ClassName == "SpriteSM"
                except Exception:
                    is_sprite = False
                if is_sprite:
                    frame = frame_from_spritesm(comp.read_typetree())
        if texture is None:
            raise AssetNotFound(f"no texture on prefab {gameobject!r}")
        return texture.image.convert("RGBA"), frame

    def texture(self, name: str):
        try:
            return self._textures[name].read().image.convert("RGBA")
        except KeyError:
            raise AssetNotFound(f"texture {name!r}") from None
