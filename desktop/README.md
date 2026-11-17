# Lumen for Mac

A native macOS client for Lumen, written in GPUI. The plan is in `docs/features/desktop.md`. This is milestone L1: sign in, the library window, Settings ▸ Account.

## Build

You need Rust 1.98 or later and Xcode with its Metal toolchain (`xcodebuild -downloadComponent MetalToolchain`).

    cargo build
    cargo test

`scripts/bundle.sh` builds `target/release/Lumen.app`. `node scripts/gen-icons.mjs` regenerates `assets/icons` from `frontend-v2`.

## Run against the local stack

Debug builds talk to `http://localhost:8000/api/v1`. Start the stack the way `docs/infra/setup.md` describes, then:

    cargo run

Never point a debug build at the live site.

## Environment

| Variable | What it does |
|---|---|
| `LUMEN_API_URL` | Server, ending in `/api/v1`. Debug default is localhost:8000, release default is the live site |
| `LUMEN_GOOGLE_CLIENT_ID`, `LUMEN_GOOGLE_CLIENT_SECRET` | A Google "Desktop app" OAuth client. Without them the Google button is disabled. `bundle.sh` bakes them into the app |
| `LUMEN_DEV_ADMIN_USER`, `LUMEN_DEV_ADMIN_PASSWORD` | Debug builds only: sign in as the local admin at launch (plain text, not the base64 the server's `.env` holds) |
| `LUMEN_DEV_APPEARANCE` | Debug builds only: `dark` or `light` |
| `LUMEN_DEV_BACKGROUND` | Debug builds only: open without taking focus |

The server must accept the desktop client's ID (`GOOGLE_DESKTOP_CLIENT_ID`).

## Layout

`src/kit` holds code copied from Learning for Mac, to be pulled into a shared crate after L2. Everything else is Lumen's: `api`, `app` (windows, menus, Google flow), `screens`, `views`, `windows` (the one-window-per-item registry), `theme`.

Unbundled dev builds keep the session in `~/Library/Application Support/lumen-desktop/` (mode 0600) instead of the Keychain, because every rebuild changes the binary's signature.
