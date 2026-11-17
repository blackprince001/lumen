//! 0.5pt separators. GPUI's border widths start at 1pt, which is two device
//! pixels on a Retina screen; macOS draws its dividers at one.

use gpui::{Div, Hsla, Styled, div, px};

/// A horizontal line along the bottom edge of a `relative()` parent.
pub fn bottom(color: Hsla) -> Div {
    div().absolute().bottom_0().left_0().right_0().h(px(0.5)).bg(color)
}

/// A vertical line along the right edge of a `relative()` parent.
pub fn right(color: Hsla) -> Div {
    div().absolute().top_0().right_0().bottom_0().w(px(0.5)).bg(color)
}
