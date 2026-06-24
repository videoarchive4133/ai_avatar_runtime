extends Node

const ProjectPathsScript = preload("res://scripts/ProjectPaths.gd")
const AvatarViewScript = preload("res://scripts/AvatarView.gd")
const ActionPanelScript = preload("res://scripts/ActionPanel.gd")
const ActionWatcherScript = preload("res://scripts/ActionWatcher.gd")
const MotionControllerScript = preload("res://scripts/MotionController.gd")

const SUPPORTED_SPEECH_AUDIO_EXTENSIONS = ["wav", "ogg", "mp3"]
const SUPPORTED_EMOTIONS = ["happy", "neutral", "sad", "angry"]
const EMOTION_LIGHT_COLORS = {
	"neutral": Color(1.0, 0.96, 0.9),
	"happy": Color(1.0, 0.92, 0.72),
	"sad": Color(0.58, 0.68, 1.0),
	"angry": Color(1.0, 0.48, 0.38),
}
const EMOTION_LIGHT_ENERGY = {
	"neutral": 2.1,
	"happy": 2.35,
	"sad": 1.55,
	"angry": 2.45,
}
const LIP_SYNC_INTERVAL := 0.12
const LIP_SYNC_MOUTH_SEQUENCE = ["ah", "ih", "uu", "ee", "oh", "ah", "ee", "uu", "oh"]
const LIP_SYNC_MOUTH_AMOUNT := 0.9
const LIP_SYNC_DEBUG_MOUTH_AMOUNT := 1.0
const LIP_SYNC_DEBUG_INTERVAL := 0.08
const LIP_SYNC_MOUTH_AMOUNTS = {
	"ah": 0.78,
	"ih": 0.58,
	"uu": 0.66,
	"ee": 0.62,
	"oh": 0.84,
}
const LIP_SYNC_DEBUG_MOUTH_AMOUNTS = {
	"ah": 1.0,
	"ih": 1.0,
	"uu": 1.0,
	"ee": 1.0,
	"oh": 1.0,
}

var _world: Node3D
var _camera: Camera3D
var _key_light: DirectionalLight3D
var _speech_audio_player: AudioStreamPlayer
var _lip_sync_timer: Timer
var _avatar_view
var _action_panel
var _action_watcher
var _motion_controller
var _last_camera := ""
var _last_speech_audio := ""
var _last_emotion := "neutral"
var _lip_sync_enabled := false
var _lip_sync_debug := false
var _lip_sync_active := false
var _lip_sync_index := 0
var _last_lip_sync_mouth := ""


func _ready() -> void:
	_build_runtime_scene()
	_connect_runtime()
	_boot()


func _exit_tree() -> void:
	_stop_lip_sync(false)
	if _speech_audio_player != null:
		_speech_audio_player.stop()
		_speech_audio_player.stream = null


func _build_runtime_scene() -> void:
	_speech_audio_player = get_node_or_null("SpeechAudioPlayer") as AudioStreamPlayer
	if _speech_audio_player == null:
		_speech_audio_player = AudioStreamPlayer.new()
		_speech_audio_player.name = "SpeechAudioPlayer"
		add_child(_speech_audio_player)

	_lip_sync_timer = Timer.new()
	_lip_sync_timer.name = "LipSyncTimer"
	_lip_sync_timer.wait_time = LIP_SYNC_INTERVAL
	_lip_sync_timer.one_shot = false
	add_child(_lip_sync_timer)

	_world = Node3D.new()
	_world.name = "World"
	add_child(_world)

	_camera = Camera3D.new()
	_camera.name = "Camera3D"
	_camera.current = true
	_world.add_child(_camera)
	_apply_camera("front")

	_key_light = DirectionalLight3D.new()
	_key_light.name = "KeyLight"
	_key_light.rotation_degrees = Vector3(-55.0, 35.0, 0.0)
	_key_light.light_energy = 2.1
	_key_light.shadow_enabled = true
	_world.add_child(_key_light)
	_apply_emotion_light(_last_emotion)

	var floor := MeshInstance3D.new()
	floor.name = "Floor"
	var plane := PlaneMesh.new()
	plane.size = Vector2(5.0, 5.0)
	floor.mesh = plane
	var floor_material := StandardMaterial3D.new()
	floor_material.albedo_color = Color(0.16, 0.17, 0.18)
	floor_material.roughness = 0.9
	floor.set_surface_override_material(0, floor_material)
	_world.add_child(floor)

	_avatar_view = AvatarViewScript.new()
	_avatar_view.name = "AvatarView"
	_world.add_child(_avatar_view)

	var ui_layer := CanvasLayer.new()
	ui_layer.name = "UILayer"
	add_child(ui_layer)

	_action_panel = ActionPanelScript.new()
	_action_panel.name = "ActionPanel"
	_action_panel.anchor_left = 0.0
	_action_panel.anchor_top = 0.0
	_action_panel.anchor_right = 0.0
	_action_panel.anchor_bottom = 1.0
	_action_panel.offset_left = 16.0
	_action_panel.offset_top = 16.0
	_action_panel.offset_right = 436.0
	_action_panel.offset_bottom = -16.0
	ui_layer.add_child(_action_panel)

	_action_watcher = ActionWatcherScript.new()
	_action_watcher.name = "ActionWatcher"
	add_child(_action_watcher)

	_motion_controller = MotionControllerScript.new()
	_motion_controller.name = "MotionController"
	add_child(_motion_controller)


