// Adapted from learning-app desktop @ bbf6eb8 (src/ui/icon.rs): the icon set moved to the app, so `Icon` takes any asset path; extract into desktop-kit after L2.
//! An SVG from the app's bundled assets, drawn in one colour.

use gpui::{App, IntoElement, Pixels, RenderOnce, SharedString, Styled, Svg, Window, svg};

use crate::theme::ActivePalette;

/// An icon at `size`, drawn in the primary text colour unless `color` is set.
#[derive(IntoElement)]
pub struct Icon {
    path: SharedString,
    size: Pixels,
    color: Option<gpui::Hsla>,
}

impl Icon {
    pub fn new(path: impl Into<SharedString>) -> Self {
        Self {
            path: path.into(),
            size: gpui::px(16.),
            color: None,
        }
    }

    pub fn size(mut self, size: Pixels) -> Self {
        self.size = size;
        self
    }

    pub fn color(mut self, color: gpui::Hsla) -> Self {
        self.color = Some(color);
        self
    }
}

impl RenderOnce for Icon {
    fn render(self, _: &mut Window, cx: &mut App) -> impl IntoElement {
        let color = self.color.unwrap_or(cx.palette().text_primary);
        let svg: Svg = svg().path(self.path).size(self.size).flex_none();
        svg.text_color(color)
    }
}
