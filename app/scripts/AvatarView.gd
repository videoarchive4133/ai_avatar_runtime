extends Node3D
class_name AvatarView

const VrmExtension = preload("res://addons/vrm/vrm_extension.gd")
const ProjectPathsScript = preload("res://scripts/ProjectPaths.gd")

const USE_AUTO_NORMALIZE := false
const USE_AUTO_ROTATION := false
const USE_AUTO_SCALE := false

const AVATAR_SCALE := 1.0
const AVATAR_ROTATION_Y := 180.0
const AVATAR_OFFSET_Y := 0.0
const CAMERA_DISTANCE := 0.0

const TARGET_AVATAR_HEIGHT := 1.7
const MIN_AUTO_SCALE := 0.01
const MAX_AUTO_SCALE := 100.0
const DEFAULT_CAMERA_DISTANCE := 3.6
const CAMERA_FOV := 38.0
const MIN_GLB_BYTES := 1024
const TEST_AVATAR_FILE := "test_avatar.glb"
const MOTION_LIBRARY_NAME := ""
const EXTERNAL_MOTION_NAME := "__external_motion"
const EXTERNAL_MOTION_TRACK_LOG_LIMIT := 50
const RETARGET_ROTATION_SCALE := 0.5
const RETARGET_ROTATION_SCALE_BY_MOTION = {
	"walk": 0.5,
	"run": 0.25,
}
const WALK_HIPS_ROTATION_SCALE := 0.35
const WALK_LEG_ROTATION_SCALE := 0.55
const WALK_ARM_ROTATION_SCALE := 0.0
const WALK_SPINE_ROTATION_SCALE := 0.20
const WALK_POSITION_SCALE := 0.15
const WALK_FOOT_ROTATION_CLAMP_DEG := Vector3(10.0, 12.0, 10.0)
const NATURAL_WALK_HIPS_ROTATION_SCALE := 0.35
const NATURAL_WALK_LEG_ROTATION_SCALE := 0.55
const NATURAL_WALK_ARM_ROTATION_SCALE := 0.15
const NATURAL_WALK_SPINE_ROTATION_SCALE := 0.20
const NATURAL_WALK_POSITION_SCALE := 0.15
const NATURAL_WAVE_ARM_ROTATION_SCALE := 0.08
const RUN_RETARGET_ARM_ROTATION_MULTIPLIER := 0.35
const RUN_RETARGET_EXCLUDE_ARM_BONES := true
const NATURAL_WAVE_RIGHT_ARM_KEYS = [
	"right_shoulder",
	"right_upper_arm",
	"right_lower_arm",
	"right_hand",
]
const NATURAL_WAVE_LEFT_ARM_LOCK_KEYS = [
	"left_shoulder",
	"left_upper_arm",
	"left_lower_arm",
	"left_hand",
]
const RUN_RETARGET_ARM_KEYS = [
	"left_shoulder",
	"right_shoulder",
	"left_upper_arm",
	"right_upper_arm",
	"left_lower_arm",
	"right_lower_arm",
]
const RUN_RETARGET_ARM_LOCK_KEYS = [
	"left_shoulder",
	"right_shoulder",
	"left_upper_arm",
	"right_upper_arm",
	"left_lower_arm",
	"right_lower_arm",
	"left_hand",
	"right_hand",
]
const ARM_BONE_MAPPING_KEYS = [
	"left_shoulder",
	"right_shoulder",
	"left_upper_arm",
	"right_upper_arm",
	"left_lower_arm",
	"right_lower_arm",
	"left_hand",
	"right_hand",
]
const STRICT_EXACT_ARM_BONE_KEYS = {
	"left_upper_arm": true,
	"right_upper_arm": true,
	"left_lower_arm": true,
	"right_lower_arm": true,
	"left_hand": true,
	"right_hand": true,
}
const FINGER_BONE_NAME_MARKERS = [
	"thumb",
	"index",
	"middle",
	"ring",
	"little",
	"pinky",
	"finger",
	"metacarpal",
	"proximal",
	"intermediate",
	"distal",
]
const RUN_ARM_LOCK_USE_CUSTOM_POSE := false
const RUN_ARM_SHOULDER_FORWARD_DEG := 4.0
const RUN_ARM_SHOULDER_DOWN_DEG := 8.0
const RUN_ARM_UPPER_FORWARD_DEG := 18.0
const RUN_ARM_UPPER_DOWN_DEG := 58.0
const RUN_ARM_LOWER_FORWARD_DEG := 4.0
const RUN_ARM_LOWER_BEND_DEG := 28.0
const RUN_ARM_HAND_FORWARD_DEG := 0.0
const RUN_ARM_HAND_RELAX_DEG := 4.0
const RUN_RETARGET_PRIORITY_KEYS = [
	"hips",
	"left_upper_leg",
	"right_upper_leg",
	"left_lower_leg",
	"right_lower_leg",
	"left_foot",
	"right_foot",
	"spine",
	"chest",
	"neck",
	"head",
	"left_shoulder",
	"right_shoulder",
	"left_upper_arm",
	"right_upper_arm",
	"left_lower_arm",
	"right_lower_arm",
]
const MAX_EXTERNAL_POSITION_OFFSET := Vector3(0.18, 0.14, 0.18)
const MAX_EXTERNAL_ROTATION_DEGREES := Vector3(14.0, 18.0, 14.0)
const EXTERNAL_BONE_TRACK_KEYWORDS = [
	"skeleton",
	"bone",
	"armature",
	"hips",
	"spine",
	"upper",
	"lower",
	"hand",
	"foot",
]
const PROCEDURAL_BONE_ALIASES = {
	"head": ["head"],
	"neck": ["neck"],
	"spine": ["spine", "tummy", "abdomen"],
	"chest": ["chest", "upperchest"],
	"left_shoulder": ["leftshoulder", "shoulderl", "shoulderleft", "lshoulder"],
	"right_shoulder": ["rightshoulder", "shoulderr", "shoulderright", "rshoulder"],
	"left_upper_arm": ["leftupperarm", "leftarm", "upperarml", "upperarmleft", "lupperarm"],
	"right_upper_arm": ["rightupperarm", "rightarm", "upperarmr", "upperarmright", "rupperarm"],
	"left_lower_arm": ["leftlowerarm", "lowerarml", "lowerarmleft", "llowerarm", "leftforearm", "forearml"],
	"right_lower_arm": ["rightlowerarm", "lowerarmr", "lowerarmright", "rlowerarm", "rightforearm", "forearmr"],
	"left_hand": ["lefthand", "handl", "handleft", "lhand", "palml", "palmleft", "leftpalm"],
	"right_hand": ["righthand", "handr", "handright", "rhand", "palmr", "palmright", "rightpalm"],
}
const IDLE_ARM_UPPER_FORWARD_DEG := 0.0
const IDLE_ARM_UPPER_X_DOWN_DEG := 8.0
const IDLE_ARM_UPPER_Y_ALIGN_DEG := 12.0
const IDLE_ARM_UPPER_Z_TRIM_DEG := 0.0
const IDLE_ARM_SHOULDER_Z_DEG := 0.0
const IDLE_ARM_LOWER_BEND_DEG := 2.0
const IDLE_ARM_HAND_RELAX_DEG := 0.0
const IDLE_ARM_VISUAL_DOWN_SIDE_OFFSET := 0.04
const IDLE_BASE_POSE_OFFSETS = {
	"left_shoulder": Vector3(0.0, 0.0, IDLE_ARM_SHOULDER_Z_DEG),
	"right_shoulder": Vector3(0.0, 0.0, -IDLE_ARM_SHOULDER_Z_DEG),
	"left_upper_arm": Vector3(IDLE_ARM_UPPER_X_DOWN_DEG, -IDLE_ARM_UPPER_Y_ALIGN_DEG, -IDLE_ARM_UPPER_Z_TRIM_DEG),
	"right_upper_arm": Vector3(IDLE_ARM_UPPER_X_DOWN_DEG, IDLE_ARM_UPPER_Y_ALIGN_DEG, IDLE_ARM_UPPER_Z_TRIM_DEG),
	"left_lower_arm": Vector3(0.0, 0.0, -IDLE_ARM_LOWER_BEND_DEG),
	"right_lower_arm": Vector3(0.0, 0.0, IDLE_ARM_LOWER_BEND_DEG),
	"left_hand": Vector3(0.0, 0.0, -IDLE_ARM_HAND_RELAX_DEG),
	"right_hand": Vector3(0.0, 0.0, IDLE_ARM_HAND_RELAX_DEG),
}
const RETARGET_TARGET_BONE_ALIASES = {
	"hips": ["pelvis", "hips"],
	"spine": ["abdomen", "tummy", "spine"],
	"chest": ["chest", "torso2", "torso_2", "upperchest", "spine1", "spine2"],
	"neck": ["neck"],
	"head": ["head"],
	"left_shoulder": ["shoulderl", "leftshoulder", "lshoulder"],
	"right_shoulder": ["shoulderr", "rightshoulder", "rshoulder"],
	"left_upper_arm": ["leftupperarm", "leftarm", "upperarml", "lupperarm"],
	"right_upper_arm": ["rightupperarm", "rightarm", "upperarmr", "rupperarm"],
	"left_lower_arm": ["leftlowerarm", "leftforearm", "lowerarml", "forearml", "llowerarm"],
	"right_lower_arm": ["rightlowerarm", "rightforearm", "lowerarmr", "forearmr", "rlowerarm"],
	"left_hand": ["lefthand", "handl", "lhand"],
	"right_hand": ["righthand", "handr", "rhand"],
	"left_upper_leg": ["thighl", "leftupleg", "leftupperleg", "upperlegl", "lupperleg"],
	"right_upper_leg": ["thighr", "rightupleg", "rightupperleg", "upperlegr", "rupperleg"],
	"left_lower_leg": ["shinl", "leftleg", "leftlowerleg", "lowerlegl", "calfl", "lleg"],
	"right_lower_leg": ["shinr", "rightleg", "rightlowerleg", "lowerlegr", "calfr", "rleg"],
	"left_foot": ["footl", "leftfoot", "lfoot"],
	"right_foot": ["footr", "rightfoot", "rfoot"],
}
const EMOTION_BLEND_SHAPE_ALIASES = {
	"happy": {
		"happy": 1.0,
		"joy": 1.0,
		"smile": 1.0,
		"ee": 0.55,
		"ah": 0.16,
	},
	"sad": {
		"sad": 1.0,
		"sorrow": 1.0,
		"lookdown": 0.45,
		"blinkleft": 0.18,
		"blinkright": 0.18,
	},
	"angry": {
		"angry": 1.0,
		"angledeyebrows": 1.0,
		"lookdown": 0.18,
	},
}
const LIP_SYNC_MOUTH_BLEND_SHAPES = ["ah", "ih", "uu", "ee", "oh"]
const MOTION_IDLE := "idle"
const MOTION_TALK := "talk"
const MOTION_HAPPY := "happy"
const MOTION_BOW := "bow"
const MOTION_DANCE := "dance"
const MOTION_WAVE := "wave"
const MOTION_WALK := "walk"
const MOTION_RUN := "run"
const MOTION_NATURAL_WALK := "natural_walk"
const MOTION_NATURAL_IDLE := "natural_idle"
const MOTION_NATURAL_WAVE := "natural_wave"
const SUPPORTED_MOTIONS = [
	MOTION_IDLE,
	MOTION_TALK,
	MOTION_HAPPY,
	MOTION_BOW,
	MOTION_DANCE,
	MOTION_WAVE,
	MOTION_WALK,
	MOTION_RUN,
	MOTION_NATURAL_WALK,
	MOTION_NATURAL_IDLE,
	MOTION_NATURAL_WAVE,
]
const EXTERNAL_ONLY_MOTIONS = [
	MOTION_WALK,
	MOTION_RUN,
	MOTION_NATURAL_WALK,
	MOTION_NATURAL_IDLE,
	MOTION_NATURAL_WAVE,
]

const VRM_IMPORT_OPTION_DEFAULTS = {
	"vrm/already_processed": false,
	"vrm/head_hiding_method": 0,
	"vrm/first_person_layers": 1,
	"vrm/third_person_layers": 2,
}

var _avatar_mount: Node3D
var _motion_player: AnimationPlayer
var _motion_library: AnimationLibrary
var _motion_base_position := Vector3.ZERO
var _motion_base_rotation_degrees := Vector3.ZERO
var _skeleton: Skeleton3D
var _procedural_bones: Dictionary = {}
var _procedural_bone_base_rotations: Dictionary = {}
var _procedural_bone_base_positions: Dictionary = {}
var _idle_base_pose: Dictionary = {}
var _procedural_motion_active := false
var _procedural_motion_name := ""
var _procedural_motion_time := 0.0
var _external_retarget_active := false
var _external_retarget_tracks: Array[Dictionary] = []
var _external_retarget_time := 0.0
var _external_retarget_length := 0.0
var _external_retarget_motion := ""
var _blend_shape_entries: Array[Dictionary] = []
var _lip_sync_mouth_entries: Dictionary = {}
var _lip_sync_mouth_active := ""
var _model: Node3D
var _placeholder: MeshInstance3D
var _current_motion := "idle"
var _current_emotion := "neutral"
var _camera_target := Vector3(0.0, 1.0, 0.0)
var _auto_camera_distance := DEFAULT_CAMERA_DISTANCE
var _last_bounds := AABB(Vector3(-0.5, 0.0, -0.5), Vector3(1.0, TARGET_AVATAR_HEIGHT, 1.0))


func load_first_avatar(vrm_dir: String) -> Dictionary:
	if has_model():
		return {
			"loaded": true,
			"fallback": _placeholder != null,
			"already_visible": true,
			"message": "Model is already visible; skipped loading.",
		}

	_clear_model()

	var debug_lines := PackedStringArray()
	var glb_dir := ProjectPathsScript.repo_file("assets/avatar_glb")
	var glb_result := _find_first_valid_glb(glb_dir)
	debug_lines.append_array(glb_result.get("debug", PackedStringArray()))
	var glb_path := String(glb_result.get("path", ""))
	if not glb_path.is_empty():
		var loaded_glb := _load_glb(glb_path)
		if loaded_glb != null:
			debug_lines.append("Loaded GLB: %s" % ProjectPathsScript.display_path(glb_path))
			if glb_path.get_file() == TEST_AVATAR_FILE:
				debug_lines.append("Loaded test avatar")
			var glb_attach_status := _attach_loaded_model(loaded_glb, glb_path, "GLB", debug_lines)
			if bool(glb_attach_status.get("loaded", false)):
				return glb_attach_status
			debug_lines = glb_attach_status.get("debug", debug_lines)
			debug_lines.append("GLB load failed: %s (could not calculate visible bounds)" % ProjectPathsScript.display_path(glb_path))
			_clear_model()
			_reset_empty_view()
		else:
			debug_lines.append("GLB load failed: %s" % ProjectPathsScript.display_path(glb_path))

	var vrm_path := _find_first_vrm(vrm_dir)
	if vrm_path.is_empty():
		_create_placeholder()
		return {
			"loaded": false,
			"fallback": true,
			"message": "No VRM found in %s; using Cube." % ProjectPathsScript.display_path(vrm_dir),
			"debug": debug_lines,
		}

	var loaded_model := _load_vrm(vrm_path)
	if loaded_model == null:
		_create_placeholder()
		return {
			"loaded": false,
			"fallback": true,
			"path": vrm_path,
			"message": "Failed to load %s; using Cube." % ProjectPathsScript.display_path(vrm_path),
			"debug": debug_lines,
		}

	return _attach_loaded_model(loaded_model, vrm_path, "VRM", debug_lines)


func has_model() -> bool:
	return _model != null and is_instance_valid(_model)


func hide_avatar() -> bool:
	if not has_model():
		_reset_empty_view()
		return false
	_clear_model()
	_reset_empty_view()
	return true


func set_emotion(emotion: String) -> Dictionary:
	_current_emotion = _normalize_emotion(emotion)
	_apply_placeholder_emotion()
	var expression_status := _apply_blend_shape_emotion(_current_emotion)
	if bool(expression_status.get("applied", false)):
		var applied_names: PackedStringArray = expression_status.get("names", PackedStringArray())
		return {
			"mode": "blend_shape",
			"message": "Expression BlendShape applied: %s (%s)" % [
				_current_emotion,
				", ".join(applied_names)
			],
		}
	if _current_emotion == "neutral" and not _blend_shape_entries.is_empty():
		return {
			"mode": "blend_shape",
			"message": "Expression BlendShape applied: neutral (reset)",
		}
	if _model == null:
		return {
			"mode": "deferred",
			"message": "Expression fallback: %s (model not loaded; GUI/light only)" % _current_emotion,
		}
	return {
		"mode": "fallback",
		"message": "Expression fallback: %s (no usable BlendShape; GUI/light/motion intensity)" % _current_emotion,
	}


