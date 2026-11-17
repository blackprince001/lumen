//! Home: a greeting over the newest papers. The web's Home also has a search
//! box that routes a question; that comes with ⌘K in a later milestone.

use gpui::{
    Context, Entity, FontWeight, InteractiveElement, IntoElement, ParentElement, Render, Styled,
    StatefulInteractiveElement as _, Subscription, Window, div, prelude::FluentBuilder, px,
};

use crate::{
    api::{queries, types::PaperList},
    kit::{
        state::{query::Resource, remote::Remote},
        ui::{Button, Type},
    },
    state::session::SessionStore,
    theme::ActivePalette,
    views::paper_card::PaperCard,
};

/// Width of the window left of the content: the sidebar.
const CARD_MIN_WIDTH: f32 = 380.;
const SKELETONS: usize = 6;

pub struct HomeView {
    recent: Entity<Resource<PaperList>>,
    _subscriptions: Vec<Subscription>,
}

impl HomeView {
    pub fn new(cx: &mut Context<Self>) -> Self {
        let recent = queries::recent_papers(cx);
        let session = SessionStore::global(cx);
        Self {
            _subscriptions: vec![
                cx.observe(&recent, |_, _, cx| cx.notify()),
                cx.observe(&session, |_, _, cx| cx.notify()),
            ],
            recent,
        }
    }

    /// "12 papers", for the toolbar's subtitle.
    pub fn subtitle(&self, cx: &gpui::App) -> Option<String> {
        let total = self.recent.read(cx).value()?.total;
        Some(match total {
            1 => "1 paper".to_string(),
            n => format!("{n} papers"),
        })
    }
}

/// "Good morning", by the hour of the day.
fn greeting(hour: i8) -> &'static str {
    match hour {
        5..=11 => "Good morning",
        12..=17 => "Good afternoon",
        _ => "Good evening",
    }
}

impl Render for HomeView {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let t = *cx.palette();
        let name = SessionStore::global(cx)
            .read(cx)
            .user()
            .map(|u| u.first_name());
        let hello = match name {
            Some(name) => format!("{}, {name}", greeting(jiff::Zoned::now().hour())),
            None => greeting(jiff::Zoned::now().hour()).to_string(),
        };

        // Columns by the room there is: the window less the 240pt sidebar and padding.
        let room = f32::from(window.viewport_size().width) - 240. - 56.;
        let columns = ((room + 16.) / (CARD_MIN_WIDTH + 16.)).floor().clamp(1., 3.) as u16;

        let state = &self.recent.read(cx).state;
        let body = match state {
            Remote::Loading => grid(columns, (0..SKELETONS).map(|i| skeleton(i, &t).into_any_element())),
            Remote::Failed { error, stale: None } => message(
                "Couldn’t load your papers",
                error.to_string(),
                Some(
                    Button::new("retry-recent")
                        .label("Try again")
                        .secondary()
                        .on_click(cx.listener(|this, _, _, cx| {
                            this.recent.update(cx, |r, cx| r.refetch(cx));
                        })),
                ),
                &t,
            )
            .into_any_element(),
            other => match other.value() {
                Some(list) if !list.papers.is_empty() => grid(
                    columns,
                    list.papers.iter().map(|p| PaperCard::new(p.clone()).into_any_element()),
                ),
                _ => message(
                    "Your library is empty",
                    "Add your first paper to start building your research collection.".into(),
                    None,
                    &t,
                )
                .into_any_element(),
            },
        };

        div()
            .id("home")
            .size_full()
            .overflow_y_scroll()
            .bg(t.window_bg)
            .child(
                div()
                    .flex()
                    .flex_col()
                    .gap(px(24.))
                    .px(px(28.))
                    .pt(px(32.))
                    .pb(px(28.))
                    .child(
                        div()
                            .content()
                            .type_display()
                            .font_weight(FontWeight::BOLD)
                            .text_color(t.text_primary)
                            .child(hello),
                    )
                    .child(
                        div()
                            .flex()
                            .flex_col()
                            .gap(px(14.))
                            .child(
                                div()
                                    .chrome()
                                    .type_body()
                                    .font_weight(FontWeight::SEMIBOLD)
                                    .text_color(t.text_primary)
                                    .child("Recent Papers"),
                            )
                            .child(body),
                    ),
            )
    }
}

fn grid(columns: u16, cards: impl IntoIterator<Item = gpui::AnyElement>) -> gpui::AnyElement {
    div()
        .grid()
        .grid_cols(columns)
        .gap(px(16.))
        .children(cards)
        .into_any_element()
}

/// A card-shaped placeholder while the first fetch is in flight.
fn skeleton(i: usize, t: &crate::theme::Tokens) -> impl IntoElement {
    let bar = |w: f32, h: f32| div().h(px(h)).w(gpui::relative(w)).rounded(px(3.)).bg(t.field_bg);
    div()
        .id(("skeleton", i))
        .h(px(150.))
        .rounded(px(10.))
        .border_1()
        .border_color(t.card_border)
        .p(px(12.))
        .flex()
        .gap(px(12.))
        .child(div().w(px(64.)).h(px(83.)).flex_none().rounded(px(8.)).bg(t.field_bg))
        .child(
            div()
                .flex_1()
                .flex()
                .flex_col()
                .gap(px(8.))
                .child(bar(0.9, 12.))
                .child(bar(0.6, 12.))
                .child(bar(0.4, 9.))
                .child(bar(0.8, 9.)),
        )
}

/// The empty and failed states: a title, a line of text and an optional button.
fn message(
    title: &'static str,
    detail: String,
    action: Option<Button>,
    t: &crate::theme::Tokens,
) -> impl IntoElement {
    div()
        .py(px(64.))
        .flex()
        .flex_col()
        .items_center()
        .gap(px(6.))
        .child(
            div()
                .chrome()
                .type_title()
                .font_weight(FontWeight::SEMIBOLD)
                .text_color(t.text_primary)
                .child(title),
        )
        .child(div().chrome().type_body().text_color(t.text_secondary).child(detail))
        .when_some(action, |el, action| el.child(div().mt(px(10.)).child(action)))
}

#[cfg(test)]
mod tests {
    use super::greeting;

    #[test]
    fn greets_by_the_hour() {
        assert_eq!(greeting(5), "Good morning");
        assert_eq!(greeting(11), "Good morning");
        assert_eq!(greeting(12), "Good afternoon");
        assert_eq!(greeting(17), "Good afternoon");
        assert_eq!(greeting(18), "Good evening");
        assert_eq!(greeting(2), "Good evening");
    }
}
