extends RefCounted
class_name ProjectPaths


static func repo_root() -> String:
	var app_dir := ProjectSettings.globalize_path("res://").simplify_path()
	return app_dir.path_join("..").simplify_path()


static func repo_file(relative_path: String) -> String:
	return repo_root().path_join(relative_path).simplify_path()


static func display_path(path: String) -> String:
	var root := repo_root()
	var prefix := root
	if not prefix.ends_with("/"):
		prefix += "/"
	if path.begins_with(prefix):
		return path.substr(prefix.length())
	return path
