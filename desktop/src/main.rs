//! Lumen for Mac: the desktop client.
//!
//!   cargo run
//!
//! `LUMEN_API_URL` points at the server. Release builds default to the live
//! site; debug builds to the local Docker Compose stack on
//! `http://localhost:8000/api/v1`. Google sign-in needs
//! `LUMEN_GOOGLE_CLIENT_ID` and `LUMEN_GOOGLE_CLIENT_SECRET`.
//!
//! Debug builds only: `LUMEN_DEV_ADMIN_USER` and `LUMEN_DEV_ADMIN_PASSWORD`
//! sign in as the local admin at launch, `LUMEN_DEV_APPEARANCE=dark|light`
//! forces a theme, and `LUMEN_DEV_BACKGROUND=1` opens the window without
//! taking focus.

mod api;
mod app;
mod assets;
mod config;
mod icons;
// Copied wholesale from Learning, so parts of it aren't used yet.
#[allow(dead_code)]
mod kit;
mod screens;
mod state;
mod theme;
mod views;
mod windows;

use gpui::App;

fn main() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("warn")).init();

    let (expired_tx, expired_rx) = futures::channel::mpsc::unbounded();
    let api = api::Api::new(config::api_url(), expired_tx);

    gpui_platform::application()
        .with_assets(assets::Assets)
        .run(move |cx: &mut App| {
            assets::load_fonts(cx);
            gpui_component::init(cx);
            kit::state::prefs::Prefs::init(cx);
            cx.set_global(api);
            state::session::SessionStore::init(expired_rx, cx);
            app::init(cx);
            app::library_window::open(cx);
            if cfg!(not(debug_assertions)) || std::env::var_os("LUMEN_DEV_BACKGROUND").is_none() {
                cx.activate(true);
            }
        });
}