func set_lip_sync_mouth(shape_name: String, amount: float = 1.0) -> Dictionary:
	var normalized := _normalize_blend_shape_name(shape_name)
	_reset_lip_sync_mouth_shapes()
	var entry := _find_lip_sync_mouth_entry(normalized)
	if entry.is_empty():
		_lip_sync_mouth_active = ""
		return {
			"applied": false,
			"message": "LipSync mouth BlendShape missing: %s (available: %s)" % [
				shape_name,
				_format_available_blend_shape_names()
			],
		}

	var mesh_instance := entry.get("mesh") as MeshInstance3D
	if mesh_instance == null:
		return {
			"applied": false,
			"message": "LipSync mouth BlendShape unavailable: %s" % shape_name,
		}

	mesh_instance.set(String(entry.get("property", "")), clampf(amount, 0.0, 1.0))
	_lip_sync_mouth_active = String(entry.get("name", shape_name))
	return {
		"applied": true,
		"message": "LipSync mouth applied: %s -> %s" % [
			shape_name,
			String(entry.get("name", shape_name))
		],
	}


func reset_lip_sync_mouth() -> void:
	_reset_lip_sync_mouth_shapes()
	_lip_sync_mouth_active = ""


func get_lip_sync_mouth() -> String:
	return _lip_sync_mouth_active


func has_lip_sync_mouth_shapes() -> bool:
	return not _lip_sync_mouth_entries.is_empty()


func _apply_placeholder_emotion() -> void:
	if _placeholder == null:
		return
	var material := _placeholder.get_surface_override_material(0) as StandardMaterial3D
	if material == null:
		return
	match _current_emotion:
		"happy":
			material.albedo_color = Color(0.2, 0.75, 0.36)
		"angry":
			material.albedo_color = Color(0.85, 0.22, 0.18)
		"sad":
			material.albedo_color = Color(0.22, 0.36, 0.82)
		_:
			material.albedo_color = Color(0.68, 0.72, 0.78)


func set_motion(motion: String) -> Dictionary:
	_current_motion = _normalize_motion(motion)
	return _play_motion_animation(_current_motion)


func set_motion_file(motion_file: String, fallback_motion: String = MOTION_IDLE) -> Dictionary:
	var requested_path := motion_file.strip_edges()
	var normalized_fallback := _normalize_motion(fallback_motion)
	if requested_path.is_empty():
		_current_motion = normalized_fallback
		return _play_motion_animation(_current_motion)

	_current_motion = normalized_fallback
	var resolved_path := _resolve_motion_file_path(requested_path)
	var display_path := _display_motion_file_path(resolved_path)
	var extension := resolved_path.get_extension().to_lower()
	var debug_lines := PackedStringArray()
	debug_lines.append("motion_file requested: %s" % display_path)

	if extension == "vrma":
		return _play_vrma_motion_file_placeholder(resolved_path, display_path, normalized_fallback, debug_lines)

	debug_lines.append(
		"motion_file unsupported format: %s (standard route expects .vrma)" % display_path
	)
	if extension == "fbx" or extension == "glb":
		debug_lines.append("FBX/GLB motion_file playback is experimental-only and not used as the standard route")
	return _play_motion_file_fallback(
		"motion_file unsupported: %s" % display_path,
		debug_lines,
		normalized_fallback
	)


func frame_camera(camera: Camera3D, camera_name: String = "front") -> void:
	if camera == null:
		return

	var normalized := camera_name.strip_edges().to_lower()
	if normalized.is_empty():
		normalized = "front"

	var distance := CAMERA_DISTANCE
	if distance <= 0.0:
		distance = _auto_camera_distance
	distance = maxf(distance, 1.0)

	var target := _camera_target
	if is_inside_tree():
		target = global_transform * _camera_target
	else:
		target = transform * _camera_target
	camera.fov = CAMERA_FOV
	camera.near = 0.02
	camera.far = 100.0

	match normalized:
		"back":
			camera.position = target + Vector3(0.0, 0.08, -distance)
		"left":
			camera.position = target + Vector3(-distance, 0.08, 0.0)
		"right":
			camera.position = target + Vector3(distance, 0.08, 0.0)
		"side":
			camera.position = target + Vector3(distance, 0.12, distance * 0.35)
		"close":
			camera.position = target + Vector3(0.0, 0.08, distance * 0.62)
		"top":
			camera.position = target + Vector3(0.0, distance * 0.92, distance * 0.35)
		_:
			camera.position = target + Vector3(0.0, 0.08, distance)
	camera.look_at(target, Vector3.UP)


func _process(delta: float) -> void:
	if _procedural_motion_active:
		_update_procedural_bone_motion(delta)
	if _external_retarget_active:
		_update_external_retarget_motion(delta)


func _find_first_vrm(vrm_dir: String) -> String:
	var dir := DirAccess.open(vrm_dir)
	if dir == null:
		return ""

	var files: Array[String] = []
	dir.list_dir_begin()
	var file_name := dir.get_next()
	while not file_name.is_empty():
		if not dir.current_is_dir() and file_name.get_extension().to_lower() == "vrm":
			files.append(file_name)
		file_name = dir.get_next()
	dir.list_dir_end()

	files.sort()
	if files.is_empty():
		return ""
	return vrm_dir.path_join(files[0]).simplify_path()


func _find_first_valid_glb(glb_dir: String) -> Dictionary:
	var debug_lines := PackedStringArray()
	var dir := DirAccess.open(glb_dir)
	if dir == null:
		return {
			"path": "",
			"debug": debug_lines,
		}

	var files: Array[String] = []
	dir.list_dir_begin()
	var file_name := dir.get_next()
	while not file_name.is_empty():
		if not dir.current_is_dir() and file_name.get_extension().to_lower() == "glb":
			files.append(file_name)
		file_name = dir.get_next()
	dir.list_dir_end()

	files.sort()
	if files.has(TEST_AVATAR_FILE):
		files.erase(TEST_AVATAR_FILE)
		files.push_front(TEST_AVATAR_FILE)
	for file in files:
		var path := glb_dir.path_join(file).simplify_path()
		var size := _get_file_size(path)
		debug_lines.append("Found GLB: %s (%s bytes)" % [ProjectPathsScript.display_path(path), size])
		if size < MIN_GLB_BYTES:
			debug_lines.append("Skipped small GLB: %s (%s bytes)" % [ProjectPathsScript.display_path(path), size])
			continue
		return {
			"path": path,
			"debug": debug_lines,
		}

	return {
		"path": "",
		"debug": debug_lines,
	}


func _get_file_size(path: String) -> int:
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return -1
	var size := file.get_length()
	file.close()
	return size


func _load_glb(path: String) -> Node3D:
	var gltf := GLTFDocument.new()
	var state := GLTFState.new()
	state.handle_binary_image = GLTFState.HANDLE_BINARY_EMBED_AS_UNCOMPRESSED

	var error := gltf.append_from_file(path, state, 8)
	if error != OK:
		push_warning("GLB load failed: %s (error %s)" % [path, error])
		return null

	var generated_scene := gltf.generate_scene(state)
	if generated_scene is Node3D:
		return generated_scene
	if generated_scene is Node:
		var wrapper := Node3D.new()
		wrapper.name = "GLBWrapper"
		wrapper.add_child(generated_scene)
		return wrapper
	return null


func _load_vrm(path: String) -> Node3D:
	var gltf := GLTFDocument.new()
	var vrm_extension: GLTFDocumentExtension = VrmExtension.new()
	gltf.register_gltf_document_extension(vrm_extension, true)

	var state := GLTFState.new()
	state.handle_binary_image = GLTFState.HANDLE_BINARY_EMBED_AS_UNCOMPRESSED
	var import_options := _build_vrm_import_options()
	_apply_vrm_import_options(state, import_options)

	var error := gltf.append_from_file(path, state, 8)
	if error != OK:
		gltf.unregister_gltf_document_extension(vrm_extension)
		push_warning("VRM load failed: %s (error %s)" % [path, error])
		return null

	var generated_scene := gltf.generate_scene(state)
	gltf.unregister_gltf_document_extension(vrm_extension)

	if generated_scene is Node3D:
		return generated_scene
	if generated_scene is Node:
		var wrapper := Node3D.new()
		wrapper.name = "VRMWrapper"
		wrapper.add_child(generated_scene)
		return wrapper
	return null


func _attach_loaded_model(loaded_model: Node3D, path: String, source_label: String, debug_lines: PackedStringArray) -> Dictionary:
	_model = loaded_model
	_model.name = "Loaded%s" % source_label
	_create_avatar_mount()
	_avatar_mount.add_child(_model)
	_reset_avatar_mount()
	_refresh_skeleton(debug_lines)
	_refresh_blend_shapes(debug_lines)
	var prepare_status := _prepare_loaded_model(path, source_label)
	if not bool(prepare_status.get("ok", false)):
		_clear_model()
		_create_placeholder()
		var merged_debug := PackedStringArray(debug_lines)
		merged_debug.append_array(prepare_status.get("debug", PackedStringArray()))
		return {
			"loaded": false,
			"fallback": true,
			"path": path,
			"message": "Loaded %s but could not calculate visible bounds; using Cube." % ProjectPathsScript.display_path(path),
			"debug": merged_debug,
		}

	var merged_debug := PackedStringArray(debug_lines)
	merged_debug.append_array(prepare_status.get("debug", PackedStringArray()))
	set_emotion(_current_emotion)
	_play_motion_animation(_current_motion)
	return {
		"loaded": true,
		"fallback": false,
		"path": path,
		"message": "Loaded %s: %s" % [source_label, ProjectPathsScript.display_path(path)],
		"debug": merged_debug,
	}


func _build_vrm_import_options(overrides: Dictionary = {}) -> Dictionary:
	var import_options := VRM_IMPORT_OPTION_DEFAULTS.duplicate()
	for key in overrides:
		import_options[key] = overrides[key]
	return import_options


func _apply_vrm_import_options(state: GLTFState, import_options: Dictionary) -> void:
	state.set_additional_data(
		&"vrm/already_processed",
		bool(import_options.get("vrm/already_processed", false))
	)
	state.set_additional_data(
		&"vrm/head_hiding_method",
		int(import_options.get("vrm/head_hiding_method", 0))
	)
	state.set_additional_data(
		&"vrm/first_person_layers",
		int(import_options.get("vrm/first_person_layers", 1))
	)
	state.set_additional_data(
		&"vrm/third_person_layers",
		int(import_options.get("vrm/third_person_layers", 2))
	)


func _prepare_loaded_model(model_path: String, source_label: String) -> Dictionary:
	_reset_avatar_mount()

	var bounds_result := _calculate_model_bounds()
	var mesh_count := int(bounds_result.get("mesh_count", 0))
	if mesh_count <= 0 or not bool(bounds_result.get("ok", false)):
		return {
			"ok": false,
			"debug": PackedStringArray([
				"%s file: %s" % [source_label, model_path.get_file()],
				"%s mesh count: %s" % [source_label, mesh_count],
				"%s AABB: unavailable" % source_label,
			]),
		}

	var raw_bounds: AABB = bounds_result["aabb"]
	_last_bounds = raw_bounds
	_camera_target = raw_bounds.get_center()
	_auto_camera_distance = _calculate_camera_distance(raw_bounds)

	if not USE_AUTO_NORMALIZE:
		_store_motion_base_from_mount()
		return {
			"ok": true,
			"mesh_count": mesh_count,
			"aabb": raw_bounds,
			"scale": 1.0,
			"rotation": Vector3.ZERO,
			"debug": PackedStringArray([
				"%s file: %s" % [source_label, model_path.get_file()],
				"%s mesh count: %s" % [source_label, mesh_count],
				"%s AABB center: %s" % [source_label, _format_vector3(raw_bounds.get_center())],
				"%s AABB size: %s" % [source_label, _format_vector3(raw_bounds.size)],
				"%s auto normalize: disabled" % source_label,
				"%s avatar_mount position: %s" % [source_label, _format_vector3(_avatar_mount.position)],
				"%s avatar_mount rotation: %s" % [source_label, _format_vector3(_avatar_mount.rotation_degrees)],
				"%s avatar_mount scale: %s" % [source_label, _format_vector3(_avatar_mount.scale)],
			]),
		}

	var raw_height := maxf(raw_bounds.size.y, 0.001)
	var applied_scale := AVATAR_SCALE
	if USE_AUTO_SCALE:
		var auto_scale := clampf(TARGET_AVATAR_HEIGHT / raw_height, MIN_AUTO_SCALE, MAX_AUTO_SCALE)
		applied_scale = AVATAR_SCALE * auto_scale
	_avatar_mount.scale = Vector3.ONE * applied_scale
	if USE_AUTO_ROTATION:
		_avatar_mount.rotation_degrees = Vector3(0.0, AVATAR_ROTATION_Y, 0.0)

	var scaled_bounds_result := _calculate_model_bounds()
	var scaled_bounds: AABB = scaled_bounds_result["aabb"]
	var scaled_center := scaled_bounds.get_center()
	_avatar_mount.position = Vector3(
		-scaled_center.x,
		-scaled_bounds.position.y + AVATAR_OFFSET_Y,
		-scaled_center.z
	)

	var normalized_bounds_result := _calculate_model_bounds()
	_last_bounds = normalized_bounds_result.get("aabb", scaled_bounds)
	_camera_target = _last_bounds.get_center()
	_auto_camera_distance = _calculate_camera_distance(_last_bounds)
	_store_motion_base_from_mount()

	return {
		"ok": true,
		"mesh_count": mesh_count,
		"aabb": _last_bounds,
		"scale": applied_scale,
		"rotation": _avatar_mount.rotation_degrees,
		"debug": PackedStringArray([
			"%s file: %s" % [source_label, model_path.get_file()],
			"%s mesh count: %s" % [source_label, mesh_count],
			"%s AABB center: %s" % [source_label, _format_vector3(_last_bounds.get_center())],
			"%s AABB size: %s" % [source_label, _format_vector3(_last_bounds.size)],
			"%s avatar_mount scale: %.4f" % [source_label, applied_scale],
			"%s avatar_mount rotation: %s" % [source_label, _format_vector3(_avatar_mount.rotation_degrees)],
		]),
	}


func _calculate_model_bounds() -> Dictionary:
	if _model == null:
		return {"ok": false, "mesh_count": 0}

	var meshes: Array[MeshInstance3D] = []
	_collect_meshes(_model, meshes)
	var combined := AABB()
	var has_bounds := false

	for mesh_instance in meshes:
		if mesh_instance.mesh == null:
			continue
		var mesh_bounds := _transform_aabb(mesh_instance.get_aabb(), _get_transform_to_avatar(mesh_instance))
		if not has_bounds:
			combined = mesh_bounds
			has_bounds = true
		else:
			combined = combined.merge(mesh_bounds)

	return {
		"ok": has_bounds,
		"mesh_count": meshes.size(),
		"aabb": combined,
	}


func _collect_meshes(node: Node, meshes: Array[MeshInstance3D]) -> void:
	if node is MeshInstance3D:
		meshes.append(node as MeshInstance3D)
	for child in node.get_children():
		_collect_meshes(child, meshes)


func _get_transform_to_avatar(node: Node3D) -> Transform3D:
	var combined := Transform3D.IDENTITY
	var current: Node = node
	while current != null and current != self:
		if current is Node3D:
			combined = (current as Node3D).transform * combined
		current = current.get_parent()
	return combined


func _transform_aabb(aabb: AABB, transform: Transform3D) -> AABB:
	var corners := [
		aabb.position,
		aabb.position + Vector3(aabb.size.x, 0.0, 0.0),
		aabb.position + Vector3(0.0, aabb.size.y, 0.0),
		aabb.position + Vector3(0.0, 0.0, aabb.size.z),
		aabb.position + Vector3(aabb.size.x, aabb.size.y, 0.0),
		aabb.position + Vector3(aabb.size.x, 0.0, aabb.size.z),
		aabb.position + Vector3(0.0, aabb.size.y, aabb.size.z),
		aabb.position + aabb.size,
	]

	var transformed := AABB(transform * corners[0], Vector3.ZERO)
	for i in range(1, corners.size()):
		transformed = transformed.expand(transform * corners[i])
	return transformed


