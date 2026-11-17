//! The source list: a full-height column under the traffic lights, tinted
//! over the blurred desktop. Sections are Library, Discover, Tools and the
//! Folders tree. Metrics are from the NativeLibrary board: 28pt rows with a
//! 6pt radius, a 20pt icon well, 11pt bold section headers.

use std::collections::{HashMap, HashSet};

use gpui::{
    App, Context, Entity, EventEmitter, FontWeight, InteractiveElement, IntoElement, ObjectFit,
    ParentElement, Render, SharedString, StatefulInteractiveElement, Styled, StyledImage as _,
    Subscription, Window, WindowControlArea, div, img, prelude::FluentBuilder, px,
};

use crate::{
    api::{
        queries,
        types::{Group, PaperList},
    },
    app::{
        navigator::Navigator,
        route::{Route, SECTIONS},
    },
    icons::IconName,
    kit::{
        state::{query::Resource, remote::Remote},
        ui::{Icon, Type, hairline},
    },
    theme::ActivePalette,
};

/// What the sidebar asks of its window.
pub enum SidebarEvent {
    Hide,
}

impl EventEmitter<SidebarEvent> for Sidebar {}

pub const WIDTH: f32 = 240.;

pub struct Sidebar {
    nav: Entity<Navigator>,
    groups: Entity<Resource<Vec<Group>>>,
    recent: Entity<Resource<PaperList>>,
    expanded: HashSet<i64>,
    folders_open: bool,
    _subscriptions: Vec<Subscription>,
}

impl Sidebar {
    pub fn new(nav: Entity<Navigator>, cx: &mut Context<Self>) -> Self {
        let groups = queries::groups(cx);
        let recent = queries::recent_papers(cx);
        let subscriptions = vec![
            cx.observe(&nav, |_, _, cx| cx.notify()),
            cx.observe(&groups, |_, _, cx| cx.notify()),
            cx.observe(&recent, |_, _, cx| cx.notify()),
        ];
        Self {
            nav,
            groups,
            recent,
            expanded: HashSet::new(),
            folders_open: true,
            _subscriptions: subscriptions,
        }
    }

    /// The footer's line: what the last sync did.
    fn sync_status(&self, cx: &App) -> &'static str {
        let states = [self.groups.read(cx).state.error(), self.recent.read(cx).state.error()];
        let loading = matches!(self.groups.read(cx).state, Remote::Loading)
            || matches!(self.recent.read(cx).state, Remote::Loading);
        if states.iter().any(Option::is_some) {
            "Couldn’t sync"
        } else if loading {
            "Syncing…"
        } else {
            "Synced just now"
        }
    }
}

/// One folder in the flattened tree.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FolderRow {
    pub id: i64,
    pub name: String,
    pub depth: usize,
    pub has_children: bool,
    pub expanded: bool,
}

/// Flatten the groups into the rows to show: roots first, each followed by
/// its children while expanded. A group whose parent isn't visible to this
/// user sits at the top level.
pub fn folder_rows(groups: &[Group], expanded: &HashSet<i64>) -> Vec<FolderRow> {
    let known: HashSet<i64> = groups.iter().map(|g| g.id).collect();
    let mut children: HashMap<i64, Vec<&Group>> = HashMap::new();
    let mut roots: Vec<&Group> = Vec::new();
    for group in groups {
        match group.parent_id.filter(|p| known.contains(p) && *p != group.id) {
            Some(parent) => children.entry(parent).or_default().push(group),
            None => roots.push(group),
        }
    }
    fn walk(
        group: &Group,
        depth: usize,
        children: &HashMap<i64, Vec<&Group>>,
        expanded: &HashSet<i64>,
        seen: &mut HashSet<i64>,
        out: &mut Vec<FolderRow>,
    ) {
        if !seen.insert(group.id) {
            return;
        }
        let kids = children.get(&group.id).map(Vec::as_slice).unwrap_or(&[]);
        let open = expanded.contains(&group.id);
        out.push(FolderRow {
            id: group.id,
            name: group.name.clone(),
            depth,
            has_children: !kids.is_empty(),
            expanded: open,
        });
        if open {
            for kid in kids {
                walk(kid, depth + 1, children, expanded, seen, out);
            }
        }
    }
    let mut out = Vec::new();
    let mut seen = HashSet::new();
    for root in roots {
        walk(root, 0, &children, expanded, &mut seen, &mut out);
    }
    out
}

impl Render for Sidebar {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let t = *cx.palette();
        let route = self.nav.read(cx).route;
        let status = self.sync_status(cx);

