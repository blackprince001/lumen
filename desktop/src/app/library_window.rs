//! The library window: sidebar, unified toolbar and the page for the current
//! route. It also holds the sign-in, checking and can't-reach screens, so a
//! signed-out window is the same window with a different body.

use gpui::{
    AnyElement, App, AppContext as _, Bounds, Context, Entity, FocusHandle, Focusable,
    FontWeight, InteractiveElement, IntoElement, ParentElement, Render, SharedString, Styled,
    Subscription, TitlebarOptions, Window,
    WindowBackgroundAppearance, WindowBounds, WindowOptions, div, point, prelude::FluentBuilder, px,
    size,
};
use gpui_component::{
    Root,
    input::{InputEvent, InputState},
};

use super::{
    actions::{SearchLibrary, ToggleSidebar},
    menus::{self, MenuState},
    navigator::Navigator,
    route::Route,
};
use crate::{
    api::queries,
    kit::{
        state::{prefs::Prefs, query},
        ui::{Button, Type},
    },
    screens::{auth::AuthView, home::HomeView, placeholder::placeholder},
    state::session::{Session, SessionStore},
    theme::{self, ActivePalette},
    views::{
        sidebar::{Sidebar, SidebarEvent},
        toolbar::Toolbar,
    },
    windows::{self, WindowKey},
};

const BOUNDS_KEY: &str = "library-window-bounds";
const MIN_SIZE: (f32, f32) = (900., 600.);

/// Open a library window and return its handle.
pub fn open(cx: &mut App) -> Option<gpui::AnyWindowHandle> {
    let key = windows::next_library_key(cx);
    let first = key == WindowKey::Library(1);
    let bounds = match Prefs::get::<[f32; 4]>(cx, BOUNDS_KEY) {
        // Reopen where the last window was; later windows step down and right.
        Some([x, y, w, h]) if w >= MIN_SIZE.0 && h >= MIN_SIZE.1 => {
            let offset = if first { 0. } else { 28. * windows_open(cx) as f32 };
            Bounds::new(point(px(x + offset), px(y + offset)), size(px(w), px(h)))
        }
        _ => default_bounds(cx),
    };
    let opened = cx.open_window(
        WindowOptions {
            window_bounds: Some(WindowBounds::Windowed(bounds)),
            window_min_size: Some(size(px(MIN_SIZE.0), px(MIN_SIZE.1))),
            titlebar: Some(TitlebarOptions {
                title: Some("Lumen".into()),
                appears_transparent: true,
                // Over the sidebar, where the board draws them.
                traffic_light_position: Some(point(px(20.), px(20.))),
            }),
            // The sidebar has no fill of its own and shows this through;
            // everything else paints an opaque background.
            window_background: WindowBackgroundAppearance::Blurred,
            ..Default::default()
        },
        |window, cx| {
            theme::init(window, cx);
            let view = cx.new(|cx| LibraryWindow::new(key, window, cx));
            cx.new(|cx| Root::new(view, window, cx))
        },
    );
    match opened {
        Ok(handle) => {
            let handle: gpui::AnyWindowHandle = handle.into();
            windows::register(key, handle, cx);
            Some(handle)
        }
        Err(err) => {
            log::error!("couldn’t open a library window: {err}");
            None
        }
    }
}

fn windows_open(cx: &App) -> usize {
    cx.windows().len().saturating_sub(1)
}

/// 1440×960, shrunk to 90% of a smaller screen.
fn default_bounds(cx: &App) -> Bounds<gpui::Pixels> {
    let screen = cx.primary_display().map(|d| d.bounds().size);
    let fit = |want: f32, have: Option<gpui::Pixels>| have.map_or(want, |h| want.min(f32::from(h) * 0.9));
    let want = size(
        px(fit(1440., screen.map(|s| s.width))),
        px(fit(960., screen.map(|s| s.height))),
    );
    Bounds::centered(None, want, cx)
}

pub struct LibraryWindow {
    session: Entity<SessionStore>,
    nav: Entity<Navigator>,
    focus: FocusHandle,
    search: Entity<InputState>,
    sidebar_visible: bool,
    shell: Option<Shell>,
    auth: Option<Entity<AuthView>>,
    title: SharedString,
    _subscriptions: Vec<Subscription>,
}