func _calculate_camera_distance(bounds: AABB) -> float:
	var largest_size := maxf(bounds.size.x, maxf(bounds.size.y, bounds.size.z))
	var radius := maxf(largest_size * 0.62, 0.75)
	var fov_radians := deg_to_rad(CAMERA_FOV)
	var distance := radius / tan(fov_radians * 0.5)
	distance += bounds.size.z * 0.5
	return maxf(distance, DEFAULT_CAMERA_DISTANCE * 0.6)


func _format_vector3(value: Vector3) -> String:
	return "(%.3f, %.3f, %.3f)" % [value.x, value.y, value.z]


func _create_avatar_mount() -> void:
	if _avatar_mount != null and is_instance_valid(_avatar_mount):
		return
	_avatar_mount = Node3D.new()
	_avatar_mount.name = "avatar_mount"
	add_child(_avatar_mount)


func _reset_avatar_mount() -> void:
	if _avatar_mount == null or not is_instance_valid(_avatar_mount):
		return
	_stop_motion_animation()
	_stop_procedural_bone_motion()
	_avatar_mount.position = Vector3.ZERO
	_avatar_mount.rotation_degrees = Vector3.ZERO
	_avatar_mount.scale = Vector3.ONE
	_store_motion_base_from_mount()


func _clear_model() -> void:
	_stop_motion_animation()
	_stop_procedural_bone_motion()
	if _avatar_mount != null and is_instance_valid(_avatar_mount):
		_avatar_mount.queue_free()
	_avatar_mount = null
	_motion_base_position = Vector3.ZERO
	_motion_base_rotation_degrees = Vector3.ZERO
	_skeleton = null
	_procedural_bones.clear()
	_procedural_bone_base_rotations.clear()
	_idle_base_pose.clear()
	_blend_shape_entries.clear()
	_lip_sync_mouth_entries.clear()
	_lip_sync_mouth_active = ""
	_model = null
	_placeholder = null


func _reset_empty_view() -> void:
	_last_bounds = AABB(Vector3(-0.5, 0.0, -0.5), Vector3(1.0, TARGET_AVATAR_HEIGHT, 1.0))
	_camera_target = Vector3(0.0, 1.0, 0.0)
	_auto_camera_distance = DEFAULT_CAMERA_DISTANCE


func _create_placeholder() -> void:
	var cube := MeshInstance3D.new()
	cube.name = "PlaceholderCube"
	var mesh := BoxMesh.new()
	mesh.size = Vector3(0.85, 1.7, 0.45)
	cube.mesh = mesh
	cube.position.y = 0.85

	var material := StandardMaterial3D.new()
	material.albedo_color = Color(0.68, 0.72, 0.78)
	material.roughness = 0.65
	cube.set_surface_override_material(0, material)

	_model = Node3D.new()
	_model.name = "FallbackAvatar"
	_model.add_child(cube)
	_create_avatar_mount()
	_reset_avatar_mount()
	_avatar_mount.add_child(_model)
	_placeholder = cube
	_last_bounds = AABB(Vector3(-0.425, 0.0, -0.225), Vector3(0.85, 1.7, 0.45))
	_camera_target = _last_bounds.get_center()
	_auto_camera_distance = _calculate_camera_distance(_last_bounds)
	set_emotion(_current_emotion)
	_play_motion_animation(_current_motion)


func _normalize_motion(motion: String) -> String:
	var normalized := motion.strip_edges().to_lower()
	if normalized.is_empty():
		return MOTION_IDLE
	if not SUPPORTED_MOTIONS.has(normalized):
		return MOTION_IDLE
	return normalized


func _resolve_motion_file_path(path: String) -> String:
	if path.begins_with("res://") or path.begins_with("user://"):
		return path.simplify_path()
	if path.is_absolute_path():
		return path.simplify_path()
	return ProjectPathsScript.repo_file(path)


func _display_motion_file_path(path: String) -> String:
	if path.begins_with("res://") or path.begins_with("user://"):
		return path
	return ProjectPathsScript.display_path(path)


func _play_vrma_motion_file_placeholder(
	resolved_path: String,
	display_path: String,
	fallback_motion: String,
	debug_lines: PackedStringArray
) -> Dictionary:
	debug_lines.append("VRMA motion_file route selected: %s" % display_path)
	if FileAccess.file_exists(resolved_path):
		debug_lines.append("VRMA motion_file found: %s" % display_path)
	else:
		debug_lines.append("VRMA motion_file was not found: %s" % display_path)
	debug_lines.append("VRMA playback is not implemented in the Godot runtime yet")
	return _play_motion_file_fallback(
		"VRMA motion_file unsupported: %s" % display_path,
		debug_lines,
		fallback_motion
	)


func _play_motion_file_fallback(message: String, debug_lines: PackedStringArray, fallback_motion: String) -> Dictionary:
	var normalized_fallback := _normalize_motion(fallback_motion)
	var fallback_status := _play_motion_animation(normalized_fallback)
	var fallback_message := String(fallback_status.get("message", ""))
	if not fallback_message.is_empty():
		debug_lines.append("motion_file fallback status: %s" % fallback_message)
	var fallback_debug: Variant = fallback_status.get("debug", PackedStringArray())
	if typeof(fallback_debug) == TYPE_PACKED_STRING_ARRAY:
		debug_lines.append_array(fallback_debug)
	elif typeof(fallback_debug) == TYPE_ARRAY:
		for line in fallback_debug:
			debug_lines.append(String(line))
	return {
		"mode": "motion_file_fallback",
		"message": "%s; using fallback motion: %s" % [message, normalized_fallback],
		"debug": debug_lines,
	}


func _normalize_emotion(emotion: String) -> String:
	var normalized := emotion.strip_edges().to_lower()
	if ["happy", "neutral", "sad", "angry"].has(normalized):
		return normalized
	return "neutral"


func _ensure_motion_player() -> void:
	if _motion_player != null and is_instance_valid(_motion_player):
		return
	_motion_player = AnimationPlayer.new()
	_motion_player.name = "InternalMotionPlayer"
	add_child(_motion_player)

	_motion_library = AnimationLibrary.new()
	_motion_player.add_animation_library(MOTION_LIBRARY_NAME, _motion_library)


func _rebuild_motion_library(base_position: Vector3, base_rotation_degrees: Vector3) -> void:
	_ensure_motion_player()
	_remove_motion_animation(EXTERNAL_MOTION_NAME)
	for motion in SUPPORTED_MOTIONS:
		_remove_motion_animation(motion)

	_add_motion_animation(MOTION_IDLE, 2.8,
		[
			{"time": 0.0, "value": base_position},
			{"time": 0.7, "value": base_position + Vector3(0.0, 0.012, 0.0)},
			{"time": 1.4, "value": base_position},
			{"time": 2.1, "value": base_position + Vector3(0.0, 0.008, 0.0)},
			{"time": 2.8, "value": base_position},
		],
		[
			{"time": 0.0, "value": base_rotation_degrees},
			{"time": 2.8, "value": base_rotation_degrees},
		]
	)
	_add_motion_animation(MOTION_TALK, 0.72,
		[
			{"time": 0.0, "value": base_position},
			{"time": 0.18, "value": base_position + Vector3(0.0, 0.026, 0.0)},
			{"time": 0.36, "value": base_position + Vector3(0.0, 0.006, 0.0)},
			{"time": 0.54, "value": base_position + Vector3(0.0, 0.018, 0.0)},
			{"time": 0.72, "value": base_position},
		],
		[
			{"time": 0.0, "value": base_rotation_degrees},
			{"time": 0.18, "value": base_rotation_degrees + Vector3(0.0, 1.4, 0.0)},
			{"time": 0.36, "value": base_rotation_degrees + Vector3(0.0, -1.4, 0.0)},
			{"time": 0.54, "value": base_rotation_degrees + Vector3(0.0, 0.8, 0.0)},
			{"time": 0.72, "value": base_rotation_degrees},
		]
	)
	_add_motion_animation(MOTION_HAPPY, 0.84,
		[
			{"time": 0.0, "value": base_position},
			{"time": 0.18, "value": base_position + Vector3(0.0, 0.082, 0.0)},
			{"time": 0.36, "value": base_position + Vector3(0.0, 0.014, 0.0)},
			{"time": 0.56, "value": base_position + Vector3(0.0, 0.058, 0.0)},
			{"time": 0.84, "value": base_position},
		],
		[
			{"time": 0.0, "value": base_rotation_degrees},
			{"time": 0.84, "value": base_rotation_degrees},
		]
	)
	_add_motion_animation(MOTION_BOW, 2.0,
		[
			{"time": 0.0, "value": base_position},
			{"time": 0.45, "value": base_position + Vector3(0.0, -0.012, 0.0)},
			{"time": 0.9, "value": base_position},
			{"time": 2.0, "value": base_position},
		],
		[
			{"time": 0.0, "value": base_rotation_degrees},
			{"time": 0.45, "value": base_rotation_degrees + Vector3(9.0, 0.0, 0.0)},
			{"time": 0.9, "value": base_rotation_degrees},
			{"time": 2.0, "value": base_rotation_degrees},
		]
	)
	_add_motion_animation(MOTION_DANCE, 1.2,
		[
			{"time": 0.0, "value": base_position},
			{"time": 0.2, "value": base_position + Vector3(-0.05, 0.038, 0.0)},
			{"time": 0.4, "value": base_position + Vector3(0.0, 0.012, 0.0)},
			{"time": 0.6, "value": base_position + Vector3(0.05, 0.046, 0.0)},
			{"time": 0.8, "value": base_position + Vector3(0.0, 0.012, 0.0)},
			{"time": 1.0, "value": base_position + Vector3(-0.03, 0.034, 0.0)},
			{"time": 1.2, "value": base_position},
		],
		[
			{"time": 0.0, "value": base_rotation_degrees},
			{"time": 0.2, "value": base_rotation_degrees + Vector3(0.0, -5.0, 0.0)},
			{"time": 0.4, "value": base_rotation_degrees + Vector3(0.0, 0.0, 1.5)},
			{"time": 0.6, "value": base_rotation_degrees + Vector3(0.0, 5.0, 0.0)},
			{"time": 0.8, "value": base_rotation_degrees + Vector3(0.0, 0.0, -1.5)},
			{"time": 1.0, "value": base_rotation_degrees + Vector3(0.0, -3.0, 0.0)},
			{"time": 1.2, "value": base_rotation_degrees},
		]
	)
	_add_motion_animation(MOTION_WAVE, 1.0,
		[
			{"time": 0.0, "value": base_position},
			{"time": 0.25, "value": base_position + Vector3(-0.018, 0.006, 0.0)},
			{"time": 0.5, "value": base_position + Vector3(0.018, 0.006, 0.0)},
			{"time": 0.75, "value": base_position + Vector3(-0.012, 0.004, 0.0)},
			{"time": 1.0, "value": base_position},
		],
		[
			{"time": 0.0, "value": base_rotation_degrees},
			{"time": 0.25, "value": base_rotation_degrees + Vector3(0.0, 0.0, 3.2)},
			{"time": 0.5, "value": base_rotation_degrees + Vector3(0.0, 0.0, -3.2)},
			{"time": 0.75, "value": base_rotation_degrees + Vector3(0.0, 0.0, 2.0)},
			{"time": 1.0, "value": base_rotation_degrees},
		]
	)


func _add_motion_animation(animation_name: String, length: float, position_keys: Array, rotation_keys: Array) -> void:
	_motion_library.add_animation(animation_name, _build_motion_animation(length, position_keys, rotation_keys))


func _remove_motion_animation(animation_name: String) -> void:
	if _motion_library != null and _motion_library.has_animation(animation_name):
		_motion_library.remove_animation(animation_name)


func _build_motion_animation(length: float, position_keys: Array, rotation_keys: Array) -> Animation:
	var animation := Animation.new()
	animation.length = length
	animation.loop_mode = Animation.LOOP_LINEAR
	_add_value_track(animation, NodePath("avatar_mount:position"), _scale_motion_keys(position_keys))
	_add_value_track(animation, NodePath("avatar_mount:rotation_degrees"), _scale_motion_keys(rotation_keys))
	return animation


func _add_value_track(animation: Animation, path: NodePath, keys: Array) -> void:
	var track := animation.add_track(Animation.TYPE_VALUE)
	animation.track_set_path(track, path)
	for key in keys:
		animation.track_insert_key(track, float(key["time"]), key["value"])


func _scale_motion_keys(keys: Array) -> Array:
	if keys.is_empty():
		return keys
	var scale := _emotion_motion_scale()
	var base_value: Variant = keys[0].get("value", Vector3.ZERO)
	if typeof(base_value) != TYPE_VECTOR3:
		return keys

	var scaled_keys: Array = []
	var base_vector := base_value as Vector3
	for key in keys:
		if typeof(key) != TYPE_DICTIONARY:
			continue
		var source_key: Dictionary = key
		var scaled_key := source_key.duplicate(true)
		var value: Variant = scaled_key.get("value", base_vector)
		if typeof(value) == TYPE_VECTOR3:
			scaled_key["value"] = base_vector + ((value as Vector3) - base_vector) * scale
		scaled_keys.append(scaled_key)
	return scaled_keys


func _emotion_motion_scale() -> float:
	match _current_emotion:
		"happy":
			return 1.25
		"sad":
			return 0.55
		"angry":
			return 1.18
		_:
			return 1.0


func _play_motion_animation(motion: String) -> Dictionary:
	var normalized := _normalize_motion(motion)
	if _avatar_mount == null or not is_instance_valid(_avatar_mount):
		return {
			"mode": "deferred",
			"message": "fallback internal motion: %s (model not loaded)" % normalized,
		}
	if _motion_player != null and is_instance_valid(_motion_player):
		_motion_player.stop()
	_stop_external_retarget_motion()
	_stop_procedural_bone_motion()
	_avatar_mount.position = _motion_base_position
	_avatar_mount.rotation_degrees = _motion_base_rotation_degrees
	if normalized == MOTION_RUN:
		_reset_all_bones_to_idle_base_pose()
	var external_status := _try_play_external_motion(normalized)
	if bool(external_status.get("ok", false)):
		if normalized == MOTION_IDLE:
			var external_debug := PackedStringArray()
			external_debug.append_array(external_status.get("debug", PackedStringArray()))
			_append_arm_pose_debug(external_debug, "idle motion")
			external_status["debug"] = external_debug
		return external_status
	if EXTERNAL_ONLY_MOTIONS.has(normalized):
		_rebuild_motion_library(_motion_base_position, _motion_base_rotation_degrees)
		_motion_player.play(MOTION_IDLE)
		var external_only_reason := String(external_status.get("reason", "external %s motion unavailable" % normalized))
		return {
			"mode": "internal",
			"message": "fallback internal motion: %s (%s); using idle" % [normalized, external_only_reason],
			"debug": external_status.get("debug", PackedStringArray()),
		}

	var procedural_status := _try_play_procedural_bone_motion(normalized)
	if bool(procedural_status.get("ok", false)):
		var procedural_debug := PackedStringArray()
		procedural_debug.append_array(external_status.get("debug", PackedStringArray()))
		if normalized == MOTION_IDLE:
			_append_arm_pose_debug(procedural_debug, "idle motion")
		if not procedural_debug.is_empty():
			procedural_status["debug"] = procedural_debug
		return procedural_status

	_rebuild_motion_library(_motion_base_position, _motion_base_rotation_degrees)
	_motion_player.play(normalized)
	var fallback_debug := PackedStringArray()
	fallback_debug.append_array(external_status.get("debug", PackedStringArray()))
	if normalized == MOTION_IDLE:
		_append_arm_pose_debug(fallback_debug, "idle motion")
	return {
		"mode": "internal",
		"message": "fallback internal motion: %s (%s)" % [normalized, String(procedural_status.get("reason", external_status.get("reason", "procedural bone motion unavailable")))],
		"debug": fallback_debug,
	}


func _stop_motion_animation() -> void:
	if _motion_player != null and is_instance_valid(_motion_player):
		_motion_player.stop()
	_stop_external_retarget_motion()


func _store_motion_base_from_mount() -> void:
	if _avatar_mount == null or not is_instance_valid(_avatar_mount):
		return
	_motion_base_position = _avatar_mount.position
	_motion_base_rotation_degrees = _avatar_mount.rotation_degrees


