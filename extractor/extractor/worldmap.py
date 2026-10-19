"""Broforce's 3D world map (the WorldMap3D scene) for the campaign map: the globe, its props, the helicopter.

The scene's meshes are baked into world space (right-handed, z flipped for three.js) and merged by material:
worldmap/globe.bin holds the vertex arrays and indices, worldmap/globe.json says where each group's arrays are,
with the materials (Custom/Fake3D and friends: textures, colours, floats), the lightmap, the camera, fog and light,
the helicopter and the US flag as models in their own frames, and each territory's direction from the centre.
"""
import json
import math
import os
import re
from array import array

import UnityPy
from UnityPy.helpers.MeshHelper import MeshHandler

from .unity import AssetNotFound

BUNDLES = ("scenesmain.assetbundle", "sharedassets.assetbundle", "sharedtextures.assetbundle")
BUILTIN = os.path.join("..", "Resources", "unity_builtin_extra")  # the built-in shaders some materials use
SCENE = "BuildPlayer-WorldMap3D"
GLOBE_ROOT = "WorldHolder3D"
HELICOPTER = "Helicopter"
HELICOPTER_BODY = "WorldMap_Helicopter"
FLAG_MESH = "USFlag"
# game-state props the campaign doesn't use (WorldTerritory3D toggles them): mooks, aliens, hell, pickups, icons
SKIP_MESHES = re.compile(r"^(standardMook|xeno|xenoTail|alienEgg|Crate 3D|USFlag|hazeMesh|laserMesh|forcefield|pentagram|"
                         r"hemisphere|shockwave|absorb\w*|portal\w*|sandEdge|sandParticle|\w+Mesh|char\w+)\d*$")
SKIP_SHADERS = ("Particles/", "Unlit/", "Mobile/Particles", "Custom/GeneralUI", "Custom/Portal", "Custom/wavingFlag",
                "Custom/TransparentGrass", "Custom/HeatHaze")
OUTLINE = re.compile(r"^([a-z][A-Za-z]*)Outline$")


# ---- maths (Unity's row-major 4x4, column vectors) ----

def trs(pos, rot, scale) -> list:
    """Unity's TRS: translation, quaternion (x, y, z, w), scale."""
    x, y, z, w = rot
    sx, sy, sz = scale
    r = [
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ]
    return [
        [r[0][0] * sx, r[0][1] * sy, r[0][2] * sz, pos[0]],
        [r[1][0] * sx, r[1][1] * sy, r[1][2] * sz, pos[1]],
        [r[2][0] * sx, r[2][1] * sy, r[2][2] * sz, pos[2]],
        [0.0, 0.0, 0.0, 1.0],
    ]


def mat_mul(a: list, b: list) -> list:
    return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]


IDENTITY = trs((0, 0, 0), (0, 0, 0, 1), (1, 1, 1))


def apply_point(m: list, p) -> tuple:
    return tuple(m[i][0] * p[0] + m[i][1] * p[1] + m[i][2] * p[2] + m[i][3] for i in range(3))