/// What exists only while someone is signed in.
struct Shell {
    sidebar: Entity<Sidebar>,
    home: Entity<HomeView>,
    _sidebar_events: Subscription,
}

impl LibraryWindow {
    fn new(key: WindowKey, window: &mut Window, cx: &mut Context<Self>) -> Self {
        let session = SessionStore::global(cx);
        let nav = cx.new(|_| Navigator::new());
        let focus = cx.focus_handle();
        window.focus(&focus, cx);
        let search = cx.new(|cx| InputState::new(window, cx).placeholder("Search"));

        let groups = queries::groups(cx);
        let subscriptions = vec![
            cx.observe(&session, |_, _, cx| cx.notify()),
            cx.observe(&nav, |_, _, cx| cx.notify()),
            // The Folders row names a folder once the groups load.
            cx.observe(&groups, |_, _, cx| cx.notify()),
            cx.subscribe(&search, |_, _, _: &InputEvent, cx| cx.notify()),
            cx.observe_window_activation(window, |this, window, cx| {
                if window.is_window_active() {
                    menus::install(MenuState { sidebar_visible: this.sidebar_visible }, cx);
                }
            }),
            cx.observe_window_bounds(window, |_, window, cx| {
                // Only a plain window's size is worth reopening at.
                if let WindowBounds::Windowed(b) = window.window_bounds() {
                    let b = [
                        f32::from(b.origin.x),
                        f32::from(b.origin.y),
                        f32::from(b.size.width),
                        f32::from(b.size.height),
                    ];
                    Prefs::set(cx, BOUNDS_KEY, &b);
                }
            }),
            cx.on_release(move |_, cx| windows::forget(key, cx)),
        ];
        menus::install(MenuState::default(), cx);
        Self {
            session,
            nav,
            focus,
            search,
            sidebar_visible: true,
            shell: None,
            auth: None,
            title: "Lumen".into(),
            _subscriptions: subscriptions,
        }
    }

    fn set_sidebar_visible(&mut self, visible: bool, cx: &mut Context<Self>) {
        self.sidebar_visible = visible;
        menus::install(MenuState { sidebar_visible: visible }, cx);
        cx.notify();
    }

    fn focus_search(&mut self, window: &mut Window, cx: &mut Context<Self>) {
        self.search.update(cx, |s, cx| s.focus(window, cx));
    }

    /// The signed-in frame, built on first use.
    fn shell(&mut self, window: &mut Window, cx: &mut Context<Self>) -> (Entity<Sidebar>, Entity<HomeView>) {
        if self.shell.is_none() {
            let sidebar = cx.new(|cx| Sidebar::new(self.nav.clone(), cx));
            let events = cx.subscribe_in(&sidebar, window, |this, _, event: &SidebarEvent, _, cx| match event {
                SidebarEvent::Hide => this.set_sidebar_visible(false, cx),
            });
            let home = cx.new(HomeView::new);
            self.shell = Some(Shell { sidebar, home, _sidebar_events: events });
        }
        let shell = self.shell.as_ref().expect("built above");
        (shell.sidebar.clone(), shell.home.clone())
    }

    /// Everything tied to the last user goes, so the next person to sign in
    /// starts clean.
    fn tear_down(&mut self, cx: &mut Context<Self>) {
        if self.shell.take().is_some() {
            query::clear(cx);
            self.nav.update(cx, |nav, cx| nav.go(Route::Home, cx));
            windows::close_where(WindowKey::closes_on_sign_out, cx);
        }
    }

    /// The toolbar's title and subtitle for the route on show.
    fn heading(&self, route: Route, home: &Entity<HomeView>, cx: &mut Context<Self>) -> (SharedString, Option<SharedString>) {
        match route {
            Route::Home => (
                "Home".into(),
                home.read(cx).subtitle(cx).map(SharedString::from),
            ),
            Route::Folder(id) => {
                let name = queries::groups(cx)
                    .read(cx)
                    .value()
                    .and_then(|groups| groups.iter().find(|g| g.id == id))
                    .map(|g| g.name.clone())
                    .unwrap_or_else(|| "Folder".into());
                (name.into(), Some("Folder".into()))
            }
            other => (other.title().into(), None),
        }
    }
}

impl Focusable for LibraryWindow {
    fn focus_handle(&self, _: &App) -> FocusHandle {
        self.focus.clone()
    }
}

