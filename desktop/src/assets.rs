//! Bundled assets: our icons, fonts and logo, then gpui-component's own icons.

use std::borrow::Cow;

use gpui::{App, AssetSource, SharedString};
use rust_embed::RustEmbed;

#[derive(RustEmbed)]
#[folder = "assets"]
#[include = "icons/*.svg"]
#[include = "fonts/*.ttf"]
#[include = "app/*.png"]
struct Bundled;

pub struct Assets;

impl AssetSource for Assets {
    fn load(&self, path: &str) -> gpui::Result<Option<Cow<'static, [u8]>>> {
        if let Some(file) = Bundled::get(path) {
            return Ok(Some(file.data));
        }
        gpui_kit_assets::Assets.load(path)
    }

    fn list(&self, path: &str) -> gpui::Result<Vec<SharedString>> {
        let mut found: Vec<SharedString> = Bundled::iter()
            .filter(|p| p.starts_with(path))
            .map(|p| p.to_string().into())
            .collect();
        found.extend(gpui_kit_assets::Assets.list(path)?);
        Ok(found)
    }
}

/// Register Inter with the text system. The web app uses Inter Variable; we
/// ship the static instances for the weights it uses.
pub fn load_fonts(cx: &mut App) {
    let fonts = Bundled::iter()
        .filter(|p| p.starts_with("fonts/"))
        .filter_map(|p| Bundled::get(&p).map(|f| f.data))
        .collect::<Vec<_>>();
    if let Err(err) = cx.text_system().add_fonts(fonts) {
        log::error!("couldn't load bundled fonts: {err}");
    }
}
