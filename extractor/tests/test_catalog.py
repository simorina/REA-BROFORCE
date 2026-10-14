from extractor.catalog import SPRITES, TEXTURES, UNIT_FIELDS, VALUES

SPRITE_KEYS = ("bro_base", "mook", "mook_suicide", "mook_bazooka", "prisoner", "cage", "helicopter",
               "bullet", "rocket", "bomb", "marker", "block_dirt", "block_brick", "block_steel",
               "block_barrel", "flagpole", "flag", "explosion", "explosion_small")
VALUE_KEYS = ("bro_base", "mook", "mook_suicide", "mook_bazooka", "bullet", "rocket_mook", "bomb",
              "marker", "suicide_blast", "block_dirt", "block_brick", "block_steel", "block_barrel")


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
        if ref.key in ("bro_base", "mook", "mook_suicide", "mook_bazooka"):
            assert ref.fields == UNIT_FIELDS