impl Render for LibraryWindow {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let t = *cx.palette();
        let state = self.session.read(cx).state.clone();

        let body: AnyElement = match state {
            Session::Checking => gate(&t).into_any_element(),
            Session::SignedOut => {
                self.tear_down(cx);
                let auth = self
                    .auth
                    .get_or_insert_with(|| cx.new(|cx| AuthView::new(window, cx)))
                    .clone();
                auth.into_any_element()
            }
            Session::Unreachable(err) => unreachable_screen(err.to_string(), cx).into_any_element(),
            Session::SignedIn(_) => {
                self.auth = None;
                self.signed_in(window, cx)
            }
        };

        div()
            .id("library-window")
            .key_context("LibraryWindow")
            .track_focus(&self.focus)
            .size_full()
            .chrome()
            .type_body()
            .text_color(t.text_primary)
            .on_action(cx.listener(|this, _: &ToggleSidebar, _, cx| {
                let visible = !this.sidebar_visible;
                this.set_sidebar_visible(visible, cx);
            }))
            .on_action(cx.listener(|this, _: &SearchLibrary, window, cx| {
                if !matches!(this.session.read(cx).state, Session::SignedIn(_)) {
                    return;
                }
                this.focus_search(window, cx);
            }))
            .child(body)
    }
}

impl LibraryWindow {
    fn signed_in(&mut self, window: &mut Window, cx: &mut Context<Self>) -> AnyElement {
        let t = *cx.palette();
        let (sidebar, home) = self.shell(window, cx);
        let route = self.nav.read(cx).route;
        let (title, subtitle) = self.heading(route, &home, cx);
        if self.title != title {
            window.set_window_title(&title);
            self.title = title.clone();
        }

        let page: AnyElement = match route {
            Route::Home => home.into_any_element(),
            Route::Folder(_) => placeholder(&title, route.icon(), &t).into_any_element(),
            other => placeholder(other.title(), other.icon(), &t).into_any_element(),
        };
        let search_focused = self.search.read(cx).focus_handle(cx).is_focused(window);

        let toolbar = Toolbar {
            title,
            subtitle,
            search: self.search.clone(),
            search_focused,
            sidebar_hidden: !self.sidebar_visible,
        }
        .render(
            &t,
            Box::new(cx.listener(|this, _, _, cx| this.set_sidebar_visible(true, cx))),
            // Add Paper opens its sheet in a later milestone.
            Box::new(|_, _, _| {}),
        );

        div()
            .size_full()
            .flex()
            .when(self.sidebar_visible, |el| el.child(sidebar))
            .child(
                // Opaque, so only the sidebar shows the blurred desktop.
                div()
                    .flex_1()
                    .min_w_0()
                    .h_full()
                    .flex()
                    .flex_col()
                    .bg(t.window_bg)
                    .child(toolbar)
                    .child(div().flex_1().min_h_0().child(page)),
            )
            .into_any_element()
    }
}

/// While the first `/auth/refresh` is out: a small spinner on an opaque window.
fn gate(t: &theme::Tokens) -> impl IntoElement {
    div()
        .size_full()
        .bg(t.window_bg)
        .flex()
        .items_center()
        .justify_center()
        .child(crate::kit::ui::Spinner::new().size(px(20.)))
}

/// The server didn't answer. The web app shows its sign-in page here; we say
/// what happened and offer a retry instead.
fn unreachable_screen(message: String, cx: &mut Context<LibraryWindow>) -> impl IntoElement {
    let t = *cx.palette();
    div()
        .size_full()
        .bg(t.window_bg)
        .flex()
        .items_center()
        .justify_center()
        .child(
            div()
                .w(px(380.))
                .flex()
                .flex_col()
                .items_center()
                .gap(px(10.))
                .child(
                    div()
                        .type_title()
                        .font_weight(FontWeight::BOLD)
                        .text_color(t.text_primary)
                        .child("Can’t reach Lumen"),
                )
                .child(
                    div()
                        .type_body()
                        .text_center()
                        .text_color(t.text_secondary)
                        .child(message),
                )
                .child(div().mt(px(8.)).child(
                    Button::new("retry-session").label("Try again").on_click(cx.listener(
                        |this, _, _, cx| this.session.update(cx, |s, cx| s.check(cx)),
                    )),
                )),
        )
}
