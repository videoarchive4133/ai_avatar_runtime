extends PanelContainer
class_name ActionPanel

signal reload_requested
signal model_show_requested
signal model_hide_requested
signal camera_view_requested(view_name: String)

const ProjectPathsScript = preload("res://scripts/ProjectPaths.gd")

const FIELD_KEYS = [
	"character",
	"emotion",
	"motion",
	"motion_file",
	"speech",
	"speech_audio",
	"lip_sync_enabled",
	"lip_sync_debug",
	"lip_sync_mouth",
	"camera",
	"source",
	"status",
]

const EMOTION_COLORS = {
	"neutral": Color(0.075, 0.085, 0.1, 0.94),
	"happy": Color(0.055, 0.16, 0.105, 0.94),
	"angry": Color(0.18, 0.07, 0.065, 0.94),
	"sad": Color(0.06, 0.09, 0.17, 0.94),
}

var _value_labels: Dictionary = {}
var _load_status_label: Label
var _log_view: RichTextLabel
var _lip_sync_mouth_label: Label
var _panel_style: StyleBoxFlat
var _log_lines: Array[String] = []
var _built := false


func _ready() -> void:
	_build()


func set_action(data: Dictionary) -> void:
	_ensure_built()
	for key in FIELD_KEYS:
		var label := _value_labels.get(key) as Label
		if label != null:
			var value: Variant = data.get(key, null)
			if key == "status" and value == null:
				value = "loaded"
			label.text = _format_value(value)

	var emotion := String(data.get("emotion", "neutral")).strip_edges().to_lower()
	if emotion.is_empty():
		emotion = "neutral"
	_apply_emotion_style(emotion)


func set_load_status(state: String, message: String) -> void:
	_ensure_built()
	if _load_status_label != null:
		_load_status_label.text = "%s | %s" % [state, message]


func set_load_status_from_watcher(status: Dictionary) -> void:
	var state := String(status.get("state", "unknown"))
	var message := String(status.get("message", ""))
	var path := String(status.get("path", ""))
	if not path.is_empty():
		message = "%s (%s)" % [message, ProjectPathsScript.display_path(path)]
	set_load_status(state, message)


func log_message(message: String) -> void:
	_ensure_built()
	print(message)
	var stamp := Time.get_time_string_from_system()
	_log_lines.append("[%s] %s" % [stamp, message])
	while _log_lines.size() > 120:
		_log_lines.remove_at(0)
	if _log_view != null:
		_log_view.text = "\n".join(_log_lines)
		_log_view.scroll_to_line(maxi(_log_lines.size() - 1, 0))


