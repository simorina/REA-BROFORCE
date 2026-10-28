from extractor.catalog import VALUES
from extractor.gameaudio import BOSS_MUSIC, MUSIC, VOICE_ALIASES, VOICE_KINDS, clip_file, encode_command, voice_lines


def test_a_holders_arrays_become_our_voice_lines_and_satan_laughs_with_his_special_sounds():
    holder = {"greeting": ["hah"], "confused": ["huh"], "hitSounds": ["bleh"], "hurtSounds": [], "specialSounds": ["laugh1"],
              "laughSounds": [], "deathSounds": ["splat"]}
    assert voice_lines("mook", holder) == {"greet": ["hah"], "confused": ["huh"], "death": ["bleh"], "charge": ["laugh1"]}
    assert voice_lines("satan", holder)["laugh"] == ["laugh1"]


def test_every_voiced_enemy_has_its_prefab_in_the_catalog():
    keys = {v.key for v in VALUES}
    assert set(VOICE_KINDS) <= keys
    assert {"mook", "mook_suicide", "mook_bruiser", "dog", "alien_xeno", "undead", "warlock", "satan"} <= set(VOICE_KINDS)
    assert VOICE_ALIASES["alien_xeno_brain"] == "alien_xeno"  # the brain-box xenomorph has no prefab of its own


def test_the_music_by_type_and_the_bosses_as_the_gameplay_sound_controller_assigns_them():
    assert MUSIC["Desert"] == ("lowDesertClip", "highDesertClip")
    assert set(MUSIC) == {"BroforceDrums", "JungleBlueSky", "JungleRedSky", "Factory", "Alien", "Hell", "Desert"}
    assert BOSS_MUSIC == {"epstein": "bossFightClipJungle", "goliath": "bossFightClipFinal", "dolph": "bossPulseDolf",
                          "sting": "bossVictoryClipJungle"}


def test_clips_named_alike_get_files_of_their_own():
    used: dict = {}
    first = clip_file("Death1 Short", ("CAB-a", 1), used)
    assert first == "audio/voices/Death1_Short.wav"
    assert clip_file("Death1 Short", ("CAB-a", 1), used) == first
    assert clip_file("Death1 Short", ("CAB-b", 7), used) == "audio/voices/Death1_Short_2.wav"


def test_the_music_is_encoded_to_ogg_vorbis_by_ffmpeg():
    cmd = encode_command("ffmpeg", "in.wav", "out.ogg")
    assert cmd[0] == "ffmpeg" and "libvorbis" in cmd and cmd[-1] == "out.ogg" and "in.wav" in cmd
