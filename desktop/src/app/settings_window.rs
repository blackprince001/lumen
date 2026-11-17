//! Settings: its own window with a toolbar of icon tabs, as macOS
//! preferences windows have. Only Account is built; the others hold a line
//! of text until their milestones.

use gpui::{
    App, AppContext as _, Bounds, Context, FontWeight, InteractiveElement, IntoElement,
    ParentElement, Render, SharedString, StatefulInteractiveElement, Styled, TitlebarOptions,
    Window, WindowControlArea, WindowOptions, div, point, prelude::FluentBuilder, px, size,
};
use gpui_component::Root;

use super::confirm_sign_out;
use crate::{
    icons::IconName,
    kit::ui::{Icon, Type, hairline},
    screens::account::account,
    state::session::SessionStore,
    theme::{self, ActivePalette},
    windows::{self, WindowKey},
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Tab {
    General,
    AiProviders,
    Appearance,
    Account,
}

impl Tab {
    const ALL: [Tab; 4] = [Tab::General, Tab::AiProviders, Tab::Appearance, Tab::Account];

    fn label(self) -> &'static str {
        match self {
            Tab::General => "General",
            Tab::AiProviders => "AI Providers",
            Tab::Appearance => "Appearance",
            Tab::Account => "Account",
        }
    }

    fn icon(self) -> IconName {
        match self {
            Tab::General => IconName::Settings,
            Tab::AiProviders => IconName::Chip,
            Tab::Appearance => IconName::Palette,
            Tab::Account => IconName::User,
        }
    }

    fn placeholder(self) -> &'static str {
        match self {
            Tab::General => "General settings are coming to Lumen for Mac.",
            Tab::AiProviders => "AI provider settings are coming to Lumen for Mac. Manage them in the web app for now.",
            Tab::Appearance => "Lumen follows the system appearance. More options are coming.",
            Tab::Account => "",
        }
    }
}

/// ⌘, : open Settings, or bring it forward.
pub fn open_or_focus(cx: &mut App) {
    if windows::focus(WindowKey::Settings, cx) {
        return;
    }
    let bounds = Bounds::centered(None, size(px(720.), px(520.)), cx);
    let opened = cx.open_window(
        WindowOptions {
            window_bounds: Some(gpui::WindowBounds::Windowed(bounds)),
            titlebar: Some(TitlebarOptions {
                title: Some("Settings".into()),
                appears_transparent: true,
                traffic_light_position: Some(point(px(20.), px(14.))),
            }),
            is_resizable: false,
            is_minimizable: false,
            ..Default::default()
        },
        |window, cx| {
            theme::init(window, cx);
            let view = cx.new(SettingsWindow::new);
            cx.new(|cx| Root::new(view, window, cx))
        },
    );
    match opened {
        Ok(handle) => windows::register(WindowKey::Settings, handle.into(), cx),
        Err(err) => log::error!("couldn’t open Settings: {err}"),
    }
}

struct SettingsWindow {
    tab: Tab,
}

impl SettingsWindow {
    fn new(cx: &mut Context<Self>) -> Self {
        let session = SessionStore::global(cx);
        cx.observe(&session, |_, _, cx| cx.notify()).detach();
        cx.on_release(|_, cx| windows::forget(WindowKey::Settings, cx)).detach();
        Self { tab: Tab::Account }
    }
}

impl Render for SettingsWindow {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let t = *cx.palette();
        window.set_window_title(self.tab.label());
        let user = SessionStore::global(cx).read(cx).user().cloned();

        let tabs = Tab::ALL.into_iter().map(|tab| {
            let selected = tab == self.tab;
            div()
                .id(SharedString::from(tab.label()))
                .role(gpui::Role::Tab)
                .aria_label(tab.label())
                .w(px(84.))
                .h(px(48.))
                .flex()
                .flex_col()
                .items_center()
                .justify_center()
                .gap(px(2.))
                .rounded(px(7.))
                .cursor_pointer()
                .text_color(if selected { t.text_primary } else { t.text_secondary })
                .when(selected, |el| {
                    let mut fill = t.text_primary;
                    fill.a = 0.08;
                    el.bg(fill)
                })
                .child(
                    Icon::new(tab.icon().large())
                        .size(px(22.))
                        .color(if selected { t.text_primary } else { t.text_secondary }),
                )
                .child(
                    div()
                        .type_small()
                        .font_weight(if selected { FontWeight::MEDIUM } else { FontWeight::NORMAL })
                        .child(tab.label()),
                )
                .on_click(cx.listener(move |this, _, _, cx| {
                    this.tab = tab;
                    cx.notify();
                }))
        });

        let body = match self.tab {
            Tab::Account => account(
                user.as_ref(),
                &t,
                Box::new(|_, window, cx| confirm_sign_out(window, cx)),
            )
            .into_any_element(),
            other => div()
                .chrome()
                .type_body()
                .text_color(t.text_secondary)
                .child(other.placeholder())
                .into_any_element(),
        };

        div()
            .size_full()
            .flex()
            .flex_col()
            .chrome()
            .type_body()
            .bg(t.settings_bg)
            .text_color(t.text_primary)
            .child(
                div()
                    .id("settings-header")
                    .window_control_area(WindowControlArea::Drag)
                    .flex_none()
                    .pt(px(10.))
                    .pb(px(8.))
                    .flex()
                    .flex_col()
                    .items_center()
                    .gap(px(6.))
                    .bg(t.settings_header)
                    .relative()
                    .child(hairline::bottom(t.hairline))
                    .child(div().type_body().font_weight(FontWeight::BOLD).child(self.tab.label()))
                    .child(div().flex().gap(px(4.)).children(tabs)),
            )
            .child(div().flex_1().px(px(28.)).py(px(20.)).child(body))
    }
}