func _refresh_skeleton(debug_lines: PackedStringArray) -> void:
	_skeleton = _find_primary_skeleton(_model)
	_procedural_bones.clear()
	_procedural_bone_base_rotations.clear()
	_idle_base_pose.clear()
	if _skeleton == null:
		debug_lines.append("Skeleton3D: not found")
		return

	var bone_count := _skeleton.get_bone_count()
	debug_lines.append("Skeleton3D: %s (%s bones)" % [_skeleton.name, bone_count])
	for bone_index in range(bone_count):
		debug_lines.append("Bone %s: %s" % [bone_index, _skeleton.get_bone_name(bone_index)])
		_procedural_bone_base_rotations[bone_index] = _skeleton.get_bone_pose_rotation(bone_index)
		_procedural_bone_base_positions[bone_index] = _skeleton.get_bone_pose_position(bone_index)

	_map_procedural_bones()
	_append_arm_bone_mapping_summary(debug_lines)
	var idle_base_applied := _build_idle_base_pose()
	if not _idle_base_pose.is_empty():
		_apply_idle_base_pose()
	if idle_base_applied:
		debug_lines.append("Applied idle base pose")
		debug_lines.append("Applied corrected idle arm pose")
		_append_idle_arm_correction_debug(debug_lines)
	_append_arm_pose_debug(debug_lines, "model display idle_base_pose")
	_append_arm_basis_debug(debug_lines, "model display idle_base_pose")


func _refresh_blend_shapes(debug_lines: PackedStringArray) -> void:
	_blend_shape_entries.clear()
	_lip_sync_mouth_entries.clear()
	if _model == null:
		debug_lines.append("BlendShape/ShapeKey: model not loaded")
		return

	var meshes: Array[MeshInstance3D] = []
	_collect_meshes(_model, meshes)
	for mesh_instance in meshes:
		var blend_shape_count := mesh_instance.get_blend_shape_count()
		if blend_shape_count <= 0:
			continue
		debug_lines.append("BlendShape/ShapeKey mesh: %s (%s)" % [mesh_instance.name, blend_shape_count])
		for property in mesh_instance.get_property_list():
			var property_name := String(property.get("name", ""))
			if not property_name.begins_with("blend_shapes/"):
				continue
			var display_name := property_name.trim_prefix("blend_shapes/")
			debug_lines.append("BlendShape/ShapeKey: %s/%s" % [mesh_instance.name, display_name])
			var entry := {
				"mesh": mesh_instance,
				"property": property_name,
				"name": display_name,
				"normalized": _normalize_blend_shape_name(display_name),
				"base": float(mesh_instance.get(property_name)),
			}
			_blend_shape_entries.append(entry)
			if _is_lip_sync_mouth_blend_shape(String(entry.get("normalized", ""))):
				_lip_sync_mouth_entries[String(entry.get("normalized", ""))] = entry

	if _blend_shape_entries.is_empty():
		debug_lines.append("BlendShape/ShapeKey: none")


func _normalize_blend_shape_name(value: String) -> String:
	return value.to_lower() \
		.replace("_", "") \
		.replace(".", "") \
		.replace("-", "") \
		.replace(" ", "")


func _blend_shape_leaf_name(normalized_name: String) -> String:
	var leaf := normalized_name
	for separator in ["/", "\\", ":"]:
		if leaf.contains(separator):
			var parts := leaf.split(separator, false)
			if not parts.is_empty():
				leaf = String(parts[parts.size() - 1])
	return leaf


func _blend_shape_names_match(actual_normalized: String, requested_normalized: String) -> bool:
	if actual_normalized == requested_normalized:
		return true
	var actual_leaf := _blend_shape_leaf_name(actual_normalized)
	var requested_leaf := _blend_shape_leaf_name(requested_normalized)
	return not actual_leaf.is_empty() and actual_leaf == requested_leaf


func _is_lip_sync_mouth_blend_shape(normalized_name: String) -> bool:
	for mouth_name in LIP_SYNC_MOUTH_BLEND_SHAPES:
		if _blend_shape_names_match(normalized_name, _normalize_blend_shape_name(String(mouth_name))):
			return true
	return false


func _find_lip_sync_mouth_entry(normalized_name: String) -> Dictionary:
	if _lip_sync_mouth_entries.has(normalized_name):
		var exact_entry: Variant = _lip_sync_mouth_entries[normalized_name]
		if typeof(exact_entry) == TYPE_DICTIONARY:
			return exact_entry

	for available_name in _lip_sync_mouth_entries.keys():
		if not _blend_shape_names_match(String(available_name), normalized_name):
			continue
		var suffix_entry: Variant = _lip_sync_mouth_entries[available_name]
		if typeof(suffix_entry) == TYPE_DICTIONARY:
			return suffix_entry

	return {}


func _format_available_blend_shape_names() -> String:
	var names := PackedStringArray()
	for entry in _blend_shape_entries:
		names.append(String(entry.get("name", "")))
	if names.is_empty():
		return "(none)"
	return ", ".join(names)


func _reset_lip_sync_mouth_shapes() -> void:
	for entry in _lip_sync_mouth_entries.values():
		if typeof(entry) != TYPE_DICTIONARY:
			continue
		var mesh_instance := (entry as Dictionary).get("mesh") as MeshInstance3D
		if mesh_instance != null:
			mesh_instance.set(String((entry as Dictionary).get("property", "")), 0.0)


func _apply_blend_shape_emotion(emotion: String) -> Dictionary:
	if _blend_shape_entries.is_empty():
		return {
			"applied": false,
			"names": PackedStringArray(),
		}

	for entry in _blend_shape_entries:
		var mesh_instance := entry.get("mesh") as MeshInstance3D
		var normalized_name := String(entry.get("normalized", ""))
		if mesh_instance != null and not _is_lip_sync_mouth_blend_shape(normalized_name):
			mesh_instance.set(String(entry.get("property", "")), float(entry.get("base", 0.0)))

	var targets: Dictionary = EMOTION_BLEND_SHAPE_ALIASES.get(emotion, {})
	var applied_names := PackedStringArray()
	if targets.is_empty():
		return {
			"applied": false,
			"names": applied_names,
		}

	for entry in _blend_shape_entries:
		var normalized_name := String(entry.get("normalized", ""))
		if _is_lip_sync_mouth_blend_shape(normalized_name):
			continue
		if normalized_name.begins_with("hide") or normalized_name.begins_with("hdie"):
			continue
		for alias in targets.keys():
			var normalized_alias := _normalize_blend_shape_name(String(alias))
			if normalized_name.contains(normalized_alias) or normalized_alias.contains(normalized_name):
				var mesh_instance := entry.get("mesh") as MeshInstance3D
				if mesh_instance != null:
					mesh_instance.set(String(entry.get("property", "")), float(targets[alias]))
					applied_names.append(String(entry.get("name", "")))
				break

	return {
		"applied": not applied_names.is_empty(),
		"names": applied_names,
	}


func _find_primary_skeleton(node: Node) -> Skeleton3D:
	if node == null:
		return null
	var best: Skeleton3D = null
	if node is Skeleton3D:
		best = node as Skeleton3D
	for child in node.get_children():
		var candidate := _find_primary_skeleton(child)
		if candidate == null:
			continue
		if best == null or candidate.get_bone_count() > best.get_bone_count():
			best = candidate
	return best


func _map_procedural_bones() -> void:
	if _skeleton == null:
		return
	for target_name in PROCEDURAL_BONE_ALIASES.keys():
		var bone_index := _find_best_matching_bone(
			String(target_name),
			PROCEDURAL_BONE_ALIASES[target_name]
		)
		if bone_index >= 0:
			_procedural_bones[target_name] = bone_index


func _find_bone_by_aliases(aliases: Array) -> int:
	return _find_best_matching_bone("", aliases)


func _find_best_matching_bone(target_key: String, aliases: Array, required_side: String = "") -> int:
	if _skeleton == null or not is_instance_valid(_skeleton):
		return -1
	var normalized_aliases := _normalized_bone_aliases(aliases)
	if normalized_aliases.is_empty():
		return -1

	var target_side := required_side
	if target_side.is_empty():
		target_side = _target_side_for_key(target_key)
	elif target_side == "*":
		target_side = ""

	for alias in normalized_aliases:
		var normalized_alias := String(alias)
		for bone_index in range(_skeleton.get_bone_count()):
			var bone_name := _skeleton.get_bone_name(bone_index)
			var normalized_bone_name := _normalized_bone_compare_name(bone_name)
			if _should_skip_bone_candidate_for_key(target_key, normalized_bone_name):
				continue
			if not _bone_candidate_matches_side(bone_name, target_side):
				continue
			if normalized_bone_name == normalized_alias:
				return bone_index

	if _requires_exact_bone_match(target_key):
		return -1

	for bone_index in range(_skeleton.get_bone_count()):
		var bone_name := _skeleton.get_bone_name(bone_index)
		var normalized_bone_name := _normalized_bone_compare_name(bone_name)
		if _should_skip_bone_candidate_for_key(target_key, normalized_bone_name):
			continue
		if not _bone_candidate_matches_side(bone_name, target_side):
			continue
		for alias in normalized_aliases:
			var normalized_alias := String(alias)
			if normalized_bone_name.contains(normalized_alias):
				return bone_index
	return -1


func _normalized_bone_aliases(aliases: Array) -> PackedStringArray:
	var normalized_aliases := PackedStringArray()
	for alias in aliases:
		var normalized_alias := _normalized_bone_compare_name(String(alias))
		if normalized_alias.length() < 3:
			continue
		if normalized_aliases.find(normalized_alias) >= 0:
			continue
		normalized_aliases.append(normalized_alias)
	return normalized_aliases


func _target_side_for_key(target_key: String) -> String:
	if target_key.begins_with("left_"):
		return "left"
	if target_key.begins_with("right_"):
		return "right"
	return ""


func _bone_candidate_matches_side(bone_name: String, target_side: String) -> bool:
	if target_side.is_empty():
		return true
	var candidate_side := _bone_side_for_name(bone_name)
	return candidate_side.is_empty() or candidate_side == target_side


func _requires_exact_bone_match(target_key: String) -> bool:
	return STRICT_EXACT_ARM_BONE_KEYS.has(target_key)


func _should_skip_bone_candidate_for_key(target_key: String, normalized_bone_name: String) -> bool:
	if _is_arm_or_hand_target_key(target_key) and _is_finger_bone_name(normalized_bone_name):
		return true
	if target_key.ends_with("_hand") and _is_finger_bone_name(normalized_bone_name):
		return true
	return false


func _is_arm_or_hand_target_key(target_key: String) -> bool:
	return ARM_BONE_MAPPING_KEYS.has(target_key)


func _is_finger_bone_name(normalized_name: String) -> bool:
	for marker in FINGER_BONE_NAME_MARKERS:
		if normalized_name.contains(String(marker)):
			return true
	return false


func _is_hand_or_finger_bone_name(normalized_name: String) -> bool:
	return normalized_name.contains("hand") or _is_finger_bone_name(normalized_name)


func _normalize_bone_name(value: String) -> String:
	return value.to_lower() \
		.replace("_", "") \
		.replace(".", "") \
		.replace("-", "") \
		.replace(" ", "") \
		.replace("armature", "")


func _build_idle_base_pose() -> bool:
	if _skeleton == null or not is_instance_valid(_skeleton):
		return false

	for bone_index in _procedural_bone_base_rotations.keys():
		_idle_base_pose[int(bone_index)] = _procedural_bone_base_rotations[bone_index]

	var applied := false
	for bone_key in IDLE_BASE_POSE_OFFSETS.keys():
		if not _procedural_bones.has(bone_key):
			continue
		var bone_index := int(_procedural_bones[bone_key])
		var base_rotation: Quaternion = _procedural_bone_base_rotations.get(
			bone_index,
			_skeleton.get_bone_pose_rotation(bone_index)
		)
		var offset: Vector3 = IDLE_BASE_POSE_OFFSETS.get(bone_key, Vector3.ZERO)
		_idle_base_pose[bone_index] = base_rotation * _euler_degrees_to_quaternion(offset)
		applied = true
	if _align_idle_upper_arm_to_world_direction(
		"left_upper_arm",
		"left_lower_arm",
		Vector3(IDLE_ARM_VISUAL_DOWN_SIDE_OFFSET, -1.0, 0.0)
	):
		applied = true
	if _align_idle_upper_arm_to_world_direction(
		"right_upper_arm",
		"right_lower_arm",
		Vector3(-IDLE_ARM_VISUAL_DOWN_SIDE_OFFSET, -1.0, 0.0)
	):
		applied = true
	return applied


func _apply_idle_base_pose() -> void:
	_reset_procedural_bone_poses()


func _align_idle_upper_arm_to_world_direction(upper_key: String, lower_key: String, target_direction: Vector3) -> bool:
	var upper_index := _find_mapped_bone_index(upper_key)
	var lower_index := _find_mapped_bone_index(lower_key)
	if upper_index < 0 or lower_index < 0:
		return false
	var current_upper := _computed_bone_global_pose_transform(upper_index)
	var current_lower := _computed_bone_global_pose_transform(lower_index)
	var current_direction := current_lower.origin - current_upper.origin
	if current_direction.length_squared() < 0.000001:
		return false
	var desired_direction := target_direction.normalized()
	if desired_direction.length_squared() < 0.000001:
		return false

	var parent_transform := Transform3D.IDENTITY
	var parent_index := _skeleton.get_bone_parent(upper_index)
	if parent_index >= 0:
		parent_transform = _computed_bone_global_pose_transform(parent_index)
	var pre_pose_basis := (parent_transform.basis * _skeleton.get_bone_rest(upper_index).basis).orthonormalized()
	var global_align_basis := Basis(Quaternion(current_direction.normalized(), desired_direction)).orthonormalized()
	var local_align_basis := (pre_pose_basis.inverse() * global_align_basis * pre_pose_basis).orthonormalized()
	var current_rotation: Quaternion = _idle_base_pose.get(
		upper_index,
		_procedural_bone_base_rotations.get(upper_index, Quaternion.IDENTITY)
	)
	_idle_base_pose[upper_index] = (local_align_basis * Basis(current_rotation)).orthonormalized().get_rotation_quaternion()
	return true


func _euler_degrees_to_quaternion(euler_degrees: Vector3) -> Quaternion:
	return Quaternion.from_euler(Vector3(
		deg_to_rad(euler_degrees.x),
		deg_to_rad(euler_degrees.y),
		deg_to_rad(euler_degrees.z)
	))


func _try_play_procedural_bone_motion(motion: String) -> Dictionary:
	if _skeleton == null or not is_instance_valid(_skeleton):
		return {
			"ok": false,
			"reason": "Skeleton3D not found",
		}
	if not _has_required_procedural_bones(motion):
		return {
			"ok": false,
			"reason": "required procedural bones not found",
		}

	_reset_procedural_bone_poses()
	_procedural_motion_name = motion
	_procedural_motion_time = 0.0
	_procedural_motion_active = true
	return {
		"ok": true,
		"mode": "procedural_bone",
		"message": "Procedural bone motion: %s" % motion,
	}


func _has_required_procedural_bones(motion: String) -> bool:
	match motion:
		MOTION_HAPPY:
			return _has_bone("left_upper_arm") and _has_bone("right_upper_arm")
		MOTION_WAVE:
			return _has_bone("right_upper_arm")
		MOTION_BOW:
			return _has_any_bone(["spine", "chest", "head"])
		MOTION_DANCE:
			return _has_any_bone(["spine", "chest"]) and _has_bone("left_upper_arm") and _has_bone("right_upper_arm")
		MOTION_TALK:
			return _has_any_bone(["head", "chest", "spine"])
		_:
			return _has_any_bone(["head", "chest", "spine"])


func _has_bone(key: String) -> bool:
	return _procedural_bones.has(key)


func _has_any_bone(keys: Array) -> bool:
	for key in keys:
		if _has_bone(String(key)):
			return true
	return false


func _stop_procedural_bone_motion() -> void:
	_procedural_motion_active = false
	_procedural_motion_name = ""
	_procedural_motion_time = 0.0
	_reset_procedural_bone_poses()


func _reset_procedural_bone_poses() -> void:
	if _skeleton == null or not is_instance_valid(_skeleton):
		return
	if not _idle_base_pose.is_empty():
		_reset_all_bones_to_idle_base_pose()
		return
	for bone_index in _procedural_bone_base_rotations.keys():
		var index := int(bone_index)
		_skeleton.set_bone_pose_rotation(index, _procedural_bone_base_rotations[index])
		if _procedural_bone_base_positions.has(index):
			_skeleton.set_bone_pose_position(index, _procedural_bone_base_positions[index])