def _inverse3(m: list) -> list:
    a, b, c = m[0][:3]
    d, e, f = m[1][:3]
    g, h, i = m[2][:3]
    det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g)
    if abs(det) < 1e-12:
        return [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
    return [
        [(e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det],
        [(f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det],
        [(d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det],
    ]


def apply_dir(m: list, n) -> tuple:
    """A normal through the inverse transpose, unit length."""
    inv = _inverse3(m)
    v = [inv[0][i] * n[0] + inv[1][i] * n[1] + inv[2][i] * n[2] for i in range(3)]
    length = math.sqrt(sum(c * c for c in v)) or 1.0
    return tuple(c / length for c in v)


def right_handed(v) -> tuple:
    return (v[0], v[1], -v[2])


def lightmap_uv(uv, st) -> tuple:
    """Renderer.lightmapScaleOffset: uv * (x, y) + (z, w)."""
    return (uv[0] * st[0] + st[2], uv[1] * st[1] + st[3])


QUEUES = {"Background": 1000, "Geometry": 2000, "AlphaTest": 2450, "Transparent": 3000, "Overlay": 4000}


def queue_order(tag) -> int:
    """A SubShader's "Queue" tag as Unity's number: "Transparent-15" is 2985."""
    m = re.match(r"^([A-Za-z]+)([+-]\d+)?$", tag or "")
    if not m or m.group(1) not in QUEUES:
        return QUEUES["Geometry"]
    return QUEUES[m.group(1)] + int(m.group(2) or 0)


def color_bytes(c) -> tuple:
    """A vertex colour (0..1 floats) as RGBA bytes; white when the mesh has none."""
    if c is None:
        return (255, 255, 255, 255)
    return tuple(max(0, min(255, int(round(v * 255)))) for v in c[:4])


def territory_of(mesh_name: str):
    m = OUTLINE.match(mesh_name or "")
    return m.group(1) if m else None


# ---- the scene ----

def _comps(go) -> dict:
    out = {}
    for c in go.m_Components:
        cc = c.deref() if hasattr(c, "deref") else c.component
        tn = cc.type.name
        out.setdefault(tn, cc)
    return out


def _local(tr) -> list:
    p, r, s = tr.m_LocalPosition, tr.m_LocalRotation, tr.m_LocalScale
    return trs((p.x, p.y, p.z), (r.x, r.y, r.z, r.w), (s.x, s.y, s.z))


class _Scene:
    def __init__(self, streaming_assets: str):
        paths = [os.path.join(streaming_assets, n) for n in BUNDLES]
        builtin = os.path.normpath(os.path.join(streaming_assets, BUILTIN))
        if os.path.isfile(builtin):
            paths.append(builtin)
        missing = [p for p in paths if not os.path.isfile(p)]
        if missing:
            raise AssetNotFound(f"missing bundles: {missing}")
        self.env = UnityPy.load(*paths)
        self.objects = [o for o in self.env.objects if o.assets_file.name == SCENE]
        if not self.objects:
            raise AssetNotFound(f"scene {SCENE} not found")
        self._world: dict[int, list] = {}

    def world(self, tr) -> list:
        key = tr.object_reader.path_id
        if key not in self._world:
            parent = tr.m_Father.read() if tr.m_Father.m_PathID else None
            self._world[key] = mat_mul(self.world(parent), _local(tr)) if parent is not None else _local(tr)
        return self._world[key]

    @staticmethod
    def path(tr) -> list:
        names = []
        t = tr
        while t is not None:
            names.append(t.m_GameObject.read().m_Name)
            t = t.m_Father.read() if t.m_Father.m_PathID else None
        return list(reversed(names))

    @staticmethod
    def active(tr) -> bool:
        t = tr
        while t is not None:
            if not t.m_GameObject.read().m_IsActive:
                return False
            t = t.m_Father.read() if t.m_Father.m_PathID else None
        return True


def _shader_name(mat):
    try:
        sh = mat.m_Shader.read()
        return sh.m_ParsedForm.m_Name if getattr(sh, "m_ParsedForm", None) else sh.m_Name
    except Exception:
        return None


def _val(x):
    return getattr(x, "val", x)


def _shader_state(mat) -> dict:
    """The first pass's blend, depth write and culling, and the render queue (the material's own if it sets one)."""
    state = {"blend": [1, 0], "zWrite": True, "cull": 2, "queue": QUEUES["Geometry"]}
    try:
        pf = mat.m_Shader.read().m_ParsedForm
        sub = pf.m_SubShaders[0]
        st = sub.m_Passes[0].m_State
        b = st.rtBlend0 if hasattr(st, "rtBlend0") else st.m_RtBlend[0]
        tags = {t[0].upper(): t[1] for t in sub.m_Tags.tags}
        state = {"blend": [int(_val(b.srcBlend.val)), int(_val(b.destBlend.val))], "zWrite": bool(_val(st.zWrite.val)),
                 "cull": int(_val(st.culling.val)), "queue": queue_order(tags.get("QUEUE"))}
    except Exception:
        pass
    custom = getattr(mat, "m_CustomRenderQueue", -1)
    if custom is not None and custom >= 0:
        state["queue"] = custom
    return state


class _Writer:
    """Groups of merged geometry (world space, right-handed) and the materials and textures they use."""

    def __init__(self, out):
        self.out = out
        self.bin = bytearray()
        self.materials: list[dict] = []
        self.material_index: dict[str, int] = {}
        self.textures: dict[str, str] = {}

    def texture(self, tex) -> str:
        name = tex.m_Name
        if name not in self.textures:
            rel = f"worldmap/{re.sub(r'[^A-Za-z0-9_.-]', '_', name)}.png"
            self.out.write_png(rel, tex.image.convert("RGBA"), f"world map texture {name}")
            self.textures[name] = rel
        return self.textures[name]

    def material(self, mat) -> int:
        name = mat.m_Name
        if name in self.material_index:
            return self.material_index[name]
        props = mat.m_SavedProperties
        textures = {}
        for pname, env in props.m_TexEnvs:
            if not env.m_Texture.m_PathID:
                continue
            try:
                t = env.m_Texture.read()
                if t.object_reader.type.name != "Texture2D":
                    continue  # a cubemap (the water's reflection): left out
                textures[pname] = {"file": self.texture(t), "st": [round(v, 6) for v in
                                                                  (env.m_Scale.x, env.m_Scale.y, env.m_Offset.x, env.m_Offset.y)]}
            except Exception:
                continue
        main = textures.get("_MainTex", {"file": None, "st": [1.0, 1.0, 0.0, 0.0]})
        entry = {
            "name": name, "shader": _shader_name(mat), "texture": main["file"], "st": main["st"], "textures": textures,
            "state": _shader_state(mat),
            "colors": {n: [round(c.r, 4), round(c.g, 4), round(c.b, 4), round(c.a, 4)] for n, c in props.m_Colors},
            "floats": {n: round(v, 6) for n, v in props.m_Floats},
        }
        self.material_index[name] = len(self.materials)
        self.materials.append(entry)
        return self.material_index[name]

    def _array(self, kind: str, values) -> int:
        while len(self.bin) % 4:
            self.bin.append(0)
        offset = len(self.bin)
        self.bin += array(kind, values).tobytes()
        return offset

    def group(self, geo: "_Geometry", material: int, lightmapped: bool) -> dict:
        return {
            "material": material, "lightmapped": lightmapped, "vertexCount": len(geo.pos) // 3, "indexCount": len(geo.idx),
            "position": self._array("f", geo.pos), "normal": self._array("f", geo.nrm), "uv": self._array("f", geo.uv),
            "uv2": self._array("f", geo.uv2) if lightmapped else None, "index": self._array("I", geo.idx),
            "color": self._array("B", geo.col) if geo.has_color else None,
        }


class _Geometry:
    def __init__(self):
        self.pos: list[float] = []
        self.nrm: list[float] = []
        self.uv: list[float] = []
        self.uv2: list[float] = []
        self.col: list[int] = []
        self.has_color = False
        self.idx: list[int] = []

    def add(self, mesh: MeshHandler, triangles, matrix: list, lightmap_st=None) -> None:
        """Copy the triangles' vertices (through `matrix`, then into right-handed space) and reverse their winding."""
        remap: dict[int, int] = {}
        verts, norms = mesh.m_Vertices, mesh.m_Normals
        uv0, uv1, colors = mesh.m_UV0, mesh.m_UV1, mesh.m_Colors
        if colors:
            self.has_color = True
        for tri in triangles:
            out = []
            for i in tri:
                if i not in remap:
                    remap[i] = len(self.pos) // 3
                    self.pos += right_handed(apply_point(matrix, verts[i]))
                    n = norms[i][:3] if norms else (0.0, 1.0, 0.0)
                    self.nrm += right_handed(apply_dir(matrix, n))
                    self.uv += uv0[i] if uv0 else (0.0, 0.0)
                    self.col += color_bytes(colors[i] if colors else None)
                    if lightmap_st is not None:
                        luv = uv1[i] if uv1 else (uv0[i] if uv0 else (0.0, 0.0))
                        self.uv2 += lightmap_uv(luv, lightmap_st)
                out.append(remap[i])
            self.idx += (out[0], out[2], out[1])


def _mesh_handler(mesh, cache: dict):
    key = mesh.object_reader.path_id
    if key not in cache:
        h = MeshHandler(mesh)
        h.process()
        tris = h.get_triangles()
        bases = [getattr(sm, "baseVertex", 0) or 0 for sm in mesh.m_SubMeshes]
        cache[key] = (h, [[tuple(i + base for i in t) for t in sub] for sub, base in zip(tris, bases)])
    return cache[key]


def _renderer_parts(scene: _Scene, root: str):
    """(path, renderer, mesh, transform) for each active, enabled MeshRenderer under the root GameObject."""
    for o in scene.objects:
        if o.type.name != "MeshRenderer":
            continue
        r = o.read()
        go = r.m_GameObject.read()
        cs = _comps(go)
        tr = cs["Transform"].read()
        path = scene.path(tr)
        if path[0] != root or not r.m_Enabled or not scene.active(tr):
            continue
        mf = cs.get("MeshFilter")
        if mf is None:
            continue
        try:
            mesh = mf.read().m_Mesh.read() if mf.read().m_Mesh.m_PathID else None
        except FileNotFoundError:
            mesh = None  # a built-in mesh (quad, cube) from unity default resources
        if mesh is not None:
            yield path, r, mesh, tr


def _wanted(mesh_name: str, go_name: str, shader) -> bool:
    if SKIP_MESHES.match(mesh_name or "") or SKIP_MESHES.match(go_name or ""):
        return False
    return not (shader and shader.startswith(SKIP_SHADERS))


def _globe(scene: _Scene, w: _Writer, cache: dict):
    groups: dict[tuple, _Geometry] = {}
    territories: dict[str, list] = {}
    for path, r, mesh, tr in _renderer_parts(scene, GLOBE_ROOT):
        go_name = path[-1]
        h, subs = _mesh_handler(mesh, cache)
        sbi = r.m_StaticBatchInfo
        batched = sbi.subMeshCount > 0
        first = sbi.firstSubMesh if batched else 0
        count = sbi.subMeshCount if batched else len(subs)
        matrix = IDENTITY if batched else scene.world(tr)  # static batching baked the vertices into world space
        name = territory_of(mesh.m_Name)
        if name:  # the territory's centre, seen from the globe's
            pts = [apply_point(matrix, v) for v in h.m_Vertices]
            c = [sum(p[k] for p in pts) / len(pts) for k in range(3)]
            length = math.sqrt(sum(v * v for v in c)) or 1.0
            territories[name] = [round(v / length, 6) for v in right_handed(c)]
        lightmapped = r.m_LightmapIndex == 0
        st = r.m_LightmapTilingOffset
        lst = (st.x, st.y, st.z, st.w) if lightmapped else None
        mats = list(r.m_Materials)
        for k in range(count):
            if not mats:
                break
            try:
                mat = mats[min(k, len(mats) - 1)].read()
            except Exception:
                continue
            if not _wanted(mesh.m_Name, go_name, _shader_name(mat)):
                continue
            mi = w.material(mat)
            key = (mi, lightmapped)
            groups.setdefault(key, _Geometry()).add(h, subs[first + k], matrix, lst)
    return [w.group(g, mi, lm) for (mi, lm), g in groups.items()], territories


def _model(scene: _Scene, w: _Writer, cache: dict, parts, body_matrix: list) -> list:
    """Meshes in the frame of `body_matrix`, each with its own local matrix (so rotors can spin)."""
    inv = _inverse4(body_matrix)
    out = []
    for path, r, mesh, tr in parts:
        h, subs = _mesh_handler(mesh, cache)
        local = mat_mul(inv, scene.world(tr))
        mats = list(r.m_Materials)
        for k, tris in enumerate(subs):
            if not mats:
                break
            mat = mats[min(k, len(mats) - 1)].read()
            geo = _Geometry()
            geo.add(h, tris, IDENTITY)
            g = w.group(geo, w.material(mat), False)
            g["name"] = path[-1]
            g["matrix"] = _right_handed_matrix(local)
            out.append(g)
    return out


def _inverse4(m: list) -> list:
    inv3 = _inverse3(m)
    t = [m[0][3], m[1][3], m[2][3]]
    it = [-sum(inv3[i][k] * t[k] for k in range(3)) for i in range(3)]
    return [inv3[0] + [it[0]], inv3[1] + [it[1]], inv3[2] + [it[2]], [0.0, 0.0, 0.0, 1.0]]


def _right_handed_matrix(m: list) -> list:
    """The same transform with z flipped on both sides (S M S, S = diag(1, 1, -1)), as 16 numbers column-major."""
    s = [1, 1, -1, 1]
    rh = [[m[i][j] * s[i] * s[j] for j in range(4)] for i in range(4)]
    return [round(rh[i][j], 6) for j in range(4) for i in range(4)]


def _find(scene: _Scene, cls: str, go_name: str):
    for o in scene.objects:
        if o.type.name == cls:
            r = o.read()
            if r.m_GameObject.read().m_Name == go_name:
                return r
    raise AssetNotFound(f"{cls} on {go_name!r} in {SCENE}")


def _behaviour(scene: _Scene, script: str) -> dict:
    for o in scene.objects:
        if o.type.name != "MonoBehaviour":
            continue
        try:
            if o.read().m_Script.read().m_ClassName == script:
                return o.read_typetree()
        except Exception:
            continue
    raise AssetNotFound(f"{script} in {SCENE}")


def _settings(scene: _Scene, w: _Writer) -> dict:
    cam = _behaviour(scene, "WorldCamera")
    heli = _behaviour(scene, "Helicopter3D")
    main = _find(scene, "Camera", "Main Camera")
    light = _find(scene, "Light", "Directional light")
    ltr = _comps(light.m_GameObject.read())["Transform"].read()
    forward = right_handed(apply_dir(scene.world(ltr), (0, 0, 1)))
    rs = next(o.read_typetree() for o in scene.objects if o.type.name == "RenderSettings")
    lm = next(o.read() for o in scene.objects if o.type.name == "LightmapSettings").m_Lightmaps[0].m_Lightmap.read()
    w.out.write_png("worldmap/lightmap.png", lm.image.convert("RGBA"), f"world map lightmap {lm.m_Name} (RGBM)")
    bg = main.m_BackGroundColor
    fog = rs["m_FogColor"]
    return {
        "camera": {"height": cam["CameraHeight"], "fovOut": cam["ZoomOut"], "fovIn": cam["ZoomIn"],
                   "near": main.m_NearClip if hasattr(main, "m_NearClip") else 0.3,
                   "far": main.m_FarClip if hasattr(main, "m_FarClip") else 18.0,
                   "background": [round(bg.r, 4), round(bg.g, 4), round(bg.b, 4)]},
        "fog": {"color": [round(fog["r"], 4), round(fog["g"], 4), round(fog["b"], 4)],
                "start": rs["m_LinearFogStart"], "end": rs["m_LinearFogEnd"]},
        "light": {"towards": [round(-v, 6) for v in forward], "intensity": light.m_Intensity},
        "lightmap": {"file": "worldmap/lightmap.png"},
        "helicopter3d": {k: heli[k] for k in ("heightOffGround", "angularMoveSpeed", "bankDegrees", "MaxHeightAngle",
                                              "MinHeightAngle", "LandingOffset")},
    }


def extract(streaming_assets: str, out) -> None:
    scene = _Scene(streaming_assets)
    w = _Writer(out)
    cache: dict = {}
    data = _settings(scene, w)
    groups, territories = _globe(scene, w, cache)
    heli_parts = list(_renderer_parts(scene, HELICOPTER))
    body = next(p for p in heli_parts if p[0][-1] == HELICOPTER_BODY)
    helicopter = _model(scene, w, cache, heli_parts, scene.world(body[3]))
    flag_part = next(((p, r, m, t) for p, r, m, t in _all_renderers(scene) if (m.m_Name or "").startswith(FLAG_MESH)), None)
    flag = _model(scene, w, cache, [flag_part], scene.world(flag_part[3])) if flag_part else []
    globe_water = next(o.read() for o in scene.env.objects if o.type.name == "Mesh" and o.peek_name() == "globeWater")
    data.update({
        "radius": round(globe_water.m_LocalAABB.m_Extent.x, 4),
        "materials": w.materials, "groups": groups, "territories": territories,
        "models": {"helicopter": helicopter, "flag": flag},
        "icons": {k: w.texture(_texture(scene, n)) for k, n in (("terror", "WorldMap Terror Icon"), ("arrow", "WorldmapArrow"),
                                                                 ("glow", "worldGlow"))},
    })
    out.write_bytes("worldmap/globe.bin", bytes(w.bin), "world map geometry (WorldMap3D)")
    out.write_json("worldmap/globe.json", data, "world map scene (WorldMap3D)")


def _all_renderers(scene: _Scene):
    for o in scene.objects:
        if o.type.name != "MeshRenderer":
            continue
        r = o.read()
        cs = _comps(r.m_GameObject.read())
        mf = cs.get("MeshFilter")
        if mf is None:
            continue
        try:
            mesh = mf.read().m_Mesh.read() if mf.read().m_Mesh.m_PathID else None
        except FileNotFoundError:
            continue
        if mesh is not None:
            tr = cs["Transform"].read()
            yield scene.path(tr), r, mesh, tr


def _texture(scene: _Scene, name: str):
    for o in scene.env.objects:
        if o.type.name == "Texture2D":
            try:
                if o.peek_name() == name:
                    return o.read()
            except Exception:
                continue
    raise AssetNotFound(f"texture {name!r}")
