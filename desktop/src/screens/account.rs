//! Settings ▸ Account: who is signed in, and Sign Out. The web's Profile and
//! Security sections (editing the profile, deleting the account) come later.

use gpui::{
    App, ClickEvent, FontWeight, IntoElement, ParentElement, Styled, Window, div,
    prelude::FluentBuilder, px,
};

use crate::{
    api::types::User,
    kit::ui::{Button, Type},
    theme::Tokens,
};

type OnClick = Box<dyn Fn(&ClickEvent, &mut Window, &mut App) + 'static>;

pub fn account(user: Option<&User>, t: &Tokens, sign_out: OnClick) -> impl IntoElement {
    let t = *t;
    let Some(user) = user else {
        return div()
            .chrome()
            .type_body()
            .text_color(t.text_secondary)
            .child("You’re signed out.")
            .into_any_element();
    };
    let name = if user.display_name.trim().is_empty() {
        user.email.clone()
    } else {
        user.display_name.clone()
    };
    div()
        .flex()
        .flex_col()
        .items_center()
        .gap(px(14.))
        .pt(px(16.))
        .child(avatar(&user.initials(), &t))
        .child(
            div()
                .flex()
                .flex_col()
                .items_center()
                .gap(px(2.))
                .child(
                    div()
                        .chrome()
                        .type_title()
                        .font_weight(FontWeight::BOLD)
                        .text_color(t.text_primary)
                        .child(name.clone()),
                )
                .when(name != user.email, |el| {
                    el.child(div().chrome().type_body().text_color(t.text_secondary).child(user.email.clone()))
                }),
        )
        .child(
            div().mt(px(8.)).child(
                Button::new("sign-out")
                    .label("Sign Out…")
                    .secondary()
                    .on_click(move |event, window, cx| sign_out(event, window, cx)),
            ),
        )
        .into_any_element()
}

/// A round avatar with initials, in the accent colours.
fn avatar(initials: &str, t: &Tokens) -> impl IntoElement {
    div()
        .size(px(64.))
        .flex()
        .items_center()
        .justify_center()
        .rounded_full()
        .bg(t.accent)
        .text_color(t.accent_foreground)
        .chrome()
        .text_size(px(24.))
        .font_weight(FontWeight::MEDIUM)
        .child(initials.to_string())
}