func _reset_all_bones_to_idle_base_pose() -> void:
	if _skeleton == null or not is_instance_valid(_skeleton):
		return
	for bone_index in _idle_base_pose.keys():
		var index := int(bone_index)
		_skeleton.set_bone_pose_rotation(index, _idle_base_pose[index])
		if _procedural_bone_base_positions.has(index):
			_skeleton.set_bone_pose_position(index, _procedural_bone_base_positions[index])


func _append_arm_pose_debug(debug_lines: PackedStringArray, label: String) -> void:
	if _skeleton == null or not is_instance_valid(_skeleton):
		debug_lines.append("%s arm pose skipped: Skeleton3D not found" % label)
		return
	debug_lines.append("%s arm pose rotations:" % label)
	for bone_key in RUN_RETARGET_ARM_LOCK_KEYS:
		var key := String(bone_key)
		var bone_index := _find_mapped_bone_index(key)
		if bone_index < 0:
			debug_lines.append("%s %s pose_rotation=missing" % [label, key])
			continue
		var pose_rotation := _skeleton.get_bone_pose_rotation(bone_index)
		var idle_rotation: Quaternion = _idle_base_pose.get(bone_index, pose_rotation)
		debug_lines.append(
			"%s %s bone=%s index=%s pose_rotation=%s idle_base=%s" % [
				label,
				key,
				_skeleton.get_bone_name(bone_index),
				bone_index,
				_format_quaternion(pose_rotation),
				_format_quaternion(idle_rotation),
			]
		)


func _append_arm_bone_mapping_summary(debug_lines: PackedStringArray) -> void:
	if _skeleton == null or not is_instance_valid(_skeleton):
		debug_lines.append("Arm bone mapping summary skipped: Skeleton3D not found")
		return
	debug_lines.append("Arm bone mapping summary:")
	for bone_key in ARM_BONE_MAPPING_KEYS:
		var key := String(bone_key)
		if not _procedural_bones.has(key):
			debug_lines.append("arm_map %s=missing" % key)
			continue
		var bone_index := int(_procedural_bones[key])
		debug_lines.append(
			"arm_map %s bone=%s index=%s" % [
				key,
				_skeleton.get_bone_name(bone_index),
				bone_index,
			]
		)


func _append_idle_arm_correction_debug(debug_lines: PackedStringArray) -> void:
	debug_lines.append(
		"idle arm correction values: legacy_upper_forward=%.1f upper_x_down=%.1f upper_y_align=%.1f upper_z_trim=%.1f shoulder_z=%.1f lower_bend=%.1f hand_relax=%.1f visual_down_side=%.3f walk_arm_scale=%.3f" % [
			IDLE_ARM_UPPER_FORWARD_DEG,
			IDLE_ARM_UPPER_X_DOWN_DEG,
			IDLE_ARM_UPPER_Y_ALIGN_DEG,
			IDLE_ARM_UPPER_Z_TRIM_DEG,
			IDLE_ARM_SHOULDER_Z_DEG,
			IDLE_ARM_LOWER_BEND_DEG,
			IDLE_ARM_HAND_RELAX_DEG,
			IDLE_ARM_VISUAL_DOWN_SIDE_OFFSET,
			WALK_ARM_ROTATION_SCALE,
		]
	)
	debug_lines.append("idle arm correction euler order: Quaternion.from_euler(Vector3(x,y,z)), Godot default YXZ order")
	for bone_key in RUN_RETARGET_ARM_LOCK_KEYS:
		var key := String(bone_key)
		var offset: Vector3 = IDLE_BASE_POSE_OFFSETS.get(key, Vector3.ZERO)
		debug_lines.append("idle arm correction %s offset=%s" % [key, _format_vector3(offset)])


func _append_arm_basis_debug(debug_lines: PackedStringArray, label: String) -> void:
	if _skeleton == null or not is_instance_valid(_skeleton):
		debug_lines.append("%s arm basis skipped: Skeleton3D not found" % label)
		return
	for bone_key in ["left_upper_arm", "right_upper_arm", "left_lower_arm", "right_lower_arm"]:
		var key := String(bone_key)
		var bone_index := _find_mapped_bone_index(key)
		if bone_index < 0:
			debug_lines.append("%s arm basis %s=missing" % [label, key])
			continue
		var rest := _skeleton.get_bone_global_rest(bone_index)
		var computed_pose := _computed_bone_global_pose_transform(bone_index)
		var idle_rotation: Quaternion = _base_pose_rotation_for_bone(bone_index)
		debug_lines.append(
			"%s arm basis %s bone=%s rest_x=%s rest_y=%s rest_z=%s pose_x=%s pose_y=%s pose_z=%s" % [
				label,
				key,
				_skeleton.get_bone_name(bone_index),
				_format_vector3(rest.basis.x.normalized()),
				_format_vector3(rest.basis.y.normalized()),
				_format_vector3(rest.basis.z.normalized()),
				_format_vector3(computed_pose.basis.x.normalized()),
				_format_vector3(computed_pose.basis.y.normalized()),
				_format_vector3(computed_pose.basis.z.normalized()),
			]
		)
		debug_lines.append(
			"%s applied idle quaternion %s=%s" % [
				label,
				key,
				_format_quaternion(idle_rotation),
			]
		)
	_append_arm_segment_direction_debug(debug_lines, label, "left_upper_arm", "left_lower_arm")
	_append_arm_segment_direction_debug(debug_lines, label, "right_upper_arm", "right_lower_arm")
	_append_arm_segment_direction_debug(debug_lines, label, "left_lower_arm", "left_hand")
	_append_arm_segment_direction_debug(debug_lines, label, "right_lower_arm", "right_hand")


func _append_arm_segment_direction_debug(debug_lines: PackedStringArray, label: String, from_key: String, to_key: String) -> void:
	var from_index := _find_mapped_bone_index(from_key)
	var to_index := _find_mapped_bone_index(to_key)
	if from_index < 0 or to_index < 0:
		debug_lines.append("%s final global arm direction %s_to_%s=missing" % [label, from_key, to_key])
		return
	var from_transform := _computed_bone_global_pose_transform(from_index)
	var to_transform := _computed_bone_global_pose_transform(to_index)
	var direction := (to_transform.origin - from_transform.origin).normalized()
	debug_lines.append(
		"%s final global arm direction %s_to_%s dir=%s dot_down=%.3f" % [
			label,
			from_key,
			to_key,
			_format_vector3(direction),
			direction.dot(Vector3.DOWN),
		]
	)


func _computed_bone_global_pose_transform(bone_index: int) -> Transform3D:
	if _skeleton == null or not is_instance_valid(_skeleton) or bone_index < 0:
		return Transform3D.IDENTITY
	var rest := _skeleton.get_bone_rest(bone_index)
	var pose_basis := Basis(_base_pose_rotation_for_bone(bone_index))
	rest.basis = rest.basis * pose_basis
	rest.origin += _base_pose_position_for_bone(bone_index)
	var parent_index := _skeleton.get_bone_parent(bone_index)
	if parent_index >= 0:
		return _computed_bone_global_pose_transform(parent_index) * rest
	return rest


func _format_quaternion(value: Quaternion) -> String:
	return "(x=%.4f, y=%.4f, z=%.4f, w=%.4f)" % [value.x, value.y, value.z, value.w]


func _update_procedural_bone_motion(delta: float) -> void:
	if _skeleton == null or not is_instance_valid(_skeleton):
		_procedural_motion_active = false
		return
	_procedural_motion_time += delta
	_reset_procedural_bone_poses()

	match _procedural_motion_name:
		MOTION_TALK:
			_apply_talk_bone_motion(_procedural_motion_time)
		MOTION_HAPPY:
			_apply_happy_bone_motion(_procedural_motion_time)
		MOTION_WAVE:
			_apply_wave_bone_motion(_procedural_motion_time)
		MOTION_BOW:
			_apply_bow_bone_motion(_procedural_motion_time)
		MOTION_DANCE:
			_apply_dance_bone_motion(_procedural_motion_time)
		_:
			_apply_idle_bone_motion(_procedural_motion_time)


func _apply_idle_bone_motion(time: float) -> void:
	var breathe := sin(time * 1.6)
	_rotate_bone_if_found("chest", Vector3(1.2 * breathe, 0.0, 0.6 * breathe))
	_rotate_bone_if_found("spine", Vector3(0.8 * breathe, 0.0, 0.0))
	_rotate_bone_if_found("head", Vector3(0.8 * breathe, 0.0, 0.0))


func _apply_talk_bone_motion(time: float) -> void:
	var nod := sin(time * 7.5)
	var sway := sin(time * 3.2)
	_rotate_bone_if_found("head", Vector3(2.0 * nod, 2.2 * sway, 0.7 * sway))
	_rotate_bone_if_found("neck", Vector3(1.0 * nod, 1.2 * sway, 0.0))
	_rotate_bone_if_found("chest", Vector3(1.0 * nod, 1.4 * sway, 0.4 * sway))
	_rotate_bone_if_found("spine", Vector3(0.6 * nod, 0.8 * sway, 0.0))


func _apply_happy_bone_motion(time: float) -> void:
	var bounce := absf(sin(time * 5.0))
	var sway := sin(time * 3.0)
	_rotate_bone_if_found("chest", Vector3(3.0 * bounce, 0.0, 2.0 * sway))
	_rotate_bone_if_found("head", Vector3(2.0 * bounce, 1.5 * sway, 0.0))
	_rotate_bone_if_found("left_upper_arm", Vector3(0.0, 0.0, -22.0 - 6.0 * bounce))
	_rotate_bone_if_found("right_upper_arm", Vector3(0.0, 0.0, 22.0 + 6.0 * bounce))
	_rotate_bone_if_found("left_lower_arm", Vector3(0.0, 0.0, -8.0 * bounce))
	_rotate_bone_if_found("right_lower_arm", Vector3(0.0, 0.0, 8.0 * bounce))


func _apply_wave_bone_motion(time: float) -> void:
	var wave := sin(time * 7.0)
	_rotate_bone_if_found("right_shoulder", Vector3(0.0, 0.0, 18.0 + 3.0 * wave))
	_rotate_bone_if_found("right_upper_arm", Vector3(0.0, 0.0, 92.0 + 7.0 * wave))
	_rotate_bone_if_found("right_lower_arm", Vector3(0.0, 0.0, 30.0 + 18.0 * wave))
	_rotate_bone_if_found("right_hand", Vector3(0.0, 0.0, 12.0 * wave))


func _apply_bow_bone_motion(time: float) -> void:
	var phase := (sin(time * 2.0) + 1.0) * 0.5
	var amount := smoothstep(0.0, 1.0, phase)
	_rotate_bone_if_found("spine", Vector3(8.0 * amount, 0.0, 0.0))
	_rotate_bone_if_found("chest", Vector3(12.0 * amount, 0.0, 0.0))
	_rotate_bone_if_found("neck", Vector3(5.0 * amount, 0.0, 0.0))
	_rotate_bone_if_found("head", Vector3(8.0 * amount, 0.0, 0.0))


func _apply_dance_bone_motion(time: float) -> void:
	var sway := sin(time * 4.0)
	var counter := sin(time * 4.0 + PI)
	var bounce := absf(sin(time * 4.0))
	_rotate_bone_if_found("spine", Vector3(2.0 * bounce, 3.0 * sway, 4.0 * sway))
	_rotate_bone_if_found("chest", Vector3(3.0 * bounce, 4.0 * sway, 5.0 * sway))
	_rotate_bone_if_found("head", Vector3(2.0 * bounce, 3.0 * counter, 1.5 * sway))
	_rotate_bone_if_found("left_shoulder", Vector3(0.0, 0.0, -4.0 - 5.0 * sway))
	_rotate_bone_if_found("right_shoulder", Vector3(0.0, 0.0, 4.0 + 5.0 * counter))
	_rotate_bone_if_found("left_upper_arm", Vector3(0.0, 0.0, -28.0 - 10.0 * sway))
	_rotate_bone_if_found("right_upper_arm", Vector3(0.0, 0.0, 28.0 + 10.0 * counter))
	_rotate_bone_if_found("left_lower_arm", Vector3(0.0, 0.0, -10.0 - 6.0 * counter))
	_rotate_bone_if_found("right_lower_arm", Vector3(0.0, 0.0, 10.0 + 6.0 * sway))


func _rotate_bone_if_found(key: String, euler_degrees: Vector3) -> void:
	if _skeleton == null or not _procedural_bones.has(key):
		return
	var bone_index := int(_procedural_bones[key])
	var base_rotation: Quaternion = _idle_base_pose.get(
		bone_index,
		_procedural_bone_base_rotations.get(bone_index, Quaternion.IDENTITY)
	)
	var scaled_euler := euler_degrees * _emotion_motion_scale()
	var delta_rotation := _euler_degrees_to_quaternion(scaled_euler)
	_skeleton.set_bone_pose_rotation(bone_index, base_rotation * delta_rotation)


func _try_play_external_retarget_motion(source: Animation, display_path: String, debug_lines: PackedStringArray, motion: String) -> Dictionary:
	if _skeleton == null or not is_instance_valid(_skeleton):
		return {
			"ok": false,
			"reason": "Skeleton3D not found",
		}

	var normalized_motion := _normalize_motion(motion)
	_append_external_motion_debug(debug_lines, "Experimental Godot GLB retarget route enabled for %s" % normalized_motion)
	_log_external_retarget_scale(normalized_motion, debug_lines)
	var tracks := _build_external_retarget_tracks(source, debug_lines, normalized_motion)
	if tracks.is_empty():
		return {
			"ok": false,
			"reason": "%s has no supported external bone rotation tracks" % display_path,
		}

	_stop_external_retarget_motion()
	_stop_procedural_bone_motion()
	_reset_procedural_bone_poses()
	_external_retarget_tracks = tracks
	_external_retarget_time = 0.0
	_external_retarget_length = _external_retarget_animation_length(source, tracks)
	_external_retarget_motion = normalized_motion
	_external_retarget_active = true
	if normalized_motion == MOTION_RUN:
		if _apply_run_retarget_arm_lock_pose():
			var lock_message := "run arms locked to idle pose"
			if RUN_ARM_LOCK_USE_CUSTOM_POSE:
				lock_message = "run arms forced custom pose"
			_append_external_motion_debug(debug_lines, lock_message)
	_update_external_retarget_motion(0.0)
	if normalized_motion == MOTION_NATURAL_WAVE:
		_apply_natural_wave_left_arm_lock_pose()
		_append_external_motion_debug(debug_lines, "natural_wave left arm locked to idle pose")
	if normalized_motion == MOTION_WALK:
		_append_external_motion_debug(debug_lines, "walk arms locked to idle pose")
		_append_arm_basis_debug(debug_lines, "walk retarget idle_base_pose")

	var applied_bone_count := _count_unique_retarget_bones(tracks)
	_append_external_motion_debug(debug_lines, "External retarget motion loaded: %s" % display_path)
	_append_external_motion_debug(debug_lines, "External retarget applied bones: %s" % applied_bone_count)
	return {
		"ok": true,
		"mode": "external_retarget",
		"message": "External retarget motion loaded: %s" % display_path,
		"debug": debug_lines,
	}


