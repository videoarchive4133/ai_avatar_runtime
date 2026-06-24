extends Node
class_name MotionController

signal motion_changed(motion: String)

const SUPPORTED_MOTIONS = [
	"idle",
	"talk",
	"happy",
	"bow",
	"dance",
	"wave",
	"walk",
	"run",
	"natural_walk",
	"natural_idle",
	"natural_wave",
]

var _avatar_view: Node
var _current_motion := ""
var _current_motion_file := ""
var _last_motion_status: Dictionary = {}


func set_avatar_view(avatar_view: Node) -> void:
	_avatar_view = avatar_view
	_apply_current_motion_to_avatar()


func apply_motion(motion: String, force: bool = false) -> void:
	apply_motion_request(motion, "", force)


func apply_motion_request(motion: String, motion_file: String = "", force: bool = false) -> void:
	var normalized := _normalize_motion(motion)
	var normalized_motion_file := motion_file.strip_edges()
	if normalized == _current_motion and normalized_motion_file == _current_motion_file and not force:
		return

	_current_motion = normalized
	_current_motion_file = normalized_motion_file
	_apply_current_motion_to_avatar()
	motion_changed.emit(_current_motion)


func refresh_motion() -> void:
	if _current_motion.is_empty():
		return
	_apply_current_motion_to_avatar()
	motion_changed.emit(_current_motion)


func get_current_motion() -> String:
	return _current_motion


func get_current_motion_file() -> String:
	return _current_motion_file


func get_last_motion_status() -> Dictionary:
	return _last_motion_status.duplicate(true)


func _normalize_motion(motion: String) -> String:
	var normalized := motion.strip_edges().to_lower()
	if normalized.is_empty():
		return "idle"
	if not SUPPORTED_MOTIONS.has(normalized):
		return "idle"
	return normalized


func _apply_current_motion_to_avatar() -> void:
	_last_motion_status = {}
	if _avatar_view == null:
		return
	var status: Variant = null
	if not _current_motion_file.is_empty() and _avatar_view.has_method("set_motion_file"):
		status = _avatar_view.set_motion_file(_current_motion_file, _current_motion)
	elif _avatar_view.has_method("set_motion"):
		status = _avatar_view.set_motion(_current_motion)
	if typeof(status) == TYPE_DICTIONARY:
		_last_motion_status = status
