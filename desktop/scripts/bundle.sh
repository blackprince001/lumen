#!/bin/sh
# Build Lumen.app in target/release.
#
#   scripts/bundle.sh                              # talks to the live site
#   LUMEN_API_URL=http://localhost:8000/api/v1 scripts/bundle.sh
#   open target/release/Lumen.app
#
# Set LUMEN_GOOGLE_CLIENT_ID and LUMEN_GOOGLE_CLIENT_SECRET to bake in the
# Google "Desktop app" client, or Google sign-in stays off. They end up in
# Info.plist, which is expected: Google says a desktop client's secret is not
# confidential and relies on PKCE.
#
# Optional:
#   UNIVERSAL=1      one binary for Apple Silicon and Intel
#   SIGN_IDENTITY=…  a Developer ID to sign with, hardened runtime on;
#                    without it the app is ad-hoc signed
set -eu
cd "$(dirname "$0")/.."

if [ -n "${UNIVERSAL:-}" ]; then
  for target in aarch64-apple-darwin x86_64-apple-darwin; do
    cargo build --release --locked --target "$target"
  done
  mkdir -p target/release
  binary=target/release/lumen-desktop-universal
  lipo -create -output "$binary" \
    target/aarch64-apple-darwin/release/lumen-desktop \
    target/x86_64-apple-darwin/release/lumen-desktop
else
  cargo build --release --locked
  binary=target/release/lumen-desktop
fi

app=target/release/Lumen.app
version=$(sed -n 's/^version = "\(.*\)"/\1/p' Cargo.toml | head -1)
rm -rf "$app"
mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources"
cp "$binary" "$app/Contents/MacOS/Lumen"
cp assets/app/Lumen.icns "$app/Contents/Resources/Lumen.icns"

# Bake in only what's set; the binary's own defaults cover the rest.
env=""
for key in LUMEN_API_URL LUMEN_GOOGLE_CLIENT_ID LUMEN_GOOGLE_CLIENT_SECRET; do
  eval "value=\${$key:-}"
  [ -n "$value" ] && env="$env    <key>$key</key><string>$value</string>
"
done

cat > "$app/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Lumen</string>
  <key>CFBundleDisplayName</key><string>Lumen</string>
  <key>CFBundleIdentifier</key><string>work.pkab.lumen.desktop</string>
  <key>CFBundleExecutable</key><string>Lumen</string>
  <key>CFBundleIconFile</key><string>Lumen</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>$version</string>
  <key>CFBundleVersion</key><string>$version</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>LSEnvironment</key>
  <dict>
$env
  </dict>
</dict>
</plist>
PLIST

if [ -n "${SIGN_IDENTITY:-}" ]; then
  codesign --force --options runtime --timestamp --sign "$SIGN_IDENTITY" "$app"
else
  # Ad-hoc sign so the Keychain can recognise the app between launches.
  codesign --force --sign - "$app" >/dev/null
fi
echo "$app"
