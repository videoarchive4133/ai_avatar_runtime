use std::process::Command;

#[tauri::command]
fn run_blender(script_path: String, args: Vec<String>) -> Result<String, String> {
    let output = Command::new("blender")
        .arg("--background")
        .arg("--python")
        .arg(&script_path)
        .arg("--")
        .args(&args)
        .output()
        .map_err(|e| e.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if output.status.success() {
        Ok(stdout + "\n" + &stderr)
    } else {
        Err(format!("STDOUT:\n{}\nSTDERR:\n{}", stdout, stderr))
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![run_blender])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
