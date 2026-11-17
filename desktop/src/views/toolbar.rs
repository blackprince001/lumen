//! The unified toolbar: 52pt, the page title and subtitle on the left, then
//! the search field, Add Paper and the inspector toggle (NativeLibrary).

use gpui::{
    App, ClickEvent, Entity, FontWeight, InteractiveElement, IntoElement, MouseButton,
    ParentElement, SharedString, StatefulInteractiveElement, Styled, Window, WindowControlArea,
    div, prelude::FluentBuilder, px,
};
use gpui_component::{
    Sizable as _,
    input::{Input, InputState},
};

use crate::{
    icons::IconName,
    kit::ui::{Icon, Type, hairline},
    theme::Tokens,
};

pub struct Toolbar {
    pub title: SharedString,
    pub subtitle: Option<SharedString>,
    pub search: Entity<InputState>,
    pub search_focused: bool,
    /// When the sidebar is hidden the traffic lights sit over the toolbar,
    /// so it makes room and offers the button that brings the sidebar back.
    pub sidebar_hidden: bool,
}

type OnClick = Box<dyn Fn(&ClickEvent, &mut Window, &mut App) + 'static>;

impl Toolbar {
    pub fn render(self, t: &Tokens, show_sidebar: OnClick, add_paper: OnClick) -> impl IntoElement {
        let t = *t;
        div()
            .id("toolbar")
            .window_control_area(WindowControlArea::Drag)
            .flex_none()
            .h(px(52.))
            .flex()
            .items_center()
            .gap(px(8.))
            .pl(px(if self.sidebar_hidden { 76. } else { 20. }))
            .pr(px(12.))
            .bg(t.window_bg)
            .relative()
            .chrome()
            .when(self.sidebar_hidden, |el| {
                el.child(
                    icon_button("show-sidebar", IconName::PanelLeft, "Show sidebar", true, &t)
                        .on_click(move |event, window, cx| show_sidebar(event, window, cx)),
                )
            })
            .child(hairline::bottom(t.hairline))
            .child(
                div()
                    .min_w_0()
                    .flex_1()
                    .flex()
                    .flex_col()
                    .justify_center()
                    .child(
                        div()
                            .truncate()
                            .type_title()
                            .line_height(px(18.))
                            .font_weight(FontWeight::BOLD)
                            .text_color(t.text_primary)
                            .child(self.title),
                    )
                    .children(self.subtitle.map(|subtitle| {
                        div().truncate().type_small().text_color(t.text_secondary).child(subtitle)
                    })),
            )
            .child(
                div()
                    .flex()
                    .items_center()
                    .gap(px(6.))
                    .flex_none()
                    .child(
                        div()
                            .id("search")
                            .w(px(200.))
                            .h(px(28.))
                            .flex_none()
                            .flex()
                            .items_center()
                            .gap(px(5.))
                            .pl(px(8.))
                            .pr(px(4.))
                            .rounded(px(7.))
                            .bg(t.field_bg)
                            .border_1()
                            .border_color(if self.search_focused { t.focus } else { t.field_ring })
                            .text_color(t.text_secondary)
                            // The input focuses itself on mouse down; keep the
                            // toolbar from taking the focus back.
                            .on_mouse_down(MouseButton::Left, |_, window, _| window.prevent_default())
                            .child(Icon::new(IconName::Search).size(px(14.)).color(t.text_secondary))
                            .child(
                                div()
                                    .flex_1()
                                    .min_w_0()
                                    .type_body()
                                    .text_color(t.text_primary)
                                    .child(Input::new(&self.search).appearance(false).small()),
                            ),
                    )
                    .child(
                        icon_button("add-paper", IconName::Plus, "Add paper", true, &t)
                            .on_click(move |event, window, cx| add_paper(event, window, cx)),
                    )
                    // The inspector belongs to paper windows; the library has none.
                    .child(icon_button("inspector", IconName::PanelRight, "Show inspector", false, &t)),
            )
    }
}

/// A 30×28 toolbar button with a 17pt icon.
fn icon_button(
    id: &'static str,
    icon: IconName,
    label: &'static str,
    enabled: bool,
    t: &Tokens,
) -> gpui::Stateful<gpui::Div> {
    let hover = t.hover;
    div()
        .id(id)
        .role(gpui::Role::Button)
        .aria_label(label)
        .w(px(30.))
        .h(px(28.))
        .flex_none()
        .flex()
        .items_center()
        .justify_center()
        .rounded(px(6.))
        .child(Icon::new(icon).size(px(17.)).color(t.text_secondary))
        .when(enabled, |el| el.cursor_pointer().hover(move |s| s.bg(hover)))
        .when(!enabled, |el| el.opacity(0.4))
}