func _build_external_retarget_tracks(source: Animation, debug_lines: PackedStringArray, motion: String) -> Array[Dictionary]:
	var candidates: Array[Dictionary] = []
	var tracks: Array[Dictionary] = []
	var mapped_target_keys := {}
	var skipped_hands_logged := false
	var skipped_walk_arms_logged := false
	var skipped_run_arms_logged := false
	var skipped_natural_wave_non_right_arm_logged := false
	var skipped_side_mismatch_count := 0
	var missing_target_count := 0
	for track in range(source.get_track_count()):
		var track_type := int(source.track_get_type(track))
		if track_type != Animation.TYPE_ROTATION_3D and track_type != Animation.TYPE_POSITION_3D:
			continue

		var source_bone := _external_bone_name_from_track_path(String(source.track_get_path(track)))
		var normalized_source_bone := _normalized_bone_compare_name(source_bone)
		var source_side := _bone_side_for_name(source_bone)
		var retarget_key := _retarget_key_for_external_bone(source_bone)
		if _is_external_retarget_hand_bone(normalized_source_bone) \
				and not (motion == MOTION_NATURAL_WAVE and retarget_key == "right_hand"):
			if not skipped_hands_logged:
				_append_external_motion_debug(debug_lines, "External retarget skipped hands")
				skipped_hands_logged = true
			continue

		var track_role := _external_retarget_track_role_name(track_type)
		var mapped_key := "%s|%s" % [retarget_key, track_role]
		if retarget_key.is_empty() or mapped_target_keys.has(mapped_key):
			continue
		if motion == MOTION_NATURAL_WAVE and not _is_natural_wave_retarget_right_arm_key(retarget_key):
			if not skipped_natural_wave_non_right_arm_logged:
				_append_external_motion_debug(debug_lines, "natural_wave retarget skipped non-right-arm bones")
				skipped_natural_wave_non_right_arm_logged = true
			continue
		if track_type == Animation.TYPE_POSITION_3D and not _allows_external_position_retarget(motion, retarget_key):
			continue
		if motion == MOTION_WALK and _is_walk_retarget_arm_key(retarget_key):
			if not skipped_walk_arms_logged:
				_append_external_motion_debug(debug_lines, "walk retarget skipped arms")
				skipped_walk_arms_logged = true
			continue
		if motion == MOTION_RUN and RUN_RETARGET_EXCLUDE_ARM_BONES and _is_run_retarget_arm_key(retarget_key):
			if not skipped_run_arms_logged:
				_append_external_motion_debug(debug_lines, "run retarget skipped arms")
				skipped_run_arms_logged = true
			continue

		var target_bone_index := _find_retarget_target_bone(retarget_key, source_side)
		if target_bone_index < 0:
			if _retarget_key_requires_side(retarget_key) and not source_side.is_empty():
				var any_side_target := _find_retarget_target_bone_any_side(retarget_key)
				if any_side_target >= 0:
					var target_name := _skeleton.get_bone_name(any_side_target)
					_append_external_motion_debug(
						debug_lines,
						"Retarget side mismatch skipped: source=%s source_side=%s target=%s target_side=%s key=%s" % [
							source_bone,
							source_side,
							target_name,
							_bone_side_for_name(target_name),
							retarget_key,
						]
					)
					skipped_side_mismatch_count += 1
					continue
			_append_external_motion_debug(
				debug_lines,
				"External retarget target missing: source=%s key=%s" % [source_bone, retarget_key]
			)
			missing_target_count += 1
			continue

		var key_count := source.track_get_key_count(track)
		if key_count <= 1:
			continue

		var times: Array[float] = []
		var rotations: Array[Quaternion] = []
		var positions: Array[Vector3] = []
		for key in range(key_count):
			times.append(float(source.track_get_key_time(track, key)))
			if track_type == Animation.TYPE_POSITION_3D:
				positions.append(_vector3_from_variant(source.track_get_key_value(track, key)))
			else:
				rotations.append(_quaternion_from_variant(source.track_get_key_value(track, key)))

		var base_rotation := _base_pose_rotation_for_bone(target_bone_index)
		var base_position := _base_pose_position_for_bone(target_bone_index)
		candidates.append({
			"source_bone": source_bone,
			"retarget_key": retarget_key,
			"track_type": track_type,
			"bone_index": target_bone_index,
			"target_bone": _skeleton.get_bone_name(target_bone_index),
			"base_rotation": base_rotation,
			"base_position": base_position,
			"source_base_rotation": rotations[0] if not rotations.is_empty() else Quaternion.IDENTITY,
			"source_base_position": positions[0] if not positions.is_empty() else Vector3.ZERO,
			"rotation_scale": _retarget_rotation_scale_for_key(motion, retarget_key),
			"position_scale": _retarget_position_scale_for_key(motion, retarget_key),
			"track_role": track_role,
			"source_side": source_side,
			"times": times,
			"rotations": rotations,
			"positions": positions,
		})
	
	for candidate in _ordered_external_retarget_candidates(candidates, motion):
		var retarget_key := String(candidate.get("retarget_key", ""))
		var track_role := String(candidate.get("track_role", "rotation"))
		var mapped_key := "%s|%s" % [retarget_key, track_role]
		if retarget_key.is_empty() or mapped_target_keys.has(mapped_key):
			continue
		var candidate_times: Array = candidate.get("times", [])
		tracks.append(candidate)
		mapped_target_keys[mapped_key] = true
		var track_scale := float(candidate.get("rotation_scale", RETARGET_ROTATION_SCALE))
		if int(candidate.get("track_type", Animation.TYPE_ROTATION_3D)) == Animation.TYPE_POSITION_3D:
			track_scale = float(candidate.get("position_scale", RETARGET_ROTATION_SCALE))
		_append_external_motion_debug(
			debug_lines,
			"External retarget bone mapped: source=%s target=%s key=%s role=%s keys=%s scale=%.3f" % [
				String(candidate.get("source_bone", "")),
				String(candidate.get("target_bone", "")),
				retarget_key,
				track_role,
				candidate_times.size(),
				track_scale,
			]
		)

	_append_external_motion_debug(
		debug_lines,
		"Final retarget map summary: motion=%s candidates=%s mapped=%s side_mismatch_skipped=%s target_missing=%s" % [
			motion,
			candidates.size(),
			tracks.size(),
			skipped_side_mismatch_count,
			missing_target_count,
		]
	)
	return tracks


func _external_retarget_animation_length(source: Animation, tracks: Array[Dictionary]) -> float:
	var length := source.length
	for track in tracks:
		var times: Array = track.get("times", [])
		if times.is_empty():
			continue
		length = maxf(length, float(times[times.size() - 1]))
	return maxf(length, 0.05)


func _count_unique_retarget_bones(tracks: Array[Dictionary]) -> int:
	var bone_indices := {}
	for track in tracks:
		bone_indices[int(track.get("bone_index", -1))] = true
	return bone_indices.size()


func _log_external_retarget_scale(motion: String, debug_lines: PackedStringArray) -> void:
	if motion == MOTION_WALK:
		_append_external_motion_debug(debug_lines, "walk tuning applied")
		_append_external_motion_debug(
			debug_lines,
			"per-category scales: hips=%.3f legs=%.3f arms=%.3f spine=%.3f position=%.3f foot_clamp=(%.1f, %.1f, %.1f)" % [
				WALK_HIPS_ROTATION_SCALE,
				WALK_LEG_ROTATION_SCALE,
				WALK_ARM_ROTATION_SCALE,
				WALK_SPINE_ROTATION_SCALE,
				WALK_POSITION_SCALE,
				WALK_FOOT_ROTATION_CLAMP_DEG.x,
				WALK_FOOT_ROTATION_CLAMP_DEG.y,
				WALK_FOOT_ROTATION_CLAMP_DEG.z,
			]
		)
		return
	if motion == MOTION_NATURAL_WALK:
		_append_external_motion_debug(debug_lines, "natural_walk tuning applied")
		_append_external_motion_debug(
			debug_lines,
			"natural_walk per-category scales: hips=%.3f legs=%.3f arms=%.3f spine=%.3f position=%.3f foot_clamp=(%.1f, %.1f, %.1f)" % [
				NATURAL_WALK_HIPS_ROTATION_SCALE,
				NATURAL_WALK_LEG_ROTATION_SCALE,
				NATURAL_WALK_ARM_ROTATION_SCALE,
				NATURAL_WALK_SPINE_ROTATION_SCALE,
				NATURAL_WALK_POSITION_SCALE,
				WALK_FOOT_ROTATION_CLAMP_DEG.x,
				WALK_FOOT_ROTATION_CLAMP_DEG.y,
				WALK_FOOT_ROTATION_CLAMP_DEG.z,
			]
		)
		return
	if motion == MOTION_NATURAL_WAVE:
		_append_external_motion_debug(debug_lines, "natural_wave tuning applied")
		_append_external_motion_debug(
			debug_lines,
			"natural_wave right arm scale=%.3f" % NATURAL_WAVE_ARM_ROTATION_SCALE
		)
		return
	if motion != MOTION_RUN:
		return
	var body_scale := _retarget_rotation_scale_for_motion(motion)
	var arm_text := "excluded"
	if not RUN_RETARGET_EXCLUDE_ARM_BONES:
		arm_text = "%.3f" % _retarget_rotation_scale_for_key(motion, "left_upper_arm")
	_append_external_motion_debug(
		debug_lines,
		"run retarget scale: body=%.3f arms=%s arm_multiplier=%.3f exclude_arms=%s" % [
			body_scale,
			arm_text,
			RUN_RETARGET_ARM_ROTATION_MULTIPLIER,
			str(RUN_RETARGET_EXCLUDE_ARM_BONES),
		]
	)


func _retarget_rotation_scale_for_motion(motion: String) -> float:
	return float(RETARGET_ROTATION_SCALE_BY_MOTION.get(motion, RETARGET_ROTATION_SCALE))


func _retarget_rotation_scale_for_key(motion: String, retarget_key: String) -> float:
	if motion == MOTION_WALK:
		return _walk_retarget_rotation_scale_for_key(retarget_key)
	if motion == MOTION_NATURAL_WALK:
		return _natural_walk_retarget_rotation_scale_for_key(retarget_key)
	if motion == MOTION_NATURAL_WAVE:
		return _natural_wave_retarget_rotation_scale_for_key(retarget_key)
	var scale := _retarget_rotation_scale_for_motion(motion)
	if motion == MOTION_RUN and _is_run_retarget_arm_key(retarget_key):
		return scale * RUN_RETARGET_ARM_ROTATION_MULTIPLIER
	return scale


func _retarget_position_scale_for_key(motion: String, retarget_key: String) -> float:
	if motion == MOTION_WALK:
		return _walk_retarget_position_scale_for_key(retarget_key)
	if motion == MOTION_NATURAL_WALK:
		return _natural_walk_retarget_position_scale_for_key(retarget_key)
	return _retarget_rotation_scale_for_motion(motion)


func _walk_retarget_rotation_scale_for_key(retarget_key: String) -> float:
	if retarget_key == "hips":
		return WALK_HIPS_ROTATION_SCALE
	if retarget_key.ends_with("_upper_leg") or retarget_key.ends_with("_lower_leg") or retarget_key.ends_with("_foot"):
		return WALK_LEG_ROTATION_SCALE
	if retarget_key.ends_with("_shoulder") or retarget_key.ends_with("_upper_arm") or retarget_key.ends_with("_lower_arm") or retarget_key.ends_with("_hand"):
		return WALK_ARM_ROTATION_SCALE
	if retarget_key == "spine" or retarget_key == "chest" or retarget_key == "neck" or retarget_key == "head":
		return WALK_SPINE_ROTATION_SCALE
	return RETARGET_ROTATION_SCALE


func _walk_retarget_position_scale_for_key(retarget_key: String) -> float:
	if retarget_key == "hips":
		return WALK_POSITION_SCALE
	return 0.0


func _natural_walk_retarget_rotation_scale_for_key(retarget_key: String) -> float:
	if retarget_key == "hips":
		return NATURAL_WALK_HIPS_ROTATION_SCALE
	if retarget_key.ends_with("_upper_leg") or retarget_key.ends_with("_lower_leg") or retarget_key.ends_with("_foot"):
		return NATURAL_WALK_LEG_ROTATION_SCALE
	if retarget_key.ends_with("_shoulder") or retarget_key.ends_with("_upper_arm") or retarget_key.ends_with("_lower_arm") or retarget_key.ends_with("_hand"):
		return NATURAL_WALK_ARM_ROTATION_SCALE
	if retarget_key == "spine" or retarget_key == "chest" or retarget_key == "neck" or retarget_key == "head":
		return NATURAL_WALK_SPINE_ROTATION_SCALE
	return RETARGET_ROTATION_SCALE


func _natural_walk_retarget_position_scale_for_key(retarget_key: String) -> float:
	if retarget_key == "hips":
		return NATURAL_WALK_POSITION_SCALE
	return 0.0


func _natural_wave_retarget_rotation_scale_for_key(retarget_key: String) -> float:
	if _is_natural_wave_retarget_right_arm_key(retarget_key):
		return NATURAL_WAVE_ARM_ROTATION_SCALE
	return 0.0


func _allows_external_position_retarget(motion: String, retarget_key: String) -> bool:
	return retarget_key == "hips" and (motion == MOTION_WALK or motion == MOTION_NATURAL_WALK)


func _is_walk_foot_key(retarget_key: String) -> bool:
	return retarget_key.ends_with("_foot")


func _uses_walk_foot_clamp(motion: String) -> bool:
	return motion == MOTION_WALK or motion == MOTION_NATURAL_WALK


func _clamp_walk_foot_delta_if_needed(motion: String, retarget_key: String, scaled_delta: Quaternion) -> Quaternion:
	if _uses_walk_foot_clamp(motion) and _is_walk_foot_key(retarget_key):
		return _clamp_quaternion_euler_degrees(scaled_delta, WALK_FOOT_ROTATION_CLAMP_DEG)
	return scaled_delta


func _is_walk_retarget_arm_key(retarget_key: String) -> bool:
	return ARM_BONE_MAPPING_KEYS.has(retarget_key)


func _is_run_retarget_arm_key(retarget_key: String) -> bool:
	return RUN_RETARGET_ARM_KEYS.has(retarget_key)


func _is_natural_wave_retarget_right_arm_key(retarget_key: String) -> bool:
	return NATURAL_WAVE_RIGHT_ARM_KEYS.has(retarget_key)


func _ordered_external_retarget_candidates(candidates: Array[Dictionary], motion: String) -> Array[Dictionary]:
	if motion != MOTION_RUN:
		return candidates

	var ordered: Array[Dictionary] = []
	var used_indices := {}
	for retarget_key in RUN_RETARGET_PRIORITY_KEYS:
		for index in range(candidates.size()):
			if used_indices.has(index):
				continue
			if String(candidates[index].get("retarget_key", "")) != retarget_key:
				continue
			ordered.append(candidates[index])
			used_indices[index] = true

	for index in range(candidates.size()):
		if used_indices.has(index):
			continue
		ordered.append(candidates[index])

	return ordered


func _stop_external_retarget_motion() -> void:
	var had_external_retarget := _external_retarget_active \
		or not _external_retarget_tracks.is_empty() \
		or not _external_retarget_motion.is_empty()
	if _skeleton != null and is_instance_valid(_skeleton):
		if not _external_retarget_tracks.is_empty():
			_reset_external_retarget_bone_poses()
		if had_external_retarget:
			_reset_all_bones_to_idle_base_pose()
	_clear_external_retarget_state()


func _clear_external_retarget_state() -> void:
	_external_retarget_active = false
	_external_retarget_tracks.clear()
	_external_retarget_time = 0.0
	_external_retarget_length = 0.0
	_external_retarget_motion = ""


func _reset_external_retarget_bone_poses() -> void:
	if _skeleton == null or not is_instance_valid(_skeleton):
		return
	for track in _external_retarget_tracks:
		var bone_index := int(track.get("bone_index", -1))
		if bone_index < 0:
			continue
		var track_type := int(track.get("track_type", Animation.TYPE_ROTATION_3D))
		if track_type == Animation.TYPE_POSITION_3D:
			var base_position: Vector3 = track.get("base_position", Vector3.ZERO)
			_skeleton.set_bone_pose_position(bone_index, base_position)
		else:
			var base_rotation: Quaternion = track.get("base_rotation", Quaternion.IDENTITY)
			_skeleton.set_bone_pose_rotation(bone_index, base_rotation)


func _find_mapped_bone_index(key: String) -> int:
	if _procedural_bones.has(key):
		return int(_procedural_bones[key])
	var aliases: Array = PROCEDURAL_BONE_ALIASES.get(key, [])
	if aliases.is_empty():
		return -1
	return _find_best_matching_bone(key, aliases)


func _apply_run_retarget_arm_lock_pose() -> bool:
	if _skeleton == null or not is_instance_valid(_skeleton):
		return false
	var locked := false
	for bone_key in RUN_RETARGET_ARM_LOCK_KEYS:
		var key := String(bone_key)
		var bone_index := _find_mapped_bone_index(key)
		if bone_index < 0:
			continue
		var pose_rotation := _base_pose_rotation_for_bone(bone_index)
		if RUN_ARM_LOCK_USE_CUSTOM_POSE:
			pose_rotation = _run_custom_arm_pose_rotation(key, bone_index)
		_skeleton.set_bone_pose_rotation(bone_index, pose_rotation)
		locked = true
	return locked


func _apply_walk_retarget_arm_lock_pose() -> bool:
	if _skeleton == null or not is_instance_valid(_skeleton):
		return false
	var locked := false
	for bone_key in ARM_BONE_MAPPING_KEYS:
		var key := String(bone_key)
		var bone_index := _find_mapped_bone_index(key)
		if bone_index < 0:
			continue
		_skeleton.set_bone_pose_rotation(bone_index, _base_pose_rotation_for_bone(bone_index))
		if _procedural_bone_base_positions.has(bone_index):
			_skeleton.set_bone_pose_position(bone_index, _procedural_bone_base_positions[bone_index])
		locked = true
	return locked


