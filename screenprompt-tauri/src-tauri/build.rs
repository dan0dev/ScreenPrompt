fn main() {
  // lib.rs reads GITHUB_ACTIONS at compile time (official releases are built there)
  println!("cargo:rerun-if-env-changed=GITHUB_ACTIONS");
  tauri_build::build()
}
