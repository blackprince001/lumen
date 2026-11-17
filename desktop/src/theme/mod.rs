//! Light and dark themes. `ThemeChoice` is saved; `Palette` is what views
//! read; gpui-component's own theme is repainted from our tokens whenever the
//! effective mode changes, so its text inputs match.
//!
//! Debug builds can force a mode with `LUMEN_DEV_APPEARANCE=dark|light`.

mod tokens;

use gpui::{App, Global, Window, WindowAppearance};
use gpui_component::{Theme, ThemeMode};
use serde::{Deserialize, Serialize};

use crate::kit::state::prefs::Prefs;
pub use tokens::{Tokens, paper_theme};

const PREF_KEY: &str = "theme";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ThemeChoice {
    #[default]
    System,
    Light,
    Dark,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Mode {
    Light,
    Dark,
}

/// The tokens in effect. Read with `cx.palette()`.
pub struct Palette {
    pub choice: ThemeChoice,
    pub mode: Mode,
    pub tokens: Tokens,
}

impl Global for Palette {}

pub trait ActivePalette {
    fn palette(&self) -> &Tokens;
    fn is_dark(&self) -> bool;
}

impl ActivePalette for App {
    fn palette(&self) -> &Tokens {
        &self.global::<Palette>().tokens
    }

    fn is_dark(&self) -> bool {
        self.global::<Palette>().mode == Mode::Dark
    }
}

/// A forced mode for screenshots; always `None` in release builds.
fn forced_mode() -> Option<Mode> {
    if !cfg!(debug_assertions) {
        return None;
    }
    match std::env::var("LUMEN_DEV_APPEARANCE").as_deref() {
        Ok("dark") => Some(Mode::Dark),
        Ok("light") => Some(Mode::Light),
        _ => None,
    }
}

fn system_mode(window: &Window) -> Mode {
    match window.appearance() {
        WindowAppearance::Dark | WindowAppearance::VibrantDark => Mode::Dark,
        WindowAppearance::Light | WindowAppearance::VibrantLight => Mode::Light,
    }
}

fn resolve(choice: ThemeChoice, window: &Window) -> Mode {
    if let Some(mode) = forced_mode() {
        return mode;
    }
    match choice {
        ThemeChoice::System => system_mode(window),
        ThemeChoice::Light => Mode::Light,
        ThemeChoice::Dark => Mode::Dark,
    }
}

/// Install the theme for `window` and follow system appearance changes.
/// Call for every window; the first call sets the global.
pub fn init(window: &mut Window, cx: &mut App) {
    let choice = Prefs::get(cx, PREF_KEY).unwrap_or_default();
    apply(choice, resolve(choice, window), cx);

    window
        .observe_window_appearance(|window, cx| {
            let choice = cx.global::<Palette>().choice;
            apply(choice, resolve(choice, window), cx);
        })
        .detach();
}

fn apply(choice: ThemeChoice, mode: Mode, cx: &mut App) {
    if cx.has_global::<Palette>() {
        let current = cx.global::<Palette>();
        if current.mode == mode && current.choice == choice {
            return;
        }
    }
    let tokens = match mode {
        Mode::Light => Tokens::light(),
        Mode::Dark => Tokens::dark(),
    };
    cx.set_global(Palette { choice, mode, tokens });

    // gpui-component loads its own palette on a mode change, so switch mode
    // first and paint our colours over it in a second update.
    Theme::change(
        match mode {
            Mode::Light => ThemeMode::Light,
            Mode::Dark => ThemeMode::Dark,
        },
        None,
        cx,
    );
    Theme::update(cx, |theme| paint(theme, &tokens));
    cx.refresh_windows();
}

fn paint(theme: &mut Theme, t: &Tokens) {
    theme.font_family = crate::kit::ui::typography::CHROME_FONT.into();
    theme.font_size = gpui::px(13.);
    theme.radius = gpui::px(6.);
    theme.shadow = false;

    let c = &mut theme.colors;
    c.background = t.window_bg;
    c.foreground = t.text_primary;
    c.border = t.hairline;
    c.input = t.field_ring;
    c.ring = t.focus;
    c.caret = t.text_primary;
    c.selection = {
        let mut s = t.accent;
        s.a = 0.28;
        s
    };
    c.muted_foreground = t.text_secondary;
    c.popover = t.surface_raised;
    c.popover_foreground = t.text_primary;
    c.primary = t.accent;
    c.primary_foreground = t.accent_foreground;
}
