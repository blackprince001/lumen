// Adapted from learning-app desktop @ bbf6eb8 (src/ui/typography.rs): same trait, Lumen's desktop scale; extract into desktop-kit after L2.
//! The type scale. Chrome (sidebar, toolbar, menus, settings) is the system
//! font at 13pt for body and controls and 11pt for secondary text. Paper
//! titles, summaries and anything that is content use Inter.

use gpui::{Styled, px, relative};

/// Family name for macOS's system font (SF Pro).
pub const CHROME_FONT: &str = ".SystemUIFont";
/// Family name for content: paper titles, summaries, reports.
pub const CONTENT_FONT: &str = "Inter";

pub trait Type: Styled + Sized {
    /// System font, for chrome.
    fn chrome(self) -> Self {
        self.font_family(CHROME_FONT)
    }
    /// Inter, for content.
    fn content(self) -> Self {
        self.font_family(CONTENT_FONT)
    }
    /// 11pt: section headers, subtitles, footers.
    fn type_small(self) -> Self {
        self.text_size(px(11.)).line_height(px(14.))
    }
    /// 12pt: table footers and dense secondary lines.
    fn type_caption(self) -> Self {
        self.text_size(px(12.)).line_height(px(16.))
    }
    /// 13pt: body and controls.
    fn type_body(self) -> Self {
        self.text_size(px(13.)).line_height(px(16.))
    }
    /// 14pt: card titles.
    fn type_card(self) -> Self {
        self.text_size(px(14.)).line_height(px(19.))
    }
    /// 15pt: toolbar titles.
    fn type_title(self) -> Self {
        self.text_size(px(15.)).line_height(px(19.))
    }
    /// 22pt: page headings.
    fn type_heading(self) -> Self {
        self.text_size(px(22.)).line_height(relative(1.25))
    }
    /// 28pt: the greeting on Home.
    fn type_display(self) -> Self {
        self.text_size(px(28.)).line_height(relative(1.2))
    }
}

impl<T: Styled> Type for T {}