func _build() -> void:
	if _built:
		return
	_built = true

	custom_minimum_size = Vector2(420, 0)
	_panel_style = StyleBoxFlat.new()
	_panel_style.bg_color = EMOTION_COLORS["neutral"]
	_panel_style.border_color = Color(0.45, 0.48, 0.52, 0.55)
	_panel_style.set_border_width_all(1)
	_panel_style.set_corner_radius_all(8)
	add_theme_stylebox_override("panel", _panel_style)

	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 14)
	margin.add_theme_constant_override("margin_top", 14)
	margin.add_theme_constant_override("margin_right", 14)
	margin.add_theme_constant_override("margin_bottom", 14)
	add_child(margin)

	var root := VBoxContainer.new()
	root.add_theme_constant_override("separation", 10)
	margin.add_child(root)

	var header := HBoxContainer.new()
	header.add_theme_constant_override("separation", 8)
	root.add_child(header)

	var title := Label.new()
	title.text = "AI Avatar Runtime"
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	title.add_theme_font_size_override("font_size", 20)
	header.add_child(title)

	var reload_button := Button.new()
	reload_button.text = "再読み込み"
	reload_button.tooltip_text = "actions/action.json"
	reload_button.pressed.connect(_on_reload_pressed)
	header.add_child(reload_button)

	var model_controls := HBoxContainer.new()
	model_controls.add_theme_constant_override("separation", 8)
	root.add_child(model_controls)

	var show_model_button := Button.new()
	show_model_button.text = "モデル表示"
	show_model_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	show_model_button.pressed.connect(_on_model_show_pressed)
	model_controls.add_child(show_model_button)

	var hide_model_button := Button.new()
	hide_model_button.text = "モデル非表示"
	hide_model_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hide_model_button.pressed.connect(_on_model_hide_pressed)
	model_controls.add_child(hide_model_button)

	var camera_controls := HBoxContainer.new()
	camera_controls.add_theme_constant_override("separation", 6)
	root.add_child(camera_controls)

	_add_camera_button(camera_controls, "正面", "front")
	_add_camera_button(camera_controls, "背面", "back")
	_add_camera_button(camera_controls, "左", "left")
	_add_camera_button(camera_controls, "右", "right")

	var grid := GridContainer.new()
	grid.columns = 2
	grid.add_theme_constant_override("h_separation", 14)
	grid.add_theme_constant_override("v_separation", 8)
	root.add_child(grid)

	for key in FIELD_KEYS:
		_add_row(grid, key)

	var load_key := Label.new()
	load_key.text = "load"
	load_key.modulate = Color(0.75, 0.78, 0.82)
	grid.add_child(load_key)

	_load_status_label = Label.new()
	_load_status_label.text = "waiting"
	_load_status_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_load_status_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	grid.add_child(_load_status_label)

	var lip_sync_key := Label.new()
	lip_sync_key.text = "lip_sync_mouth"
	lip_sync_key.modulate = Color(0.75, 0.78, 0.82)
	grid.add_child(lip_sync_key)

	_lip_sync_mouth_label = Label.new()
	_lip_sync_mouth_label.text = "-"
	_lip_sync_mouth_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_lip_sync_mouth_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	grid.add_child(_lip_sync_mouth_label)

	var separator := HSeparator.new()
	root.add_child(separator)

	var log_label := Label.new()
	log_label.text = "Log"
	log_label.add_theme_font_size_override("font_size", 14)
	root.add_child(log_label)

	_log_view = RichTextLabel.new()
	_log_view.custom_minimum_size = Vector2(0, 210)
	_log_view.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_log_view.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_log_view.fit_content = false
	_log_view.scroll_active = true
	_log_view.selection_enabled = true
	root.add_child(_log_view)


func _ensure_built() -> void:
	if not _built:
		_build()


func _add_row(grid: GridContainer, key: String) -> void:
	var key_label := Label.new()
	key_label.text = key
	key_label.modulate = Color(0.75, 0.78, 0.82)
	grid.add_child(key_label)

	var value_label := Label.new()
	value_label.text = "-"
	value_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	value_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	value_label.clip_text = true
	grid.add_child(value_label)
	_value_labels[key] = value_label


func _add_camera_button(parent: BoxContainer, label: String, view_name: String) -> void:
	var button := Button.new()
	button.text = label
	button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	button.pressed.connect(func() -> void:
		camera_view_requested.emit(view_name)
	)
	parent.add_child(button)


func _format_value(value: Variant) -> String:
	if value == null:
		return "-"
	var text := str(value)
	if text.strip_edges().is_empty():
		return "-"
	return text


func _apply_emotion_style(emotion: String) -> void:
	if _panel_style == null:
		return
	var color: Color = EMOTION_COLORS.get(emotion, EMOTION_COLORS["neutral"])
	_panel_style.bg_color = color
	add_theme_stylebox_override("panel", _panel_style)


func set_lip_sync_mouth(shape_name: String) -> void:
	_ensure_built()
	if _lip_sync_mouth_label != null:
		var text := shape_name.strip_edges()
		if text.is_empty():
			text = "-"
		_lip_sync_mouth_label.text = text


func _on_reload_pressed() -> void:
	reload_requested.emit()


func _on_model_show_pressed() -> void:
	model_show_requested.emit()


func _on_model_hide_pressed() -> void:
	model_hide_requested.emit()
