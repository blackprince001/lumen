//! A paper card, as on the NativeLibrary board and the web `PaperCard`: a
//! header row (status badge, year) over an inset area with the cover on the
//! left and title, authors, summary and tags on the right. Colours come from
//! the paper's theme, which the web picks from its id.

use gpui::{
    App, FontWeight, InteractiveElement, IntoElement, ParentElement, RenderOnce, Styled, Window,
    StatefulInteractiveElement as _, div, prelude::FluentBuilder, px,
};

use crate::{
    api::types::Paper,
    kit::ui::Type,
    theme::{ActivePalette, paper_theme},
};

const COVER_W: f32 = 64.;
const COVER_H: f32 = 82.8;

#[derive(IntoElement)]
pub struct PaperCard {
    paper: Paper,
}

impl PaperCard {
    pub fn new(paper: Paper) -> Self {
        Self { paper }
    }
}

struct Badge {
    label: &'static str,
    fg: gpui::Hsla,
    bg: gpui::Hsla,
}

fn badge(paper: &Paper, cx: &App) -> Option<Badge> {
    let t = cx.palette();
    let tint = |c: gpui::Hsla, a: f32| {
        let mut c = c;
        c.a = a;
        c
    };
    if let Some(status) = paper.processing_status.as_deref()
        && status != "completed"
    {
        let label = if status == "failed" { "Failed" } else { "Processing" };
        let fg = if status == "failed" { t.danger } else { t.status_neutral };
        return Some(Badge { label, fg, bg: tint(fg, 0.12) });
    }
    match paper.reading_status.as_deref()? {
        "in_progress" => Some(Badge { label: "In Progress", fg: t.status_blue, bg: tint(t.status_blue, 0.14) }),
        "read" => Some(Badge { label: "Read", fg: t.status_green, bg: tint(t.status_green, 0.12) }),
        "not_started" => Some(Badge { label: "Not Started", fg: t.status_neutral, bg: tint(t.status_neutral, 0.12) }),
        "archived" => Some(Badge { label: "Archived", fg: t.status_neutral, bg: tint(t.status_neutral, 0.12) }),
        _ => None,
    }
}

impl RenderOnce for PaperCard {
    fn render(self, _: &mut Window, cx: &mut App) -> impl IntoElement {
        let dark = cx.is_dark();
        let theme = paper_theme(self.paper.id, dark);
        let badge = badge(&self.paper, cx);
        let t = *cx.palette();
        let year = self.paper.year();
        let authors = self.paper.authors();
        let summary = self.paper.summary_preview();
        let dim = |c: gpui::Hsla, a: f32| {
            let mut c = c;
            c.a = a;
            c
        };

        div()
            .id(("paper", self.paper.id as usize))
            .role(gpui::Role::Button)
            .aria_label(self.paper.title.clone())
            .flex()
            .flex_col()
            .min_w_0()
            .rounded(px(10.))
            .overflow_hidden()
            .bg(theme.bg)
            .border_1()
            .border_color(theme.border)
            .child(
                div()
                    .flex()
                    .items_center()
                    .justify_between()
                    .px(px(12.))
                    .pt(px(10.))
                    .pb(px(8.))
                    .child(match badge {
                        Some(b) => div()
                            .h(px(18.))
                            .flex()
                            .items_center()
                            .px(px(7.))
                            .rounded(px(9.))
                            .bg(b.bg)
                            .text_color(b.fg)
                            .chrome()
                            .type_small()
                            .font_weight(FontWeight::MEDIUM)
                            .child(b.label)
                            .into_any_element(),
                        None => div().into_any_element(),
                    })
                    .children(year.map(|year| {
                        div()
                            .chrome()
                            .type_small()
                            .font_weight(FontWeight::SEMIBOLD)
                            .text_color(dim(theme.text, 0.65))
                            .child(year)
                    })),
            )
            .child(
                div()
                    .flex_1()
                    .flex()
                    .gap(px(12.))
                    .p(px(12.))
                    .border_t_1()
                    .border_color(theme.border)
                    .rounded_t(px(9.))
                    .bg(theme.accent)
                    .child(cover(theme.border, dark, &t))
                    .child(
                        div()
                            .min_w_0()
                            .flex_1()
                            .flex()
                            .flex_col()
                            .content()
                            .text_color(theme.text)
                            .child(
                                div()
                                    .mb(px(3.))
                                    .type_card()
                                    .font_weight(FontWeight::SEMIBOLD)
                                    .line_clamp(2)
                                    .child(self.paper.title.clone()),
                            )
                            .children(authors.map(|authors| {
                                div()
                                    .mb(px(6.))
                                    .chrome()
                                    .type_small()
                                    .truncate()
                                    .text_color(dim(theme.text, 0.75))
                                    .child(authors)
                            }))
                            .children(summary.map(|summary| {
                                div()
                                    .mb(px(8.))
                                    .type_caption()
                                    .line_height(px(17.))
                                    .line_clamp(2)
                                    .text_color(dim(theme.text, 0.85))
                                    .child(summary)
                            }))
                            .when(!self.paper.tags.is_empty(), |el| {
                                el.child(
                                    div().mt_auto().flex().flex_wrap().gap(px(4.)).children(
                                        self.paper.tags.iter().take(4).map(|tag| {
                                            div()
                                                .px(px(6.))
                                                .py(px(1.))
                                                .rounded(px(4.))
                                                .bg(theme.bg)
                                                .chrome()
                                                .type_small()
                                                .font_weight(FontWeight::SEMIBOLD)
                                                .text_color(theme.text)
                                                .child(tag.name.clone())
                                        }),
                                    ),
                                )
                            }),
                    ),
            )
    }
}

/// A paper-shaped placeholder: title bars, then lines of text. The real
/// first-page thumbnail arrives with the paper window.
fn cover(border: gpui::Hsla, dark: bool, t: &crate::theme::Tokens) -> impl IntoElement {
    let ink = |a: f32| {
        let mut c = if dark { gpui::white() } else { gpui::black() };
        c.a = a;
        c
    };
    let bar = |w: f32, h: f32, top: f32, a: f32| {
        div()
            .h(px(h))
            .w(gpui::relative(w))
            .mt(px(top))
            .mx_auto()
            .rounded(px(1.))
            .bg(ink(a))
    };
    let page = if dark { t.surface_raised } else { gpui::white() };
    div()
        .w(px(COVER_W))
        .h(px(COVER_H))
        .flex_none()
        .self_start()
        .flex()
        .flex_col()
        .pt(px(8.))
        .rounded(px(8.8))
        .overflow_hidden()
        .border_1()
        .border_color(border)
        .bg(page)
        .child(bar(0.78, 3., 0., 0.55))
        .child(bar(0.60, 3., 3., 0.55))
        .child(bar(0.50, 2., 6., 0.25))
        .children([
            bar(0.80, 2., 7., 0.1),
            bar(0.80, 2., 3., 0.1),
            bar(0.80, 2., 3., 0.1),
            bar(0.80, 2., 3., 0.1),
            bar(0.80, 2., 3., 0.1),
            bar(0.80, 2., 6., 0.1),
            bar(0.80, 2., 3., 0.1),
            bar(0.64, 2., 3., 0.1),
        ])
}
