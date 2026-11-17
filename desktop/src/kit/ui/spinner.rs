// Adapted from learning-app desktop @ bbf6eb8 (src/ui/spinner.rs): draws Lumen's spinner arc; extract into desktop-kit after L2.
//! A spinning arc.

use std::time::Duration;

use gpui::{
    Animation, AnimationExt, App, Hsla, IntoElement, Pixels, RenderOnce, Styled, Transformation,
    Window, percentage, px, svg,
};

use crate::theme::ActivePalette;

#[derive(IntoElement)]
pub struct Spinner {
    size: Pixels,
    color: Option<Hsla>,
}

impl Spinner {
    pub fn new() -> Self {
        Self {
            size: px(16.),
            color: None,
        }
    }

    pub fn size(mut self, size: Pixels) -> Self {
        self.size = size;
        self
    }

    pub fn color(mut self, color: Hsla) -> Self {
        self.color = Some(color);
        self
    }
}

impl RenderOnce for Spinner {
    fn render(self, _: &mut Window, cx: &mut App) -> impl IntoElement {
        let color = self.color.unwrap_or(cx.palette().text_secondary);
        svg()
            .path("icons/spinner.svg")
            .size(self.size)
            .flex_none()
            .text_color(color)
            .with_animation(
                "spin",
                Animation::new(Duration::from_millis(900)).repeat(),
                |svg, t| svg.with_transformation(Transformation::rotate(percentage(t))),
            )
    }
}
