fn main() {
    napi_build::setup();
    println!("cargo:rerun-if-changed=Cargo.toml");
}