        let mut nav = div()
            .id("sidebar-nav")
            .flex_1()
            .min_h_0()
            .flex()
            .flex_col()
            .overflow_y_scroll();

        for (si, section) in SECTIONS.iter().enumerate() {
            nav = nav.child(section_header(section.title, None, t.text_tertiary, t.text_secondary));
            for (i, item) in section.items.iter().enumerate() {
                let item = *item;
                nav = nav.child(
                    Row::new(("nav", si * 100 + i), item.title(), item.icon())
                        .selected(route == item)
                        .render(
                            cx.listener(move |this, _, _, cx| {
                                this.nav.update(cx, |nav, cx| nav.go(item, cx))
                            }),
                            None,
                            &t,
                        ),
                );
            }
        }

        let rows = self
            .groups
            .read(cx)
            .value()
            .map(|groups| folder_rows(groups, &self.expanded))
            .unwrap_or_default();
        let toggle = cx.listener(|this, _, _, cx| {
            this.folders_open = !this.folders_open;
            cx.notify();
        });
        nav = nav.child(section_header(
            "Folders",
            Some((self.folders_open, Box::new(toggle))),
            t.text_tertiary,
            t.text_secondary,
        ));
        if self.folders_open {
            for row in rows {
                let id = row.id;
                let chevron: Option<Handler> = row.has_children.then(|| {
                    Box::new(cx.listener(move |this, _, _, cx| {
                        if !this.expanded.remove(&id) {
                            this.expanded.insert(id);
                        }
                        cx.stop_propagation();
                        cx.notify();
                    })) as Handler
                });
                nav = nav.child(
                    Row::new(("folder", id as usize), row.name.clone(), IconName::Folder)
                        .selected(route == Route::Folder(id))
                        .depth(row.depth)
                        .chevron(row.has_children.then_some(row.expanded))
                        .render(
                            cx.listener(move |this, _, _, cx| {
                                this.nav.update(cx, |nav, cx| nav.go(Route::Folder(id), cx))
                            }),
                            chevron,
                            &t,
                        ),
                );
            }
        }

        div()
            .id("sidebar")
            .relative()
            .flex_none()
            .w(px(WIDTH))
            .h_full()
            .pt(px(52.))
            .flex()
            .flex_col()
            .chrome()
            .type_body()
            // The tint only; the blur is the window's own background.
            .bg(t.sidebar_bg)
            .text_color(t.text_primary)
            .child(hairline::right(t.hairline))
            // Dragging the empty top of the sidebar moves the window.
            .child(
                div()
                    .id("sidebar-drag")
                    .absolute()
                    .top_0()
                    .left_0()
                    .right_0()
                    .h(px(52.))
                    .window_control_area(WindowControlArea::Drag),
            )
            .child(
                div()
                    .id("hide-sidebar")
                    .absolute()
                    .top(px(12.))
                    .right(px(10.))
                    .w(px(30.))
                    .h(px(28.))
                    .flex()
                    .items_center()
                    .justify_center()
                    .rounded(px(6.))
                    .cursor_pointer()
                    .role(gpui::Role::Button)
                    .aria_label("Hide sidebar")
                    .hover(move |s| s.bg(t.hover))
                    .child(Icon::new(IconName::PanelLeft).size(px(17.)).color(t.text_secondary))
                    .on_click(cx.listener(|_, _, _, cx| cx.emit(SidebarEvent::Hide))),
            )
            .child(nav)
            .child(
                div()
                    .flex_none()
                    .flex()
                    .items_center()
                    .gap(px(8.))
                    .px(px(18.))
                    .pt(px(10.))
                    .pb(px(12.))
                    .type_small()
                    .text_color(t.text_secondary)
                    .child(img("app/logo-128.png").size(px(22.)).object_fit(ObjectFit::Contain))
                    .child(div().flex_1().child(status)),
            )
    }
}

type Handler = Box<dyn Fn(&gpui::ClickEvent, &mut Window, &mut App) + 'static>;

/// A section header: 26pt tall, label at the bottom, optional collapse chevron.
fn section_header(
    title: &'static str,
    collapse: Option<(bool, Handler)>,
    color: gpui::Hsla,
    chevron_color: gpui::Hsla,
) -> impl IntoElement {
    let mut header = div()
        .id(title)
        .h(px(26.))
        .flex()
        .items_end()
        .justify_between()
        .mt(px(10.))
        .mx(px(10.))
        .mb(px(2.))
        .px(px(8.))
        .pb(px(4.))
        .type_small()
        .font_weight(FontWeight::BOLD)
        .text_color(color)
        .child(title);
    if let Some((open, handler)) = collapse {
        header = header
            .cursor_pointer()
            .child(
                div().when(!open, |el| el.opacity(0.9)).child(
                    Icon::new(if open { IconName::ChevronDown } else { IconName::Chevron })
                        .size(px(10.))
                        .color(chevron_color),
                ),
            )
            .on_click(move |event, window, cx| handler(event, window, cx));
    }
    header
}

