import math

from extractor.worldmap import (apply_dir, apply_point, color_bytes, glow_color, lightmap_uv, mat_mul, quad_in_camera, queue_order,
                                right_handed, territory_key, territory_of, trs)


def close(a, b, eps=1e-6):
    return all(abs(x - y) < eps for x, y in zip(a, b))


def test_a_quarter_turn_about_y_takes_x_to_minus_z_as_in_unity():
    s = math.sqrt(0.5)
    m = trs((0, 0, 0), (0, s, 0, s), (1, 1, 1))  # quaternion x, y, z, w
    assert close(apply_point(m, (1, 0, 0)), (0, 0, -1))


def test_a_child_takes_its_parents_translation_rotation_and_scale():
    parent = trs((0, 2, 0), (0, 0, 0, 1), (2, 2, 2))
    child = trs((1, 0, 0), (0, 0, 0, 1), (1, 1, 1))
    assert close(apply_point(mat_mul(parent, child), (0, 0, 0)), (2, 2, 0))
    assert close(apply_point(mat_mul(parent, child), (1, 0, 0)), (4, 2, 0))


def test_normals_stay_perpendicular_under_a_squashing_scale():
    m = trs((0, 0, 0), (0, 0, 0, 1), (1, 4, 1))
    n = apply_dir(m, (0, 1, 0))  # the normal of a horizontal surface stays vertical, unit length
    assert close(n, (0, 1, 0))
    d = apply_dir(m, (1, 1, 0))
    assert abs(math.hypot(*d) - 1) < 1e-6 and d[0] > d[1]  # leans toward the stretched axis' perpendicular


def test_three_js_is_right_handed_so_z_flips():
    assert right_handed((1, 2, 3)) == (1, 2, -3)


def test_the_lightmap_uv_takes_the_renderers_scale_and_offset():
    assert close(lightmap_uv((0.5, 0.25), (0.5, 0.5, 0.25, 0.75)), (0.5, 0.875))


def test_a_territory_is_named_after_its_outline_mesh():
    assert territory_of("usaOutline") == "usa"
    assert territory_of("hongkongOutline") == "hongkong"
    assert territory_of("africaWaterWaves") is None


def test_render_queues_order_like_unitys():
    assert queue_order("Geometry") == 2000
    assert queue_order("Transparent-15") == 2985
    assert queue_order("Transparent") == 3000
    assert queue_order(None) == 2000


def test_vertex_colours_pack_into_bytes():
    assert color_bytes((1.0, 0.5, 0.0, 0.25)) == (255, 128, 0, 64)
    assert color_bytes(None) == (255, 255, 255, 255)


def test_a_territory_is_keyed_by_its_outline_or_else_its_terrain():
    assert territory_key("vietnamOutline", "vietnamTerrain") == "vietnam"
    assert territory_key(None, "afghanistanTerrainMuscle") == "afghanistan"
    assert territory_key(None, "timebroChallengeTerrain") == "timebro"


def test_an_additive_particle_glow_doubles_its_tint_as_unitys_shader_does():
    assert close(glow_color("Particles/Additive", {"_TintColor": (0.036, 0.164, 0.169, 0.502)}), (0.072, 0.328, 0.338, 1.004))
    assert close(glow_color("Custom/backgroundTransparent", {"_Color": (0.058, 0.163, 0.353, 0.443)}), (0.058, 0.163, 0.353, 0.443))


def test_a_quad_childed_to_the_camera_sits_ahead_of_it_at_its_scaled_size():
    camera = trs((0, 0, -16.68), (0, 0, 0, 1), (1, 1, 1))
    quad = trs((0, 0, -5.94), (0, 0, 0, 1), (0.288, 0.288, 0.288))
    q = quad_in_camera(camera, quad, 15.0)
    assert abs(q["distance"] - 10.74) < 1e-6 and abs(q["size"] - 8.64) < 1e-6