func _apply_natural_wave_left_arm_lock_pose() -> bool:
	if _skeleton == null or not is_instance_valid(_skeleton):
		return false
	var locked := false
	for bone_key in NATURAL_WAVE_LEFT_ARM_LOCK_KEYS:
		var key := String(bone_key)
		var bone_index := _find_mapped_bone_index(key)
		if bone_index < 0:
			continue
		_skeleton.set_bone_pose_rotation(bone_index, _base_pose_rotation_for_bone(bone_index))
		if _procedural_bone_base_positions.has(bone_index):
			_skeleton.set_bone_pose_position(bone_index, _procedural_bone_base_positions[bone_index])
		locked = true
	return locked


func _run_custom_arm_pose_rotation(key: String, bone_index: int) -> Quaternion:
	var base_rotation: Quaternion = _procedural_bone_base_rotations.get(
		bone_index,
		_skeleton.get_bone_pose_rotation(bone_index)
	)
	var mirror := 1.0
	if key.begins_with("right_"):
		mirror = -1.0

	var offset := Vector3.ZERO
	match key:
		"left_shoulder", "right_shoulder":
			offset = Vector3(
				RUN_ARM_SHOULDER_FORWARD_DEG,
				0.0,
				mirror * RUN_ARM_SHOULDER_DOWN_DEG
			)
		"left_upper_arm", "right_upper_arm":
			offset = Vector3(
				RUN_ARM_UPPER_FORWARD_DEG,
				0.0,
				mirror * RUN_ARM_UPPER_DOWN_DEG
			)
		"left_lower_arm", "right_lower_arm":
			offset = Vector3(
				RUN_ARM_LOWER_FORWARD_DEG,
				0.0,
				-mirror * RUN_ARM_LOWER_BEND_DEG
			)
		"left_hand", "right_hand":
			offset = Vector3(
				RUN_ARM_HAND_FORWARD_DEG,
				0.0,
				-mirror * RUN_ARM_HAND_RELAX_DEG
			)
	return base_rotation * _euler_degrees_to_quaternion(offset)


func _update_external_retarget_motion(delta: float) -> void:
	if _skeleton == null or not is_instance_valid(_skeleton):
		_clear_external_retarget_state()
		return
	if _external_retarget_tracks.is_empty():
		_clear_external_retarget_state()
		return

	_external_retarget_time += delta
	var local_time := _external_retarget_time
	if _external_retarget_length > 0.05:
		local_time = fmod(_external_retarget_time, _external_retarget_length)

	_reset_external_retarget_bone_poses()
	for track in _external_retarget_tracks:
		var bone_index := int(track.get("bone_index", -1))
		if bone_index < 0:
			continue
		var track_type := int(track.get("track_type", Animation.TYPE_ROTATION_3D))
		var track_scale := 0.0
		if track_type == Animation.TYPE_POSITION_3D:
			track_scale = float(track.get("position_scale", RETARGET_ROTATION_SCALE))
			var base_position: Vector3 = track.get("base_position", Vector3.ZERO)
			var source_base_position: Vector3 = track.get("source_base_position", Vector3.ZERO)
			var source_position := _sample_external_retarget_position(track, local_time)
			var delta_position := (source_position - source_base_position) * track_scale * _emotion_motion_scale()
			var clamped_position := Vector3(
				clampf(delta_position.x, -MAX_EXTERNAL_POSITION_OFFSET.x, MAX_EXTERNAL_POSITION_OFFSET.x),
				clampf(delta_position.y, -MAX_EXTERNAL_POSITION_OFFSET.y, MAX_EXTERNAL_POSITION_OFFSET.y),
				clampf(delta_position.z, -MAX_EXTERNAL_POSITION_OFFSET.z, MAX_EXTERNAL_POSITION_OFFSET.z)
			)
			_skeleton.set_bone_pose_position(bone_index, (base_position + clamped_position))
			continue

		track_scale = float(track.get("rotation_scale", RETARGET_ROTATION_SCALE))
		var base_rotation: Quaternion = track.get("base_rotation", Quaternion.IDENTITY)
		var source_base: Quaternion = track.get("source_base_rotation", Quaternion.IDENTITY)
		var source_rotation := _sample_external_retarget_rotation(track, local_time)
		var delta_rotation := (source_base.inverse() * source_rotation).normalized()
		var scaled_delta := Quaternion.IDENTITY.slerp(delta_rotation, clampf(track_scale * _emotion_motion_scale(), 0.0, 1.0)).normalized()
		scaled_delta = _clamp_walk_foot_delta_if_needed(
				_external_retarget_motion,
				String(track.get("retarget_key", "")),
				scaled_delta
			)
		_skeleton.set_bone_pose_rotation(bone_index, (base_rotation * scaled_delta).normalized())
	if _external_retarget_motion == MOTION_WALK:
		_apply_walk_retarget_arm_lock_pose()
	if _external_retarget_motion == MOTION_NATURAL_WAVE:
		_apply_natural_wave_left_arm_lock_pose()
	if _external_retarget_motion == MOTION_RUN:
		_apply_run_retarget_arm_lock_pose()


func _sample_external_retarget_rotation(track: Dictionary, time: float) -> Quaternion:
	var times: Array = track.get("times", [])
	var rotations: Array = track.get("rotations", [])
	if times.is_empty() or rotations.is_empty():
		return track.get("source_base_rotation", Quaternion.IDENTITY)
	if time <= float(times[0]):
		return rotations[0]

	for index in range(times.size() - 1):
		var start_time := float(times[index])
		var end_time := float(times[index + 1])
		if time > end_time:
			continue
		if is_equal_approx(start_time, end_time):
			return rotations[index]
		var weight := clampf((time - start_time) / (end_time - start_time), 0.0, 1.0)
		var start_rotation: Quaternion = rotations[index]
		var end_rotation: Quaternion = rotations[index + 1]
		return start_rotation.slerp(end_rotation, weight).normalized()

	return rotations[rotations.size() - 1]


func _sample_external_retarget_position(track: Dictionary, time: float) -> Vector3:
	var times: Array = track.get("times", [])
	var positions: Array = track.get("positions", [])
	if times.is_empty() or positions.is_empty():
		return track.get("source_base_position", Vector3.ZERO)
	if time <= float(times[0]):
		return positions[0]

	for index in range(times.size() - 1):
		var start_time := float(times[index])
		var end_time := float(times[index + 1])
		if time > end_time:
			continue
		if is_equal_approx(start_time, end_time):
			return positions[index]
		var weight := clampf((time - start_time) / (end_time - start_time), 0.0, 1.0)
		var start_position: Vector3 = positions[index]
		var end_position: Vector3 = positions[index + 1]
		return start_position.lerp(end_position, weight)

	return positions[positions.size() - 1]


func _clamp_quaternion_euler_degrees(rotation: Quaternion, max_degrees: Vector3) -> Quaternion:
	var euler_degrees := rotation.get_euler() * 180.0 / PI
	var clamped := Vector3(
		clampf(euler_degrees.x, -max_degrees.x, max_degrees.x),
		clampf(euler_degrees.y, -max_degrees.y, max_degrees.y),
		clampf(euler_degrees.z, -max_degrees.z, max_degrees.z)
	)
	return _euler_degrees_to_quaternion(clamped)


func _external_bone_name_from_track_path(path: String) -> String:
	var candidate := path
	if candidate.contains(":"):
		var colon_parts := candidate.split(":", false)
		candidate = String(colon_parts[colon_parts.size() - 1])
	if candidate.contains("/"):
		var slash_parts := candidate.split("/", false)
		candidate = String(slash_parts[slash_parts.size() - 1])
	return candidate.strip_edges()


func _retarget_key_for_external_bone(source_bone: String) -> String:
	var normalized := _normalized_bone_compare_name(source_bone)
	if normalized.is_empty() or _is_ignored_external_retarget_bone(normalized):
		return ""

	var side := _bone_side_for_name(source_bone)
	if normalized.contains("hips") or normalized.contains("pelvis"):
		return "hips"
	if normalized.contains("spine2") or normalized.contains("spine1") or normalized.contains("upperchest") or normalized.contains("chest"):
		return "chest"
	if normalized.contains("spine"):
		return "spine"
	if normalized.contains("neck"):
		return "neck"
	if normalized.contains("head"):
		return "head"

	if side.is_empty():
		return ""
	if normalized.contains("shoulder"):
		return "%s_shoulder" % side
	if normalized.contains("upperarm") or normalized.contains("%sarm" % side):
		return "%s_upper_arm" % side
	if normalized.contains("lowerarm") or normalized.contains("forearm"):
		return "%s_lower_arm" % side
	if normalized.contains("hand"):
		return "%s_hand" % side
	if normalized.contains("upperleg") or normalized.contains("upleg") or normalized.contains("thigh"):
		return "%s_upper_leg" % side
	if normalized.contains("lowerleg") or normalized.contains("shin") or normalized.contains("calf"):
		return "%s_lower_leg" % side
	if normalized == "%sleg" % side:
		return "%s_upper_leg" % side
	if normalized.contains("foot"):
		return "%s_foot" % side
	return ""


func _is_external_retarget_hand_bone(normalized_name: String) -> bool:
	return _is_hand_or_finger_bone_name(normalized_name)


func _is_ignored_external_retarget_bone(normalized_name: String) -> bool:
	for marker in FINGER_BONE_NAME_MARKERS:
		if normalized_name.contains(marker):
			return true
	for marker in ["toe", "end"]:
		if normalized_name.contains(marker):
			return true
	return false


func _find_retarget_target_bone(retarget_key: String, source_side: String = "") -> int:
	var aliases: Array = RETARGET_TARGET_BONE_ALIASES.get(retarget_key, [])
	if aliases.is_empty():
		return -1
	var required_side := source_side
	if _retarget_key_requires_side(retarget_key) and required_side.is_empty():
		return -1
	return _find_best_matching_bone(retarget_key, aliases, required_side)


func _find_retarget_target_bone_any_side(retarget_key: String) -> int:
	var aliases: Array = RETARGET_TARGET_BONE_ALIASES.get(retarget_key, [])
	if aliases.is_empty():
		return -1
	return _find_best_matching_bone(retarget_key, aliases, "*")


func _retarget_key_requires_side(retarget_key: String) -> bool:
	return retarget_key.begins_with("left_") or retarget_key.begins_with("right_")


func _base_pose_rotation_for_bone(bone_index: int) -> Quaternion:
	if _idle_base_pose.has(bone_index):
		return _idle_base_pose[bone_index]
	if _procedural_bone_base_rotations.has(bone_index):
		return _procedural_bone_base_rotations[bone_index]
	if _skeleton != null and is_instance_valid(_skeleton):
		return _skeleton.get_bone_pose_rotation(bone_index)
	return Quaternion.IDENTITY


func _base_pose_position_for_bone(bone_index: int) -> Vector3:
	if _procedural_bone_base_positions.has(bone_index):
		return _procedural_bone_base_positions[bone_index]
	if _skeleton != null and is_instance_valid(_skeleton):
		return _skeleton.get_bone_pose_position(bone_index)
	return Vector3.ZERO


func _external_retarget_track_role_name(track_type: int) -> String:
	if track_type == Animation.TYPE_POSITION_3D:
		return "position"
	return "rotation"


func _quaternion_from_variant(value: Variant) -> Quaternion:
	match typeof(value):
		TYPE_QUATERNION:
			return (value as Quaternion).normalized()
		TYPE_BASIS:
			return (value as Basis).get_rotation_quaternion().normalized()
		TYPE_VECTOR3:
			return Quaternion.from_euler(value as Vector3).normalized()
	return Quaternion.IDENTITY


func _try_play_external_motion(motion: String) -> Dictionary:
	var motion_path := ProjectPathsScript.repo_file("assets/motions/%s.glb" % motion)
	var display_path := ProjectPathsScript.display_path(motion_path)
	if not FileAccess.file_exists(motion_path):
		return {
			"ok": false,
			"reason": "%s not found" % display_path,
		}

	var debug_lines := PackedStringArray()
	_append_external_motion_debug(debug_lines, "External motion inspect: %s" % display_path)
	_append_external_motion_debug(debug_lines, "Experimental external GLB motion route: %s" % display_path)
	var motion_scene := _load_glb(motion_path)
	if motion_scene == null:
		var reason := "%s could not be loaded" % display_path
		_append_external_motion_debug(debug_lines, "External motion load failed: %s" % reason)
		return {
			"ok": false,
			"reason": reason,
			"debug": debug_lines,
		}

	var inspect_result := _inspect_external_motion_scene(motion_scene, display_path, debug_lines)
	var source_animation := inspect_result.get("animation") as Animation
	var external_bone_detected := bool(inspect_result.get("bone_detected", false))
	if source_animation == null:
		motion_scene.free()
		var reason := "%s has no AnimationPlayer/AnimationLibrary animation" % display_path
		_append_external_motion_debug(debug_lines, "External motion not applicable: %s" % reason)
		return {
			"ok": false,
			"reason": reason,
			"debug": debug_lines,
		}

	var mapped_animation := _build_external_mount_animation(source_animation)
	if mapped_animation == null and external_bone_detected:
		var retarget_status := _try_play_external_retarget_motion(source_animation, display_path, debug_lines, motion)
		motion_scene.free()
		if bool(retarget_status.get("ok", false)):
			return retarget_status
		var retarget_reason := String(retarget_status.get("reason", "retargeting failed"))
		_append_external_motion_debug(debug_lines, "External retarget failed: %s" % retarget_reason)
		return {
			"ok": false,
			"reason": retarget_reason,
			"debug": debug_lines,
		}

	motion_scene.free()
	if mapped_animation == null:
		var reason := "External motion requires retargeting: %s has no safe avatar_mount transform tracks" % display_path
		if external_bone_detected:
			reason = "External motion requires retargeting: %s contains bone animation tracks but no safe avatar_mount transform tracks" % display_path
		_append_external_motion_debug(debug_lines, reason)
		return {
			"ok": false,
			"reason": reason,
			"debug": debug_lines,
		}

	_ensure_motion_player()
	_remove_motion_animation(EXTERNAL_MOTION_NAME)
	_motion_library.add_animation(EXTERNAL_MOTION_NAME, mapped_animation)
	_motion_player.play(EXTERNAL_MOTION_NAME)
	_append_external_motion_debug(debug_lines, "External motion applicable: %s mapped to avatar_mount transform tracks" % display_path)
	return {
		"ok": true,
		"mode": "external",
		"message": "External motion loaded: %s" % display_path,
		"debug": debug_lines,
	}


func _append_external_motion_debug(debug_lines: PackedStringArray, message: String) -> void:
	debug_lines.append(message)
	print(message)


func _inspect_external_motion_scene(root: Node, display_path: String, debug_lines: PackedStringArray) -> Dictionary:
	var result := {
		"animation": null,
		"bone_detected": false,
		"bone_candidates": [],
		"animation_player_count": 0,
	}
	_inspect_external_motion_node(root, root, debug_lines, result)
	if int(result.get("animation_player_count", 0)) <= 0:
		_append_external_motion_debug(debug_lines, "External AnimationPlayer: none (%s)" % display_path)
	var candidates: Array = result.get("bone_candidates", [])
	_log_external_bone_comparison(candidates, debug_lines)
	return result


func _inspect_external_motion_node(node: Node, root: Node, debug_lines: PackedStringArray, result: Dictionary) -> void:
	if node is AnimationPlayer:
		result["animation_player_count"] = int(result.get("animation_player_count", 0)) + 1
		_inspect_external_animation_player(node as AnimationPlayer, root, debug_lines, result)

	for child in node.get_children():
		_inspect_external_motion_node(child, root, debug_lines, result)


func _inspect_external_animation_player(player: AnimationPlayer, root: Node, debug_lines: PackedStringArray, result: Dictionary) -> void:
	var player_path := "."
	if player != root:
		player_path = String(root.get_path_to(player))
	_append_external_motion_debug(debug_lines, "External AnimationPlayer: %s" % player_path)

	var library_names := player.get_animation_library_list()
	if library_names.is_empty():
		_inspect_external_animation_list(player, PackedStringArray(), player_path, "(direct)", debug_lines, result)
		return

	for library_name in library_names:
		var library := player.get_animation_library(library_name)
		if library == null:
			continue
		var display_library := String(library_name)
		if display_library.is_empty():
			display_library = "(default)"
		var animation_names := library.get_animation_list()
		_append_external_motion_debug(
			debug_lines,
			"External AnimationLibrary: player=%s library=%s animations=%s" % [
				player_path,
				display_library,
				animation_names.size(),
			]
		)
		for animation_name in animation_names:
			var animation := library.get_animation(animation_name)
			if animation == null:
				continue
			_inspect_external_animation(
				animation,
				player_path,
				display_library,
				String(animation_name),
				debug_lines,
				result
			)