func _connect_runtime() -> void:
	_action_panel.reload_requested.connect(_on_reload_requested)
	_action_panel.model_show_requested.connect(_on_model_show_requested)
	_action_panel.model_hide_requested.connect(_on_model_hide_requested)
	_action_panel.camera_view_requested.connect(_on_camera_view_requested)
	_action_watcher.action_loaded.connect(_on_action_loaded)
	_action_watcher.action_failed.connect(_on_action_failed)
	_motion_controller.set_avatar_view(_avatar_view)
	_motion_controller.motion_changed.connect(_on_motion_changed)
	_speech_audio_player.finished.connect(_on_speech_audio_finished)
	_lip_sync_timer.timeout.connect(_on_lip_sync_tick)


func _boot() -> void:
	_action_panel.log_message("Model hidden on startup. Press モデル表示 to load assets/vrm.")

	var action_path: String = ProjectPathsScript.repo_file("actions/action.json")
	_action_panel.log_message("Watching %s" % ProjectPathsScript.display_path(action_path))
	_action_watcher.configure(action_path, 0.25)


func _on_reload_requested() -> void:
	_action_panel.log_message("Manual reload requested.")
	_action_watcher.reload()


func _on_model_show_requested() -> void:
	if _avatar_view.has_model():
		_action_panel.log_message("Model is already visible; skipped loading.")
		return

	var vrm_dir: String = ProjectPathsScript.repo_file("assets/vrm")
	var avatar_status: Dictionary = _avatar_view.load_first_avatar(vrm_dir)
	_action_panel.log_message(String(avatar_status.get("message", "Model display requested.")))
	for line in avatar_status.get("debug", PackedStringArray()):
		_action_panel.log_message(String(line))
	var emotion_status: Dictionary = _avatar_view.set_emotion(_last_emotion)
	_log_emotion_status(emotion_status)

	var camera_name := _last_camera
	if camera_name.is_empty():
		camera_name = "front"
	_apply_camera(camera_name, true)
	_motion_controller.refresh_motion()


func _on_model_hide_requested() -> void:
	if _avatar_view.hide_avatar():
		_action_panel.log_message("Model hidden.")
	else:
		_action_panel.log_message("Model is already hidden.")


func _on_camera_view_requested(view_name: String) -> void:
	_apply_camera(view_name, true)
	_action_panel.log_message("Camera view: %s" % view_name)


func _on_action_loaded(data: Dictionary, status: Dictionary) -> void:
	_action_panel.set_action(data)
	_action_panel.set_load_status_from_watcher(status)
	_action_panel.log_message("Applied action.json.")

	var emotion := _normalize_emotion(String(data.get("emotion", "neutral")))
	var emotion_changed := emotion != _last_emotion
	_last_emotion = emotion
	_apply_emotion_light(emotion)
	var emotion_status: Dictionary = _avatar_view.set_emotion(emotion)
	_log_emotion_status(emotion_status)

	_apply_lip_sync_config(
		_parse_action_bool(data.get("lip_sync_enabled", false), false),
		_parse_action_bool(data.get("lip_sync_debug", false), false)
	)

	var motion := String(data.get("motion", "idle"))
	var motion_file := String(data.get("motion_file", ""))
	_motion_controller.apply_motion_request(motion, motion_file, emotion_changed)

	var speech_audio := String(data.get("speech_audio", ""))
	_apply_speech_audio(speech_audio)

	var camera_name := String(data.get("camera", "front"))
	_apply_camera(camera_name, true)


