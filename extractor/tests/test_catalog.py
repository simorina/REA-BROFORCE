from extractor.catalog import AI_FIELDS, MOOK_FIELDS, SPRITES, TEXTURES, UNIT_FIELDS, VALUES

SPRITE_KEYS = ("bro_base", "mook", "mook_suicide", "mook_bazooka", "prisoner", "cage", "helicopter",
               "bullet", "rocket", "bomb", "marker", "block_dirt", "block_brick", "block_steel",
               "block_barrel", "flagpole", "flag", "mook_scout")
VALUE_KEYS = ("bro_base", "mook", "mook_suicide", "mook_bazooka", "bullet", "rocket_mook", "bomb",
              "marker", "suicide_blast", "block_dirt", "block_brick", "block_steel", "block_barrel",
              "ai_mook", "ai_mook_suicide", "ai_mook_bazooka", "grass", "mook_scout", "ai_mook_scout", "path_mook",
              "path_mook_scout", "path_mook_suicide", "path_mook_bazooka", "mook_door")


def test_output_keys_are_unique():
    sprite_keys = [s.key for s in SPRITES] + [t.key for t in TEXTURES]
    assert len(sprite_keys) == len(set(sprite_keys))
    value_keys = [v.key for v in VALUES]
    assert len(value_keys) == len(set(value_keys))


def test_everything_the_game_draws_is_extracted():
    keys = {s.key for s in SPRITES} | {t.key for t in TEXTURES}
    assert set(SPRITE_KEYS) <= keys


def test_everything_the_game_simulates_is_extracted():
    assert set(VALUE_KEYS) <= {v.key for v in VALUES}


def test_units_read_all_movement_fields():
    for ref in VALUES:
        if ref.key == "bro_base":
            assert ref.fields == UNIT_FIELDS
        if ref.key in ("mook", "mook_suicide", "mook_bazooka"):
            assert ref.fields == MOOK_FIELDS


def test_mook_ai_reads_the_polymorphic_ai_fields():
    for ref in VALUES:
        if ref.key.startswith("ai_"):
            assert ref.fields == AI_FIELDS