func _inspect_external_animation_list(player: AnimationPlayer, animation_names: PackedStringArray, player_path: String, library_name: String, debug_lines: PackedStringArray, result: Dictionary) -> void:
	var names := animation_names
	if names.is_empty():
		names = player.get_animation_list()
	_append_external_motion_debug(
		debug_lines,
		"External AnimationLibrary: player=%s library=%s animations=%s" % [
			player_path,
			library_name,
			names.size(),
		]
	)
	for animation_name in names:
		var animation := player.get_animation(animation_name)
		if animation == null:
			continue
		_inspect_external_animation(animation, player_path, library_name, String(animation_name), debug_lines, result)


func _inspect_external_animation(animation: Animation, player_path: String, library_name: String, animation_name: String, debug_lines: PackedStringArray, result: Dictionary) -> void:
	_append_external_motion_debug(
		debug_lines,
		"External Animation: player=%s library=%s animation=%s" % [
			player_path,
			library_name,
			animation_name,
		]
	)

	if result.get("animation") == null and animation_name.to_lower() != "reset":
		result["animation"] = animation

	var track_count := animation.get_track_count()
	_append_external_motion_debug(
		debug_lines,
		"External Animation track_count: animation=%s tracks=%s" % [animation_name, track_count]
	)
	var logged_track_count := mini(track_count, EXTERNAL_MOTION_TRACK_LOG_LIMIT)
	for track in range(logged_track_count):
		var path := String(animation.track_get_path(track))
		var track_type := int(animation.track_get_type(track))
		var track_type_name := _animation_track_type_name(track_type)
		_append_external_motion_debug(
			debug_lines,
			"External track %s: path=%s type=%s" % [track, path, track_type_name]
		)
		if _external_track_path_has_bone_keyword(path):
			result["bone_detected"] = true
			_append_external_motion_debug(
				debug_lines,
				"External bone animation detected: animation=%s track=%s path=%s type=%s" % [
					animation_name,
					track,
					path,
					track_type_name,
				]
			)
			var candidates: Array = result.get("bone_candidates", [])
			_collect_external_bone_candidates_from_path(path, candidates)

	if track_count > logged_track_count:
		_append_external_motion_debug(
			debug_lines,
			"External track log truncated: animation=%s showing=%s total=%s" % [
				animation_name,
				logged_track_count,
				track_count,
			]
		)


func _animation_track_type_name(track_type: int) -> String:
	match track_type:
		Animation.TYPE_VALUE:
			return "TYPE_VALUE(%s)" % track_type
		Animation.TYPE_POSITION_3D:
			return "TYPE_POSITION_3D(%s)" % track_type
		Animation.TYPE_ROTATION_3D:
			return "TYPE_ROTATION_3D(%s)" % track_type
		Animation.TYPE_SCALE_3D:
			return "TYPE_SCALE_3D(%s)" % track_type
		Animation.TYPE_BLEND_SHAPE:
			return "TYPE_BLEND_SHAPE(%s)" % track_type
		Animation.TYPE_METHOD:
			return "TYPE_METHOD(%s)" % track_type
		Animation.TYPE_BEZIER:
			return "TYPE_BEZIER(%s)" % track_type
		Animation.TYPE_AUDIO:
			return "TYPE_AUDIO(%s)" % track_type
		Animation.TYPE_ANIMATION:
			return "TYPE_ANIMATION(%s)" % track_type
		_:
			return "TYPE_UNKNOWN(%s)" % track_type


func _external_track_path_has_bone_keyword(path: String) -> bool:
	var lower_path := path.to_lower()
	for keyword in EXTERNAL_BONE_TRACK_KEYWORDS:
		if lower_path.contains(String(keyword)):
			return true
	return false


func _collect_external_bone_candidates_from_path(path: String, candidates: Array) -> void:
	var normalized_path := path \
		.replace("\\", "/") \
		.replace(":", "/") \
		.replace(".", "/") \
		.replace("[", "/") \
		.replace("]", "/")
	for raw_token in normalized_path.split("/", false):
		var token := String(raw_token).strip_edges()
		if token.is_empty():
			continue
		var normalized := _normalize_bone_name(token)
		if normalized.length() < 3 or _is_generic_external_bone_token(normalized):
			continue
		_append_unique_string(candidates, token)


func _is_generic_external_bone_token(normalized_token: String) -> bool:
	return [
		"animationplayer",
		"skeleton",
		"skeleton3d",
		"armature",
		"bone",
		"bones",
		"mesh",
		"mixamo",
		"mixamorig",
		"position",
		"rotation",
		"scale",
		"transform",
		"pose",
	].has(normalized_token)


func _append_unique_string(values: Array, value: String) -> void:
	if value.is_empty():
		return
	if values.find(value) >= 0:
		return
	values.append(value)


func _log_external_bone_comparison(candidates: Array, debug_lines: PackedStringArray) -> void:
	if candidates.is_empty():
		_append_external_motion_debug(debug_lines, "External bone candidates: none")
	else:
		_append_external_motion_debug(
			debug_lines,
			"External bone candidates: %s" % _join_limited_string_array(candidates, 80)
		)

	if _skeleton == null or not is_instance_valid(_skeleton):
		_append_external_motion_debug(debug_lines, "Godette bone comparison skipped: Skeleton3D not found")
		return

	var bone_count := _skeleton.get_bone_count()
	_append_external_motion_debug(
		debug_lines,
		"Godette bone comparison: godette_bones=%s external_candidates=%s" % [
			bone_count,
			candidates.size(),
		]
	)

	var match_count := 0
	for candidate in candidates:
		var candidate_name := String(candidate)
		for bone_index in range(bone_count):
			var godette_bone_name := _skeleton.get_bone_name(bone_index)
			if not _bone_names_partially_match(candidate_name, godette_bone_name):
				continue
			_append_external_motion_debug(
				debug_lines,
				"External/Godette partial bone match: external=%s godette=%s" % [
					candidate_name,
					godette_bone_name,
				]
			)
			match_count += 1
			if match_count >= 80:
				_append_external_motion_debug(debug_lines, "External/Godette partial bone match log truncated at 80")
				return

	if match_count <= 0:
		_append_external_motion_debug(debug_lines, "External/Godette partial bone matches: none")


func _join_limited_string_array(values: Array, max_count: int) -> String:
	var parts := PackedStringArray()
	var count := mini(values.size(), max_count)
	for index in range(count):
		parts.append(String(values[index]))
	var joined := ", ".join(parts)
	if values.size() > max_count:
		joined = "%s, ... (%s total)" % [joined, values.size()]
	return joined


func _bone_names_partially_match(external_name: String, godette_name: String) -> bool:
	var external_normalized := _normalized_bone_compare_name(external_name)
	var godette_normalized := _normalized_bone_compare_name(godette_name)
	if _is_hand_or_finger_bone_name(external_normalized) or _is_hand_or_finger_bone_name(godette_normalized):
		return false

	var external_side := _bone_side_for_name(external_name)
	var godette_side := _bone_side_for_name(godette_name)
	if not external_side.is_empty() and not godette_side.is_empty() and external_side != godette_side:
		return false

	var external_keys := _bone_compare_keys_for_name(external_name)
	var godette_keys := _bone_compare_keys_for_name(godette_name)
	for external_key in external_keys:
		for godette_key in godette_keys:
			if external_key == godette_key:
				return true
			if String(external_key).length() >= 4 and String(godette_key).contains(String(external_key)):
				return true
			if String(godette_key).length() >= 4 and String(external_key).contains(String(godette_key)):
				return true
	return false


func _bone_compare_keys_for_name(value: String) -> PackedStringArray:
	var stripped := _normalized_bone_compare_name(value)
	var keys := PackedStringArray()
	if stripped.length() >= 3:
		keys.append(stripped)

	var side := ""
	if _bone_name_has_left_marker(stripped):
		side = "left"
	elif _bone_name_has_right_marker(stripped):
		side = "right"

	var region := ""
	if stripped.contains("hips") or stripped.contains("pelvis"):
		region = "hips"
	elif stripped.contains("spine"):
		region = "spine"
	elif stripped.contains("upperchest"):
		region = "upper_chest"
	elif stripped.contains("chest"):
		region = "chest"
	elif stripped.contains("neck"):
		region = "neck"
	elif stripped.contains("head"):
		region = "head"
	elif stripped.contains("shoulder"):
		region = "shoulder"
	elif stripped.contains("upperarm") or stripped.contains("leftarm") or stripped.contains("rightarm"):
		region = "upper_arm"
	elif stripped.contains("lowerarm"):
		region = "lower_arm"
	elif stripped.contains("hand"):
		region = "hand"
	elif stripped.contains("upperleg") or stripped.contains("thigh"):
		region = "upper_leg"
	elif stripped.contains("lowerleg") or stripped.contains("calf") or stripped.contains("shin") or stripped.contains("leftleg") or stripped.contains("rightleg"):
		region = "lower_leg"
	elif stripped.contains("foot") or stripped.contains("toe"):
		region = "foot"

	if not region.is_empty():
		if side.is_empty():
			keys.append(region)
		else:
			keys.append("%s_%s" % [side, region])
	return keys


func _normalized_bone_compare_name(value: String) -> String:
	var normalized := _normalize_bone_name(value)
	var stripped := normalized \
		.replace("mixamorig", "") \
		.replace("mixamo", "") \
		.replace("godette", "") \
		.replace("j_bip", "") \
		.replace("jbip", "")
	return stripped \
		.replace("upleg", "upperleg") \
		.replace("uparm", "upperarm") \
		.replace("forearm", "lowerarm")


func _bone_side_for_name(value: String) -> String:
	var stripped := _normalized_bone_compare_name(value)
	if _bone_name_has_left_marker(stripped):
		return "left"
	if _bone_name_has_right_marker(stripped):
		return "right"
	return ""


func _bone_name_has_left_marker(normalized_name: String) -> bool:
	return normalized_name.contains("left") \
		or normalized_name.contains("lupper") \
		or normalized_name.contains("llower") \
		or normalized_name.contains("lhand") \
		or normalized_name.contains("lshoulder") \
		or normalized_name.contains("lfoot") \
		or normalized_name.contains("lleg") \
		or normalized_name.ends_with("l")


func _bone_name_has_right_marker(normalized_name: String) -> bool:
	return normalized_name.contains("right") \
		or normalized_name.contains("rupper") \
		or normalized_name.contains("rlower") \
		or normalized_name.contains("rhand") \
		or normalized_name.contains("rshoulder") \
		or normalized_name.contains("rfoot") \
		or normalized_name.contains("rleg") \
		or normalized_name.ends_with("r")


func _find_first_external_animation(root: Node) -> Animation:
	if root is AnimationPlayer:
		var animation := _get_first_animation_from_player(root as AnimationPlayer)
		if animation != null:
			return animation
	for child in root.get_children():
		var animation := _find_first_external_animation(child)
		if animation != null:
			return animation
	return null


func _get_first_animation_from_player(player: AnimationPlayer) -> Animation:
	for animation_name in player.get_animation_list():
		var normalized_name := String(animation_name)
		if normalized_name.to_lower() == "reset":
			continue
		var animation := player.get_animation(animation_name)
		if animation != null:
			return animation

	for library_name in player.get_animation_library_list():
		var library := player.get_animation_library(library_name)
		if library == null:
			continue
		for animation_name in library.get_animation_list():
			var normalized_name := String(animation_name)
			if normalized_name.to_lower() == "reset":
				continue
			var animation := library.get_animation(animation_name)
			if animation != null:
				return animation
	return null


func _build_external_mount_animation(source: Animation) -> Animation:
	var position_track := _find_best_external_track(source, true)
	var rotation_track := _find_best_external_track(source, false)
	if position_track < 0 and rotation_track < 0:
		return null

	var animation := Animation.new()
	animation.length = maxf(source.length, 0.05)
	animation.loop_mode = source.loop_mode

	if position_track >= 0:
		_add_external_position_track(animation, source, position_track)
	if rotation_track >= 0:
		_add_external_rotation_track(animation, source, rotation_track)
	return animation


func _find_best_external_track(animation: Animation, want_position: bool) -> int:
	var best_track := -1
	var best_score := 100000
	for track in range(animation.get_track_count()):
		if not _is_safe_external_transform_track(animation, track, want_position):
			continue
		var path := String(animation.track_get_path(track))
		var score := path.count("/")
		if path.contains(":"):
			score += 1
		if score < best_score:
			best_score = score
			best_track = track
	return best_track


func _is_safe_external_transform_track(animation: Animation, track: int, want_position: bool) -> bool:
	var track_type := animation.track_get_type(track)
	var path := String(animation.track_get_path(track))
	var lower_path := path.to_lower()
	if lower_path.contains("skeleton") or lower_path.contains("bone") or lower_path.contains("mesh"):
		return false
	if lower_path.contains("blend") or lower_path.contains("material"):
		return false
	if want_position:
		return track_type == Animation.TYPE_POSITION_3D or lower_path.ends_with(":position")
	return track_type == Animation.TYPE_ROTATION_3D or lower_path.ends_with(":rotation") or lower_path.ends_with(":rotation_degrees")


func _add_external_position_track(target: Animation, source: Animation, source_track: int) -> void:
	var key_count := source.track_get_key_count(source_track)
	if key_count <= 0:
		return

	var base_value := _vector3_from_variant(source.track_get_key_value(source_track, 0))
	var scale := _emotion_motion_scale()
	var target_track := target.add_track(Animation.TYPE_VALUE)
	target.track_set_path(target_track, NodePath("avatar_mount:position"))
	for key in range(key_count):
		var time := source.track_get_key_time(source_track, key)
		var value := _vector3_from_variant(source.track_get_key_value(source_track, key))
		var delta := (value - base_value) * scale
		var offset := Vector3(
			clampf(delta.x, -MAX_EXTERNAL_POSITION_OFFSET.x, MAX_EXTERNAL_POSITION_OFFSET.x),
			clampf(delta.y, -MAX_EXTERNAL_POSITION_OFFSET.y, MAX_EXTERNAL_POSITION_OFFSET.y),
			clampf(delta.z, -MAX_EXTERNAL_POSITION_OFFSET.z, MAX_EXTERNAL_POSITION_OFFSET.z)
		)
		target.track_insert_key(target_track, time, _motion_base_position + offset)


func _add_external_rotation_track(target: Animation, source: Animation, source_track: int) -> void:
	var key_count := source.track_get_key_count(source_track)
	if key_count <= 0:
		return

	var base_value := _rotation_degrees_from_variant(source.track_get_key_value(source_track, 0))
	var scale := _emotion_motion_scale()
	var target_track := target.add_track(Animation.TYPE_VALUE)
	target.track_set_path(target_track, NodePath("avatar_mount:rotation_degrees"))
	for key in range(key_count):
		var time := source.track_get_key_time(source_track, key)
		var value := _rotation_degrees_from_variant(source.track_get_key_value(source_track, key))
		var delta := (value - base_value) * scale
		var offset := Vector3(
			clampf(delta.x, -MAX_EXTERNAL_ROTATION_DEGREES.x, MAX_EXTERNAL_ROTATION_DEGREES.x),
			clampf(delta.y, -MAX_EXTERNAL_ROTATION_DEGREES.y, MAX_EXTERNAL_ROTATION_DEGREES.y),
			clampf(delta.z, -MAX_EXTERNAL_ROTATION_DEGREES.z, MAX_EXTERNAL_ROTATION_DEGREES.z)
		)
		target.track_insert_key(target_track, time, _motion_base_rotation_degrees + offset)


func _vector3_from_variant(value: Variant) -> Vector3:
	if typeof(value) == TYPE_VECTOR3:
		return value
	return Vector3.ZERO


func _rotation_degrees_from_variant(value: Variant) -> Vector3:
	match typeof(value):
		TYPE_QUATERNION:
			return (value as Quaternion).get_euler() * 180.0 / PI
		TYPE_VECTOR3:
			return value
		TYPE_BASIS:
			return (value as Basis).get_euler() * 180.0 / PI
	return Vector3.ZERO
