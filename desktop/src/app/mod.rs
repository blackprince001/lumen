//! App-level wiring: the menu bar's actions that don't belong to one window.

pub mod about_window;
pub mod actions;
pub mod google;
pub mod library_window;
pub mod menus;
pub mod navigator;
pub mod route;
pub mod settings_window;

use gpui::{App, PromptLevel, Window};

use crate::{state::session::SessionStore, windows};
use actions::*;

/// Register the handlers for actions that work from any window.
pub fn init(cx: &mut App) {
    actions::bind_keys(cx);

    cx.on_action(|_: &Quit, cx| cx.quit());
    cx.on_action(|_: &HideApp, cx| cx.hide());
    cx.on_action(|_: &HideOthers, cx| cx.hide_other_apps());
    cx.on_action(|_: &ShowAll, cx| cx.unhide_other_apps());
    cx.on_action(|_: &About, cx| about_window::open_or_focus(cx));
    cx.on_action(|_: &OpenSettings, cx| settings_window::open_or_focus(cx));
    cx.on_action(|_: &NewLibraryWindow, cx| {
        library_window::open(cx);
    });
    cx.on_action(|_: &ShowLibrary, cx| {
        if !windows::focus_library(cx) {
            library_window::open(cx);
        }
    });
    cx.on_action(|_: &BringAllToFront, cx| windows::bring_all_to_front(cx));
    cx.on_action(|_: &CloseAll, cx| {
        for handle in cx.windows() {
            handle.update(cx, |_, window, _| window.remove_window()).ok();
        }
    });
    cx.on_action(|_: &SignOut, cx| {
        if let Some(handle) = cx.active_window().or_else(|| cx.windows().into_iter().next()) {
            handle.update(cx, |_, window, cx| confirm_sign_out(window, cx)).ok();
        }
    });

    // Window commands act on whichever window is in front.
    cx.on_action(|_: &CloseWindow, cx| in_front(cx, |window, _| window.remove_window()));
    cx.on_action(|_: &Minimize, cx| in_front(cx, |window, _| window.minimize_window()));
    cx.on_action(|_: &Zoom, cx| in_front(cx, |window, _| window.zoom_window()));
    cx.on_action(|_: &EnterFullScreen, cx| in_front(cx, |window, _| window.toggle_fullscreen()));

    // Leave when the last window goes, as the single-window Learning app does.
    cx.on_window_closed(|cx, _| {
        if cx.windows().is_empty() {
            cx.quit();
        }
    })
    .detach();
}

fn in_front(cx: &mut App, f: impl FnOnce(&mut Window, &mut App)) {
    if let Some(handle) = cx.active_window() {
        handle.update(cx, |_, window, cx| f(window, cx)).ok();
    }
}

/// "Sign Out…": ask first, then sign out.
pub fn confirm_sign_out(window: &mut Window, cx: &mut App) {
    if !matches!(
        SessionStore::global(cx).read(cx).state,
        crate::state::session::Session::SignedIn(_)
    ) {
        return;
    }
    let answer = window.prompt(
        PromptLevel::Warning,
        "Sign out of Lumen?",
        Some("Your papers stay in your library. Sign in again to get back to them."),
        &["Sign Out", "Cancel"],
        cx,
    );
    cx.spawn(async move |cx| {
        if answer.await == Ok(0) {
            cx.update(|cx| {
                SessionStore::global(cx).update(cx, |session, cx| session.sign_out(cx));
            });
        }
    })
    .detach();
}
