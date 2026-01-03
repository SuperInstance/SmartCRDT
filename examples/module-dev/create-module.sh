#!/bin/bash
# @file create-module.sh
# @brief Create new WASM module from template

set -e

MODULE_NAME="${1:-my_custom_module}"
MODULE_TYPE="${2:-parser}"

if [ -z "$MODULE_NAME" ]; then
    echo "Usage: $0 <module_name> [parser|detector|generator]"
    exit 1
fi

echo "[CREATE] Creating new ActiveLog module: ${MODULE_NAME}"
echo "[CREATE] Type: ${MODULE_TYPE}"

# Create module directory
mkdir -p "$MODULE_NAME/src"

# Create Cargo.toml
cat > "$MODULE_NAME/Cargo.toml" <<EOF
[package]
name = "${MODULE_NAME}"
version = "0.1.0"
edition = "2021"
publish = false

[lib]
crate-type = ["cdylib"]

[dependencies]
activelog-module = { path = "../../../packages/modules" }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

[profile.release]
opt-level = 3
lto = true
codegen-units = 1
panic = "abort"
EOF

# Create src/lib.rs based on type
case "$MODULE_TYPE" in
    parser)
        cat > "$MODULE_NAME/src/lib.rs" <<'EOF'
use activelog_module::*;

/// Module name
#[no_mangle]
pub extern "C" fn module_name() -> *const u8 {
    b"custom_parser\0".as_ptr()
}

/// Module version
#[no_mangle]
pub extern "C" fn module_version() -> *const u8 {
    b"0.1.0\0".as_ptr()
}

/// Module type (0 = parser)
#[no_mangle]
pub extern "C" fn module_type() -> u32 {
    0
}

/// Parse custom log format
#[no_mangle]
pub extern "C" fn parse(data: *const u8, len: usize) -> i32 {
    // TODO: Implement your parser
    0
}
EOF
        ;;
    detector)
        cat > "$MODULE_NAME/src/lib.rs" <<'EOF'
use activelog_module::*;

/// Module name
#[no_mangle]
pub extern "C" fn module_name() -> *const u8 {
    b"custom_detector\0".as_ptr()
}

/// Module version
#[no_mangle]
pub extern "C" fn module_version() -> *const u8 {
    b"0.1.0\0".as_ptr()
}

/// Module type (1 = detector)
#[no_mangle]
pub extern "C" fn module_type() -> u32 {
    1
}

/// Detect patterns
#[no_mangle]
pub extern "C" fn detect(events: *const Event, count: usize) -> i32 {
    // TODO: Implement your detector
    0
}
EOF
        ;;
    generator)
        cat > "$MODULE_NAME/src/lib.rs" <<'EOF'
use activelog_module::*;

/// Module name
#[no_mangle]
pub extern "C" fn module_name() -> *const u8 {
    b"custom_generator\0".as_ptr()
}

/// Module version
#[no_mangle]
pub extern "C" fn module_version() -> *const u8 {
    b"0.1.0\0".as_ptr()
}

/// Module type (2 = generator)
#[no_mangle]
pub extern "C" fn module_type() -> u32 {
    2
}

/// Generate suggestions
#[no_mangle]
pub extern "C" fn generate(context: *const Context) -> i32 {
    // TODO: Implement your generator
    0
}
EOF
        ;;
esac

# Create README
cat > "$MODULE_NAME/README.md" <<EOF
# ${MODULE_NAME}

ActiveLog WASM module for ${MODULE_TYPE} functionality.

## Building

\`\`\`bash
cargo build --release --target wasm32-unknown-unknown
\`\`\`

## Testing

\`\`\`bash
cargo test
\`\`\`

## Building and Signing

\`\`\`bash
cd ..
./build-module.sh ${MODULE_NAME}
\`\`\`

## Registering

\`\`\`bash
./register-module.sh ${MODULE_NAME}.signed.wasm ${MODULE_TYPE} ${MODULE_NAME}
\`\`\`
EOF

echo "[CREATE] Module created successfully!"
echo "[CREATE] Location: ${MODULE_NAME}/"
echo ""
echo "[CREATE] Next steps:"
echo "   1. Edit ${MODULE_NAME}/src/lib.rs to implement your module"
echo "   2. cd ${MODULE_NAME}"
echo "   3. cargo test"
echo "   4. cd .. && ./build-module.sh ${MODULE_NAME}"
