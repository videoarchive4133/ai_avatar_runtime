extends Node
class_name ActionWatcher

signal action_loaded(data: Dictionary, status: Dictionary)
signal action_failed(message: String, status: Dictionary)

@export var action_path: String = ""
@export var tmp_action_path: String = ""
@export_range(0.1, 10.0, 0.05) var poll_interval: float = 0.25

var _timer: Timer
var _last_signature := ""
var _pending_tmp_signature := ""
var _last_tmp_error_signature := ""
var _last_good_data: Dictionary = {}


func _ready() -> void:
	_timer = Timer.new()
	_timer.name = "PollTimer"
	_timer.wait_time = maxf(poll_interval, 0.1)
	_timer.autostart = true
	_timer.timeout.connect(_poll)
	add_child(_timer)

	if not action_path.is_empty():
		reload()


func configure(path: String, interval: float = 0.25) -> void:
	action_path = path
	tmp_action_path = "%s.tmp" % action_path
	poll_interval = maxf(interval, 0.1)
	if _timer != null:
		_timer.wait_time = poll_interval
	reload()


func reload() -> void:
	_load(true)


func get_last_good_data() -> Dictionary:
	return _last_good_data.duplicate(true)


func _poll() -> void:
	_load(false)


func _load(force: bool) -> void:
	var tmp_result := _process_tmp_action(force)
	if bool(tmp_result.get("accepted", false)):
		force = true

	var snapshot := _read_snapshot()
	var signature := String(snapshot.get("signature", ""))

	if not bool(snapshot.get("ok", false)):
		if force or signature != _last_signature:
			_last_signature = signature
			var message := String(snapshot.get("message", "Unknown action.json error"))
			action_failed.emit(message, _make_status("error", message, snapshot))
		return

	if not force and signature == _last_signature:
		return

	_last_signature = signature
	_parse_snapshot(snapshot)


func _read_snapshot() -> Dictionary:
	return _read_file_snapshot(action_path, "action.json")


func _read_file_snapshot(path: String, label: String) -> Dictionary:
	if path.strip_edges().is_empty():
		return {
			"ok": false,
			"message": "%s path is empty." % label,
			"signature": "empty-path",
			"path": path,
		}

	if not FileAccess.file_exists(path):
		return {
			"ok": false,
			"message": "%s was not found: %s" % [label, path],
			"signature": "missing:%s" % path,
			"path": path,
		}

	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		var open_error := FileAccess.get_open_error()
		return {
			"ok": false,
			"message": "Could not open %s: %s (error %s)" % [label, path, open_error],
			"signature": "open-error:%s:%s" % [path, open_error],
			"path": path,
		}

	var text := file.get_as_text()
	var modified_time := FileAccess.get_modified_time(path)
	var signature := "%s:%s:%s" % [modified_time, text.length(), text.hash()]
	return {
		"ok": true,
		"text": text,
		"modified_time": modified_time,
		"signature": signature,
		"path": path,
	}


func _parse_snapshot(snapshot: Dictionary) -> void:
	var text := String(snapshot.get("text", ""))
	var parse_result := _parse_action_text(text)
	if not bool(parse_result.get("ok", false)):
		var message := String(parse_result.get("message", "Unknown JSON parse error"))
		action_failed.emit(message, _make_status("error", message, snapshot))
		return

	var data: Dictionary = parse_result["data"]
	_last_good_data = data.duplicate(true)
	action_loaded.emit(data, _make_status("loaded", "Loaded action.json.", snapshot))


func _parse_action_text(text: String) -> Dictionary:
	var parser := JSON.new()
	var error := parser.parse(text)
	if error != OK:
		var message := "JSON parse error at line %s: %s" % [
			parser.get_error_line(),
			parser.get_error_message()
		]
		return {
			"ok": false,
			"message": message,
		}

	var parsed: Variant = parser.data
	if typeof(parsed) != TYPE_DICTIONARY:
		var message := "JSON root must be an object."
		return {
			"ok": false,
			"message": message,
		}

	var data: Dictionary = parsed
	return {
		"ok": true,
		"data": data,
	}


func _process_tmp_action(force: bool) -> Dictionary:
	var tmp_path := _get_tmp_action_path()
	if tmp_path.is_empty() or not FileAccess.file_exists(tmp_path):
		_pending_tmp_signature = ""
		_last_tmp_error_signature = ""
		return {
			"seen": false,
			"accepted": false,
		}

	var snapshot := _read_file_snapshot(tmp_path, "action.json.tmp")
	var signature := String(snapshot.get("signature", ""))
	if not bool(snapshot.get("ok", false)):
		var read_message := String(snapshot.get("message", "Unknown action.json.tmp error"))
		_emit_tmp_failure_once(read_message, snapshot, signature, force)
		return {
			"seen": true,
			"accepted": false,
		}

	if not force and signature != _pending_tmp_signature:
		_pending_tmp_signature = signature
		return {
			"seen": true,
			"accepted": false,
			"waiting": true,
		}

	_pending_tmp_signature = signature
	var parse_result := _parse_action_text(String(snapshot.get("text", "")))
	if not bool(parse_result.get("ok", false)):
		var parse_message := "action.json.tmp ignored: %s" % String(parse_result.get("message", "Unknown JSON parse error"))
		_emit_tmp_failure_once(parse_message, snapshot, signature, force)
		return {
			"seen": true,
			"accepted": false,
		}

	var replace_error := DirAccess.rename_absolute(tmp_path, action_path)
	if replace_error != OK:
		var replace_message := "Could not replace action.json from action.json.tmp (error %s)." % replace_error
		_emit_tmp_failure_once(replace_message, snapshot, signature, force)
		return {
			"seen": true,
			"accepted": false,
		}

	_pending_tmp_signature = ""
	_last_tmp_error_signature = ""
	_last_signature = ""
	return {
		"seen": true,
		"accepted": true,
	}


func _get_tmp_action_path() -> String:
	if not tmp_action_path.strip_edges().is_empty():
		return tmp_action_path
	if action_path.strip_edges().is_empty():
		return ""
	return "%s.tmp" % action_path


func _emit_tmp_failure_once(message: String, snapshot: Dictionary, signature: String, force: bool) -> void:
	if signature.is_empty():
		signature = String(snapshot.get("signature", ""))
	if not force and signature == _last_tmp_error_signature:
		return
	_last_tmp_error_signature = signature
	push_warning(message)
	action_failed.emit(message, _make_status("error", message, snapshot))


func _make_status(state: String, message: String, snapshot: Dictionary) -> Dictionary:
	return {
		"state": state,
		"message": message,
		"path": snapshot.get("path", action_path),
		"modified_time": snapshot.get("modified_time", 0),
		"signature": snapshot.get("signature", ""),
	}
