// Komut adları snake_case yazılır: Tauri CLI bunları lowerCamelCase'e çevirip
// Kotlin tarafındaki metotla eşler ve `allow-<ad>` izinlerini buradan üretir.
const COMMANDS: &[&str] = &[
    "create",
    "set_bounds",
    "show",
    "hide",
    "set_visible",
    "load_url",
    "go_back",
    "go_forward",
    "reload",
    "stop_loading",
    "set_desktop_mode",
    "close",
    "close_all",
    "respond",
    "set_provider",
    "clear_data",
    "snapshot",
    "register_listener",
    "remove_listener",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .build();
}