func _on_action_failed(message: String, status: Dictionary) -> void:
	_action_panel.set_load_status_from_watcher(status)
	_action_panel.log_message("action.json error: %s" % message)


func _on_motion_changed(motion: String) -> void:
	_action_panel.log_message("Motion changed: %s" % motion)
	var status: Dictionary = _motion_controller.get_last_motion_status()
	var message := String(status.get("message", ""))
	if not message.is_empty():
		_action_panel.log_message(message)
	for line in status.get("debug", PackedStringArray()):
		_action_panel.log_message(String(line))


func _apply_speech_audio(raw_path: String) -> void:
	var requested_path := raw_path.strip_edges()
	if requested_path == _last_speech_audio:
		return
	_last_speech_audio = requested_path

	if _speech_audio_player == null:
		_log_speech_audio_error("speech_audio error: AudioStreamPlayer is not available.")
		return

	_stop_lip_sync()
	_speech_audio_player.stop()
	_speech_audio_player.stream = null

	if requested_path.is_empty():
		_log_panel_message("Speech audio cleared.")
		return

	var resolved_path := _resolve_speech_audio_path(requested_path)
	var display_path := _display_speech_audio_path(resolved_path)
	if not FileAccess.file_exists(resolved_path):
		_log_speech_audio_error("speech_audio file was not found: %s" % display_path)
		return

	var extension := resolved_path.get_extension().to_lower()
	if not SUPPORTED_SPEECH_AUDIO_EXTENSIONS.has(extension):
		_log_speech_audio_error("speech_audio format is unsupported: %s (supported: wav, ogg, mp3)" % display_path)
		return

	var stream := _load_speech_audio_stream(resolved_path, extension)
	if stream == null:
		_log_speech_audio_error("speech_audio could not be loaded: %s" % display_path)
		return

	if _is_headless_display():
		_log_panel_message("Validated speech_audio in headless mode: %s" % display_path)
		return

	_speech_audio_player.stream = stream
	_speech_audio_player.play()
	_log_panel_message("Playing speech_audio: %s" % display_path)
	if _lip_sync_enabled:
		_start_lip_sync()


func _resolve_speech_audio_path(path: String) -> String:
	if path.begins_with("res://") or path.begins_with("user://"):
		return path.simplify_path()
	if path.is_absolute_path():
		return path.simplify_path()
	return ProjectPathsScript.repo_file(path)


func _display_speech_audio_path(path: String) -> String:
	if path.begins_with("res://") or path.begins_with("user://"):
		return path
	return ProjectPathsScript.display_path(path)


func _load_speech_audio_stream(path: String, extension: String) -> AudioStream:
	match extension:
		"wav":
			return AudioStreamWAV.load_from_file(path)
		"ogg":
			return AudioStreamOggVorbis.load_from_file(path)
		"mp3":
			return _load_mp3_audio_stream(path)
	return null


func _load_mp3_audio_stream(path: String) -> AudioStream:
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return null

	var stream := AudioStreamMP3.new()
	stream.data = file.get_buffer(file.get_length())
	return stream


func _is_headless_display() -> bool:
	return DisplayServer.get_name() == "headless"


func _log_speech_audio_error(message: String) -> void:
	push_error(message)
	_log_panel_message(message)


func _log_panel_message(message: String) -> void:
	if _action_panel != null:
		_action_panel.log_message(message)


func _apply_lip_sync_config(enabled: bool, debug: bool) -> void:
	_lip_sync_enabled = enabled
	_lip_sync_debug = debug
	if _lip_sync_timer != null:
		_lip_sync_timer.wait_time = LIP_SYNC_DEBUG_INTERVAL if _lip_sync_debug else LIP_SYNC_INTERVAL
	if not _lip_sync_enabled:
		_stop_lip_sync()
		return
	if _speech_audio_player != null and _speech_audio_player.playing and not _lip_sync_active and not _is_headless_display():
		_start_lip_sync()


func _start_lip_sync() -> void:
	if _lip_sync_active or _is_headless_display() or not _lip_sync_enabled:
		return
	_lip_sync_active = true
	_lip_sync_index = 0
	if _lip_sync_timer != null:
		_lip_sync_timer.start(LIP_SYNC_DEBUG_INTERVAL if _lip_sync_debug else LIP_SYNC_INTERVAL)
	_on_lip_sync_tick()
	_log_panel_message("LipSync started")


