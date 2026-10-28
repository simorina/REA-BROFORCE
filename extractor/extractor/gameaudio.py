"""Broforce's own sounds, read from the local install like its sprites (game-data/ is never committed): every enemy's
voice lines (the arrays of his prefab's SoundHolder that TestVanDammeAnim's Play*Sound methods play) and the level
music (the gameplay Sound Controller's low and high intensity tracks by MusicType, and its boss music). The voices are
written as they decode (WAV); the music, Vorbis in the install, is encoded back to Ogg Vorbis with ffmpeg when it is
there (WAV, ten times the size, when it isn't)."""
import os
import re
import shutil
import subprocess
import tempfile

import UnityPy

from .catalog import VALUES
from .unity import AssetNotFound

# our line -> the SoundHolder array Broforce plays for it
VOICE_FIELDS = {
    "greet": "greeting",  # PolymorphicAI.GreetPlayer: PlayGreetingSound, with his "!"
    "confused": "confused",  # ShowQuestionBubble: PlayConfusedSound, with his "?"
    "attract": "attractSounds",  # ShowQuestionBubble: PlayAttractedSound, drawn in by the flex
    "laugh": "laughSounds",  # LaughAtPlayer: PlayLaughterSound
    "panic": "panic",  # PolymorphicAI.Panic: PlayPanicSound
    "death": "hitSounds",  # TestVanDammeAnim.Damage: PlayDeathSound
    "hurt": "hurtSounds",  # TestVanDammeAnim.Damage: PlayHitSound while he stands
    "charge": "specialSounds",  # SuicideAI.FullyAlert: PlaySpecialSound, the scream as he charges
    "rise": "resurrectSounds",  # UndeadTrooper: PlayResurrectionSound
}
VOICE_OVERRIDES = {"satan": {"laugh": "specialSounds"}}  # Satan laughs with his special sounds (laugh1, 4, 6)
# the enemies whose prefab (catalog VALUES) carries a SoundHolder
VOICE_KINDS = (
    "mook", "mook_suicide", "mook_bazooka", "mook_scout", "mook_shield", "mook_grenadier", "dog", "mook_bruiser",
    "mook_jetpack", "mook_jetpack_bazooka", "mook_ninja", "mook_alarmist", "mook_mortar", "mook_bruiser_elite", "mook_dolph",
    "alien_xeno", "alien_xeno_brain", "alien_hugger", "alien_snake", "alien_melter", "alien_brute", "alien_mosquito",
    "hell_dog", "hell_lostsoul", "hell_boomer", "hell_soulcatcher", "hell_bigguy", "hell_armoured",
    "undead", "undead_suicide", "skinless", "warlock", "satan",
)

# Sound.PlayMusic: the low and high intensity clips of each MusicType on the gameplay Sound Controller
MUSIC = {
    "BroforceDrums": ("lowOriginalMusicClip", "highOriginalMusicClip"),
    "JungleBlueSky": ("lowJungleBlueSkyClip", "highJungleBlueSkyClip"),
    "JungleRedSky": ("lowJungleRedSkyClip", "highJungleRedSkyClip"),
    "Factory": ("lowFactoryClip", "highFactoryClip"),
    "Alien": ("lowAlienClip", "highAlienClip"),
    "Hell": ("lowHellClip", "highHellClip"),
    "Desert": ("lowDesertClip", "highDesertClip"),
}
# Sound.PlayBossPulse: the Goliath's own pulse (BossPulseType.Mech), Dolph's for the universal soldier (Soldier) and the
# victory sting (VictorySting); Epstein, a boss of ours, gets the jungle's boss fight (PlayBossFightMusic, Jungle)
BOSS_MUSIC = {"epstein": "bossFightClipJungle", "goliath": "bossPulseGoliath", "dolph": "bossPulseDolf", "sting": "victorySting"}
SOUND_BUNDLES = ("scenesmain.assetbundle", "sharedsounds.assetbundle")  # the controller's scene, and the clips it points into
SOUND_CONTROLLER = "Sound Controller Gameplay"


def _safe(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]+", "_", name)


def voice_lines(kind: str, holder: dict) -> dict:
    """Our lines from a SoundHolder's arrays (field -> clip files), those it has clips for."""
    fields = {**VOICE_FIELDS, **VOICE_OVERRIDES.get(kind, {})}
    return {line: holder[f] for line, f in fields.items() if holder.get(f)}


