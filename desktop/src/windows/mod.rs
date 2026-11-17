//! One window per thing: the registry that keeps track of them.
//!
//! The library window and Settings are opened from here today; Paper and
//! Research windows (later milestones) use the same shape Learning uses for
//! its reader windows: `open_or_focus` brings an existing window for a key
//! forward instead of opening a second one, and a window removes itself from
//! the registry when it goes away.

use std::collections::HashMap;

use gpui::{AnyWindowHandle, App, Global};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum WindowKey {
    /// A library window. ⌥⌘N opens another, so each has a number.
    Library(u32),
    Settings,
    About,
    /// One per paper (L3).
    #[allow(dead_code)]
    Paper(i64),
    /// One per research run (L6).
    #[allow(dead_code)]
    Research(i64),
}

impl WindowKey {
    /// Windows that hold a signed-in user's work and close at sign-out.
    pub fn closes_on_sign_out(self) -> bool {
        matches!(self, WindowKey::Paper(_) | WindowKey::Research(_))
    }
}

#[derive(Default)]
struct Registry {
    open: HashMap<WindowKey, AnyWindowHandle>,
    /// The library window most recently opened or brought forward.
    last_library: Option<u32>,
    library_count: u32,
}

impl Global for Registry {}

fn registry(cx: &mut App) -> &mut Registry {
    cx.default_global::<Registry>()
}

/// If `key` already has a window, bring it forward and say so.
pub fn focus(key: WindowKey, cx: &mut App) -> bool {
    let Some(handle) = registry(cx).open.get(&key).copied() else {
        return false;
    };
    let shown = handle.update(cx, |_, window, _| window.activate_window()).is_ok();
    if !shown {
        // Closed since we last looked.
        registry(cx).open.remove(&key);
    } else if let WindowKey::Library(n) = key {
        registry(cx).last_library = Some(n);
    }
    shown
}

pub fn register(key: WindowKey, handle: AnyWindowHandle, cx: &mut App) {
    let registry = registry(cx);
    registry.open.insert(key, handle);
    if let WindowKey::Library(n) = key {
        registry.last_library = Some(n);
    }
}

/// Called by a window's view when it is released.
pub fn forget(key: WindowKey, cx: &mut App) {
    let registry = registry(cx);
    registry.open.remove(&key);
    if registry.last_library == Some(key_number(key)) {
        registry.last_library = None;
    }
}

fn key_number(key: WindowKey) -> u32 {
    match key {
        WindowKey::Library(n) => n,
        _ => u32::MAX,
    }
}

/// A fresh number for a new library window.
pub fn next_library_key(cx: &mut App) -> WindowKey {
    let registry = registry(cx);
    registry.library_count += 1;
    WindowKey::Library(registry.library_count)
}

/// Bring a library window forward: the last one used, else any. False when
/// none is open.
pub fn focus_library(cx: &mut App) -> bool {
    if let Some(n) = registry(cx).last_library
        && focus(WindowKey::Library(n), cx)
    {
        return true;
    }
    let keys: Vec<WindowKey> = registry(cx)
        .open
        .keys()
        .copied()
        .filter(|k| matches!(k, WindowKey::Library(_)))
        .collect();
    keys.into_iter().any(|key| focus(key, cx))
}

/// Close every window whose key matches (sign-out closes paper and research
/// windows).
pub fn close_where(matches: impl Fn(WindowKey) -> bool, cx: &mut App) {
    let doomed: Vec<(WindowKey, AnyWindowHandle)> = registry(cx)
        .open
        .iter()
        .filter(|(key, _)| matches(**key))
        .map(|(key, handle)| (*key, *handle))
        .collect();
    for (key, handle) in doomed {
        registry(cx).open.remove(&key);
        handle.update(cx, |_, window, _| window.remove_window()).ok();
    }
}

/// Bring every window of the app forward.
pub fn bring_all_to_front(cx: &mut App) {
    for handle in cx.windows() {
        handle.update(cx, |_, window, _| window.activate_window()).ok();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_paper_and_research_windows_close_at_sign_out() {
        assert!(WindowKey::Paper(1).closes_on_sign_out());
        assert!(WindowKey::Research(1).closes_on_sign_out());
        assert!(!WindowKey::Library(1).closes_on_sign_out());
        assert!(!WindowKey::Settings.closes_on_sign_out());
    }
}
