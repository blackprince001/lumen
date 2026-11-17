// Adapted from learning-app desktop @ bbf6eb8 (src/ui/button.rs): macOS sizes (13pt label, 6pt radius) and Lumen tokens; extract into desktop-kit after L2.
//! A push button in three weights: primary (accent fill), secondary
//! (outlined) and ghost.

use std::rc::Rc;

use gpui::{
    App, ClickEvent, ElementId, FontWeight, InteractiveElement, IntoElement, ParentElement,
    RenderOnce, SharedString, StatefulInteractiveElement, Styled, Window, div,
    prelude::FluentBuilder, px,
};

use super::{Icon, Type, spinner::Spinner};
use crate::theme::ActivePalette;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum Variant {
    #[default]
    Primary,
    Secondary,
    Ghost,
}

type OnClick = Rc<dyn Fn(&ClickEvent, &mut Window, &mut App)>;

#[derive(IntoElement)]
pub struct Button {
    id: ElementId,
    label: Option<SharedString>,
    icon: Option<SharedString>,
    variant: Variant,
    disabled: bool,
    busy: bool,
    full_width: bool,
    on_click: Option<OnClick>,
}

impl Button {
    pub fn new(id: impl Into<ElementId>) -> Self {
        Self {
            id: id.into(),
            label: None,
            icon: None,
            variant: Variant::default(),
            disabled: false,
            busy: false,
            full_width: false,
            on_click: None,
        }
    }

    pub fn label(mut self, label: impl Into<SharedString>) -> Self {
        self.label = Some(label.into());
        self
    }

    /// An icon asset path, shown before the label.
    pub fn icon(mut self, icon: impl Into<SharedString>) -> Self {
        self.icon = Some(icon.into());
        self
    }

    pub fn variant(mut self, variant: Variant) -> Self {
        self.variant = variant;
        self
    }

    pub fn secondary(self) -> Self {
        self.variant(Variant::Secondary)
    }

    pub fn disabled(mut self, disabled: bool) -> Self {
        self.disabled = disabled;
        self
    }

    /// Show a spinner in place of the leading icon and ignore clicks. The
    /// caller owns this state.
    pub fn busy(mut self, busy: bool) -> Self {
        self.busy = busy;
        self
    }

    pub fn full_width(mut self) -> Self {
        self.full_width = true;
        self
    }

    pub fn on_click(mut self, f: impl Fn(&ClickEvent, &mut Window, &mut App) + 'static) -> Self {
        self.on_click = Some(Rc::new(f));
        self
    }
}

impl RenderOnce for Button {
    fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
        let t = *cx.palette();
        let focus = window.use_keyed_state(self.id.clone(), cx, |_, cx| cx.focus_handle());
        let focus = focus.read(cx).clone();
        let inert = self.disabled || self.busy;

        let (fg, bg, border) = match self.variant {
            Variant::Primary => (t.accent_foreground, t.accent, t.accent),
            Variant::Secondary => (
                t.text_primary,
                gpui::transparent_black(),
                t.button_secondary_border,
            ),
            Variant::Ghost => (
                t.text_secondary,
                gpui::transparent_black(),
                gpui::transparent_black(),
            ),
        };
        let mut primary_hover = t.accent;
        primary_hover.a = 0.88;

        let leading = if self.busy {
            Some(Spinner::new().size(px(14.)).color(fg).into_any_element())
        } else {
            self.icon
                .map(|path| Icon::new(path).size(px(14.)).color(fg).into_any_element())
        };

        div()
            .id(self.id)
            .track_focus(&focus.tab_stop(!inert))
            .role(gpui::Role::Button)
            .when_some(self.label.clone(), |el, label| el.aria_label(label))
            .chrome()
            .flex()
            .flex_none()
            .items_center()
            .justify_center()
            .gap(px(8.))
            .h(px(32.))
            .px(px(14.))
            .when(self.full_width, |el| el.w_full())
            .border_1()
            .border_color(border)
            .rounded(px(6.))
            .bg(bg)
            .text_color(fg)
            .type_body()
            .font_weight(FontWeight::MEDIUM)
            .when(inert, |el| el.opacity(0.5).cursor_not_allowed())
            .when(!inert, |el| {
                el.cursor_pointer().hover(move |style| match self.variant {
                    Variant::Primary => style.bg(primary_hover).border_color(primary_hover),
                    Variant::Secondary => style.bg(t.hover),
                    Variant::Ghost => style.text_color(t.text_primary).bg(t.hover),
                })
            })
            .focus_visible(move |style| style.border_color(t.focus))
            .children(leading)
            .children(self.label)
            .when_some(self.on_click.filter(|_| !inert), |el, on_click| {
                el.on_click(move |event, window, cx| on_click(event, window, cx))
            })
    }
}
