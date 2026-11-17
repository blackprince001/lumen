//! About Lumen: the logo, the name and the version.

use gpui::{
    App, AppContext as _, Bounds, Context, FontWeight, IntoElement, ObjectFit, ParentElement,
    Render, Styled, StyledImage as _, TitlebarOptions, Window, WindowOptions, div, img, px, size,
};
use gpui_component::Root;

use crate::{
    kit::ui::Type,
    theme::{self, ActivePalette},
    windows::{self, WindowKey},
};

pub fn open_or_focus(cx: &mut App) {
    if windows::focus(WindowKey::About, cx) {
        return;
    }
    let bounds = Bounds::centered(None, size(px(300.), px(280.)), cx);
    let opened = cx.open_window(
        WindowOptions {
            window_bounds: Some(gpui::WindowBounds::Windowed(bounds)),
            titlebar: Some(TitlebarOptions {
                title: Some("About Lumen".into()),
                appears_transparent: true,
                traffic_light_position: Some(gpui::point(px(20.), px(14.))),
            }),
            is_resizable: false,
            is_minimizable: false,
            ..Default::default()
        },
        |window, cx| {
            theme::init(window, cx);
            let view = cx.new(|cx| {
                cx.on_release(|_: &mut About, cx| windows::forget(WindowKey::About, cx)).detach();
                About
            });
            cx.new(|cx| Root::new(view, window, cx))
        },
    );
    match opened {
        Ok(handle) => windows::register(WindowKey::About, handle.into(), cx),
        Err(err) => log::error!("couldn’t open About: {err}"),
    }
}

struct About;

impl Render for About {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let t = *cx.palette();
        div()
            .size_full()
            .bg(t.settings_bg)
            .flex()
            .flex_col()
            .items_center()
            .justify_center()
            .gap(px(6.))
            .chrome()
            .text_color(t.text_primary)
            .child(img("app/logo-128.png").size(px(72.)).object_fit(ObjectFit::Contain))
            .child(
                div()
                    .mt(px(8.))
                    .type_title()
                    .font_weight(FontWeight::BOLD)
                    .child("Lumen"),
            )
            .child(
                div()
                    .type_small()
                    .text_color(t.text_secondary)
                    .child(format!("Version {}", env!("CARGO_PKG_VERSION"))),
            )
    }
}
