//! A titled page for sidebar items that aren't built yet.

use gpui::{IntoElement, ParentElement, Styled, div, px};

use crate::{
    icons::IconName,
    kit::ui::{Icon, Type},
    theme::Tokens,
};

pub fn placeholder(title: &str, icon: IconName, t: &Tokens) -> impl IntoElement {
    div()
        .size_full()
        .bg(t.window_bg)
        .flex()
        .flex_col()
        .items_center()
        .justify_center()
        .gap(px(8.))
        .child(Icon::new(icon).size(px(32.)).color(t.text_tertiary))
        .child(
            div()
                .chrome()
                .type_title()
                .text_color(t.text_primary)
                .child(title.to_string()),
        )
        .child(
            div()
                .chrome()
                .type_body()
                .text_color(t.text_secondary)
                .child("This page is coming to Lumen for Mac. Use the web app for now."),
        )
}
