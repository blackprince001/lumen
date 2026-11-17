//! Where one library window is. Each window has its own, so ⌥⌘N gives a
//! second window that can sit on another page.

use gpui::{Context, EventEmitter};

use super::route::Route;

pub struct Navigator {
    pub route: Route,
}

impl EventEmitter<Route> for Navigator {}

impl Navigator {
    pub fn new() -> Self {
        Self { route: Route::Home }
    }

    pub fn go(&mut self, route: Route, cx: &mut Context<Self>) {
        if route != self.route {
            self.route = route;
            cx.emit(route);
            cx.notify();
        }
    }
}