func _stop_lip_sync(log_stop: bool = true) -> void:
	var was_active := _lip_sync_active
	_lip_sync_active = false
	_lip_sync_index = 0
	if _lip_sync_timer != null:
		_lip_sync_timer.stop()
	if _avatar_view != null and _avatar_view.has_method("reset_lip_sync_mouth"):
		_avatar_view.reset_lip_sync_mouth()
	if _action_panel != null and _action_panel.has_method("set_lip_sync_mouth"):
		_action_panel.set_lip_sync_mouth("")
	_last_lip_sync_mouth = ""
	if was_active and log_stop:
		_log_panel_message("LipSync stopped")


func _on_lip_sync_tick() -> void:
	if not _lip_sync_active:
		return
	if _speech_audio_player == null or not _speech_audio_player.playing:
		_stop_lip_sync()
		return
	if _avatar_view == null or not _avatar_view.has_method("set_lip_sync_mouth"):
		return

	var mouth_shape := String(LIP_SYNC_MOUTH_SEQUENCE[_lip_sync_index % LIP_SYNC_MOUTH_SEQUENCE.size()])
	_lip_sync_index += 1
	var mouth_amount := _get_lip_sync_mouth_amount(mouth_shape)
	var mouth_status: Dictionary = _avatar_view.set_lip_sync_mouth(mouth_shape, mouth_amount)
	if _action_panel != null and _action_panel.has_method("set_lip_sync_mouth"):
		var active_mouth := mouth_shape if bool(mouth_status.get("applied", false)) else ""
		_action_panel.set_lip_sync_mouth(active_mouth)
	if String(mouth_status.get("message", "")).length() > 0:
		_log_panel_message(String(mouth_status.get("message", "")))
	_last_lip_sync_mouth = mouth_shape


func _get_lip_sync_mouth_amount(shape_name: String) -> float:
	if _lip_sync_debug:
		return LIP_SYNC_DEBUG_MOUTH_AMOUNT
	return float(LIP_SYNC_MOUTH_AMOUNTS.get(shape_name, LIP_SYNC_MOUTH_AMOUNT))


func _on_speech_audio_finished() -> void:
	_stop_lip_sync()


func _parse_action_bool(value: Variant, default_value: bool) -> bool:
	match typeof(value):
		TYPE_BOOL:
			return bool(value)
		TYPE_INT:
			return int(value) != 0
		TYPE_FLOAT:
			return not is_zero_approx(float(value))
		TYPE_STRING:
			var normalized := String(value).strip_edges().to_lower()
			if ["true", "1", "yes", "on", "enabled"].has(normalized):
				return true
			if ["false", "0", "no", "off", "disabled"].has(normalized):
				return false
	return default_value


func _normalize_emotion(emotion: String) -> String:
	var normalized := emotion.strip_edges().to_lower()
	if SUPPORTED_EMOTIONS.has(normalized):
		return normalized
	return "neutral"


func _apply_emotion_light(emotion: String) -> void:
	if _key_light == null:
		return
	var normalized := _normalize_emotion(emotion)
	_key_light.light_color = EMOTION_LIGHT_COLORS.get(normalized, EMOTION_LIGHT_COLORS["neutral"])
	_key_light.light_energy = float(EMOTION_LIGHT_ENERGY.get(normalized, EMOTION_LIGHT_ENERGY["neutral"]))


func _log_emotion_status(status: Dictionary) -> void:
	var message := String(status.get("message", ""))
	if message.is_empty():
		return
	_log_panel_message(message)


func _apply_camera(camera_name: String, force: bool = false) -> void:
	var normalized := camera_name.strip_edges().to_lower()
	if normalized.is_empty():
		normalized = "front"
	if normalized == _last_camera and _camera != null and not force:
		return
	_last_camera = normalized

	if _camera == null:
		return

	if _avatar_view != null and _avatar_view.has_method("frame_camera"):
		_avatar_view.frame_camera(_camera, normalized)
		return

	match normalized:
		"side":
			_camera.position = Vector3(3.0, 1.35, 2.6)
		"close":
			_camera.position = Vector3(0.0, 1.45, 2.25)
		"top":
			_camera.position = Vector3(0.0, 4.0, 1.2)
		_:
			_camera.position = Vector3(0.0, 1.35, 3.6)
	_camera.look_at(Vector3(0.0, 1.0, 0.0), Vector3.UP)