def clip_file(name: str, key: tuple, used: dict, folder: str = "audio/voices", ext: str = "wav") -> str:
    """The file a clip (`key`: its asset file and path id) is written to: by its name, numbered when another clip has it."""
    if key in used:
        return used[key]
    base = _safe(name)
    taken = set(used.values())
    rel, n = f"{folder}/{base}.{ext}", 2
    while rel in taken:
        rel, n = f"{folder}/{base}_{n}.{ext}", n + 1
    used[key] = rel
    return rel


def encode_command(ffmpeg: str, src: str, dst: str) -> list:
    return [ffmpeg, "-y", "-loglevel", "error", "-i", src, "-c:a", "libvorbis", "-q:a", "4", dst]


def _wav(clip) -> bytes:
    samples = clip.samples
    if not samples:
        raise AssetNotFound(f"audio clip {clip.m_Name!r} decodes to nothing")
    return next(iter(samples.values()))


def _encode(ffmpeg: str, wav: bytes) -> bytes:
    with tempfile.TemporaryDirectory() as tmp:
        src, dst = os.path.join(tmp, "in.wav"), os.path.join(tmp, "out.ogg")
        with open(src, "wb") as fh:
            fh.write(wav)
        subprocess.run(encode_command(ffmpeg, src, dst), check=True)
        with open(dst, "rb") as fh:
            return fh.read()


def _voices(prefabs, out) -> dict:
    refs = {v.key: v for v in VALUES}
    fields = set(VOICE_FIELDS.values()) | {f for o in VOICE_OVERRIDES.values() for f in o.values()}
    used: dict = {}
    written: set = set()
    voices = {}
    for kind in VOICE_KINDS:
        ref = refs[kind]
        ptr = getattr(prefabs.behaviour(ref.script, ref.gameobject).read(), "soundHolder", None)
        if ptr is None or not ptr.m_PathID:
            continue
        holder_mb = ptr.read()
        holder_name = holder_mb.m_GameObject.read().m_Name
        holder = {}
        for f in sorted(fields):
            files = []
            for clip_ptr in getattr(holder_mb, f, None) or []:
                if not clip_ptr.m_PathID:
                    continue
                reader = clip_ptr.deref()
                clip = reader.read()
                rel = clip_file(clip.m_Name, (reader.assets_file.name, reader.path_id), used)
                if rel not in written:
                    out.write_bytes(rel, _wav(clip), f"AudioClip {clip.m_Name} ({holder_name}.{f})")
                    written.add(rel)
                files.append(rel)
            holder[f] = files
        lines = voice_lines(kind, holder)
        if lines:
            voices[kind] = lines
    return voices


def _music(streaming: str, out, ffmpeg) -> tuple:
    controller = None
    for obj in UnityPy.load(*(os.path.join(streaming, b) for b in SOUND_BUNDLES)).objects:
        if obj.type.name != "MonoBehaviour":
            continue
        try:
            mb = obj.read()
            if mb.m_Script.read().m_ClassName == "Sound" and mb.m_GameObject.read().m_Name == SOUND_CONTROLLER:
                controller = mb
                break
        except Exception:
            continue
    if controller is None:
        raise AssetNotFound(f"{SOUND_CONTROLLER!r} (Sound) in {SOUND_BUNDLES[0]}")
    written: dict = {}

    def track(field: str) -> str:
        ptr = getattr(controller, field, None)
        if ptr is None or not ptr.m_PathID:
            raise AssetNotFound(f"{SOUND_CONTROLLER}: {field} is empty")
        clip = ptr.read()
        if clip.m_Name not in written:
            wav = _wav(clip)
            rel = f"audio/music/{_safe(clip.m_Name)}.{'ogg' if ffmpeg else 'wav'}"
            out.write_bytes(rel, _encode(ffmpeg, wav) if ffmpeg else wav, f"AudioClip {clip.m_Name} ({SOUND_CONTROLLER}.{field})")
            written[clip.m_Name] = rel
        return written[clip.m_Name]

    music = {kind: {"low": track(low), "high": track(high)} for kind, (low, high) in MUSIC.items()}
    boss = {key: track(field) for key, field in BOSS_MUSIC.items()}
    return music, boss


def extract(prefabs, streaming: str, out, ffmpeg=None) -> dict:
    """Writes the voices and the music, and audio.json: voices (kind -> line -> files), music (type -> low/high), boss."""
    ffmpeg = ffmpeg if ffmpeg is not None else shutil.which("ffmpeg")
    voices = _voices(prefabs, out)
    music, boss = _music(streaming, out, ffmpeg)
    table = {"voices": voices, "music": music, "boss": boss}
    out.write_json("audio.json", table, "the enemies' SoundHolders and the gameplay Sound Controller")
    return table