/// One 28pt source-list row.
struct Row {
    id: (&'static str, usize),
    label: SharedString,
    icon: IconName,
    selected: bool,
    depth: usize,
    /// `Some(expanded)` draws a disclosure chevron; `None` leaves its well empty
    /// when the section has any (folders) or omits it (fixed items).
    chevron: Option<bool>,
}

impl Row {
    fn new(id: (&'static str, usize), label: impl Into<SharedString>, icon: IconName) -> Self {
        Self {
            id,
            label: label.into(),
            icon,
            selected: false,
            depth: 0,
            chevron: None,
        }
    }

    fn selected(mut self, selected: bool) -> Self {
        self.selected = selected;
        self
    }

    fn depth(mut self, depth: usize) -> Self {
        self.depth = depth;
        self
    }

    fn chevron(mut self, chevron: Option<bool>) -> Self {
        self.chevron = chevron;
        self
    }

    fn render(
        self,
        on_click: impl Fn(&gpui::ClickEvent, &mut Window, &mut App) + 'static,
        on_chevron: Option<Handler>,
        t: &crate::theme::Tokens,
    ) -> impl IntoElement {
        let t = *t;
        let (fg, icon_color) = if self.selected {
            (t.accent_foreground, t.accent_foreground)
        } else {
            (t.text_primary, t.sidebar_icon)
        };
        let in_tree = self.id.0 == "folder";
        let selected = self.selected;
        div()
            .id(self.id)
            .role(gpui::Role::Button)
            .aria_label(self.label.clone())
            .h(px(28.))
            .flex_none()
            .flex()
            .items_center()
            .gap(px(6.))
            .mx(px(10.))
            .pl(px(8. + 16. * self.depth as f32))
            .pr(px(8.))
            .rounded(px(6.))
            .cursor_pointer()
            .text_color(fg)
            .when(selected, |el| el.bg(t.accent))
            .when(!selected, |el| el.hover(move |s| s.bg(t.hover)))
            .when(in_tree, |el| {
                el.child(
                    div()
                        .id(("chevron", self.id.1))
                        .w(px(10.))
                        .h(px(20.))
                        .flex_none()
                        .flex()
                        .items_center()
                        .when_some(self.chevron.zip(on_chevron), |el, (open, handler)| {
                            el.child(
                                Icon::new(if open { IconName::ChevronDown } else { IconName::Chevron })
                                    .size(px(10.))
                                    .color(if selected { t.accent_foreground } else { t.text_secondary }),
                            )
                            .on_click(move |event, window, cx| handler(event, window, cx))
                        }),
                )
            })
            .child(
                div()
                    .w(px(20.))
                    .flex_none()
                    .flex()
                    .justify_center()
                    .child(Icon::new(self.icon).size(px(16.)).color(icon_color)),
            )
            .child(div().flex_1().min_w_0().truncate().child(self.label))
            .on_click(on_click)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn g(id: i64, name: &str, parent: Option<i64>) -> Group {
        Group { id, name: name.into(), parent_id: parent }
    }

    #[test]
    fn nests_children_under_expanded_parents() {
        let groups = vec![g(1, "ML", None), g(2, "RL", Some(1)), g(3, "Vision", Some(1)), g(4, "Thesis", None)];
        let collapsed = folder_rows(&groups, &HashSet::new());
        assert_eq!(collapsed.iter().map(|r| r.id).collect::<Vec<_>>(), [1, 4]);
        assert!(collapsed[0].has_children && !collapsed[0].expanded);
        assert!(!collapsed[1].has_children);

        let open = folder_rows(&groups, &HashSet::from([1]));
        assert_eq!(open.iter().map(|r| (r.id, r.depth)).collect::<Vec<_>>(), [(1, 0), (2, 1), (3, 1), (4, 0)]);
    }

    #[test]
    fn orphans_surface_and_cycles_do_not_loop() {
        // 5's parent isn't visible, so it sits at the top. 6 and 7 point at each
        // other, so neither is a root; they are left out rather than looping.
        let groups = vec![g(5, "Shared", Some(99)), g(6, "A", Some(7)), g(7, "B", Some(6))];
        let rows = folder_rows(&groups, &HashSet::from([6, 7]));
        assert_eq!(rows.iter().map(|r| r.id).collect::<Vec<_>>(), [5]);
    }
}
