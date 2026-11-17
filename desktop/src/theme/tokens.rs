//! Colours for the native chrome, from the Native* boards and
//! `frontend-v2/src/index.css`. Chrome uses macOS-style translucent blacks
//! and whites; paper cards use the web's eight paper themes.

use gpui::{Hsla, rgb};

fn hex(value: u32) -> Hsla {
    rgb(value).into()
}

/// `rgba(r g b / alpha)` from a hex triple and an alpha.
fn alpha(value: u32, alpha: f32) -> Hsla {
    let mut c: Hsla = rgb(value).into();
    c.a = alpha;
    c
}

fn black(a: f32) -> Hsla {
    alpha(0x000000, a)
}

fn white(a: f32) -> Hsla {
    alpha(0xFFFFFF, a)
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Tokens {
    /// The window behind content and the toolbar. Opaque.
    pub window_bg: Hsla,
    /// The sidebar's tint over the blurred desktop. Translucent.
    pub sidebar_bg: Hsla,
    /// 0.5pt lines between regions.
    pub hairline: Hsla,

    pub text_primary: Hsla,
    pub text_secondary: Hsla,
    /// Sidebar section headers.
    pub text_tertiary: Hsla,

    /// Selection fill: forest black, or light grey in dark mode.
    pub accent: Hsla,
    pub accent_foreground: Hsla,
    pub sidebar_icon: Hsla,

    pub hover: Hsla,
    /// Search field fill.
    pub field_bg: Hsla,
    pub field_ring: Hsla,
    /// Segmented control track.
    pub segment_track: Hsla,
    pub segment_selected: Hsla,
    pub card_border: Hsla,

    pub settings_bg: Hsla,
    pub settings_header: Hsla,

    pub focus: Hsla,
    pub danger: Hsla,
    pub button_secondary_border: Hsla,
    pub surface_raised: Hsla,
    pub shadow: Hsla,

    pub status_blue: Hsla,
    pub status_green: Hsla,
    pub status_neutral: Hsla,
}

impl Tokens {
    pub fn light() -> Self {
        Self {
            window_bg: hex(0xFFFFFF),
            sidebar_bg: alpha(0xECECF0, 0.62),
            hairline: black(0.10),
            text_primary: black(0.85),
            text_secondary: black(0.55),
            text_tertiary: black(0.45),
            accent: hex(0x232927),
            accent_foreground: hex(0xFFFFFF),
            sidebar_icon: hex(0x232927),
            hover: black(0.05),
            field_bg: black(0.05),
            field_ring: black(0.10),
            segment_track: black(0.06),
            segment_selected: hex(0xFFFFFF),
            card_border: black(0.08),
            settings_bg: hex(0xECECEE),
            settings_header: hex(0xF4F4F6),
            focus: alpha(0x232927, 0.35),
            danger: hex(0xD12E3E),
            button_secondary_border: black(0.16),
            surface_raised: hex(0xFFFFFF),
            shadow: black(0.12),
            status_blue: hex(0x2F7FD0),
            status_green: hex(0x07A30B),
            status_neutral: black(0.55),
        }
    }

    pub fn dark() -> Self {
        Self {
            window_bg: hex(0x1E1E1E),
            sidebar_bg: alpha(0x28282C, 0.62),
            hairline: white(0.10),
            text_primary: white(0.86),
            text_secondary: white(0.55),
            text_tertiary: white(0.42),
            accent: hex(0xE2E2E2),
            accent_foreground: hex(0x111111),
            sidebar_icon: hex(0xCFCFCF),
            hover: white(0.07),
            field_bg: white(0.06),
            field_ring: white(0.10),
            segment_track: white(0.07),
            segment_selected: white(0.22),
            card_border: white(0.10),
            settings_bg: hex(0x2A2A2C),
            settings_header: hex(0x343437),
            focus: alpha(0xE2E2E2, 0.35),
            danger: hex(0xF06070),
            button_secondary_border: white(0.16),
            surface_raised: hex(0x262628),
            shadow: black(0.5),
            status_blue: hex(0x5AA2EC),
            status_green: hex(0x34D058),
            status_neutral: white(0.55),
        }
    }
}

/// One of the web's paper themes (`getPaperTheme` in `paper-themes.ts`).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct PaperTheme {
    pub bg: Hsla,
    pub border: Hsla,
    pub text: Hsla,
    pub accent: Hsla,
}

/// olive, beige, blue, green, terracotta, sage, slate, sand: [bg, border, text, accent].
const LIGHT: [[u32; 4]; 8] = [
    [0xF4F1E0, 0xE2DEC0, 0x5C5A4A, 0xE9E5D0],
    [0xF5F0E8, 0xE5DEC8, 0x5C5850, 0xEBE4D8],
    [0xEDF2F7, 0xCBD5E0, 0x4A5568, 0xE2E8F0],
    [0xF0FFF4, 0xC6F6D5, 0x22543D, 0xF0FFF4],
    [0xF5EDE6, 0xE5D5C8, 0x5C4A3E, 0xEDE0D4],
    [0xEDF1EE, 0xD5DDD8, 0x4A5C52, 0xE2E8E4],
    [0xEDEEEF, 0xD5D7D9, 0x4A4D52, 0xE2E4E5],
    [0xF5F3ED, 0xE5E0D5, 0x5C5848, 0xEDE8D8],
];

const DARK: [[u32; 4]; 8] = [
    [0x1C1D12, 0x2E301E, 0xD4D0C0, 0x232516],
    [0x1D1B18, 0x332F2A, 0xE5DEC8, 0x262320],
    [0x111827, 0x1E293B, 0x94A3B8, 0x1E293B],
    [0x061C12, 0x0E3322, 0x34D058, 0x0B2619],
    [0x1D1813, 0x33281E, 0xE5D0C0, 0x261E18],
    [0x121A15, 0x1E3026, 0xB8D0C2, 0x18241D],
    [0x121416, 0x1E2226, 0xB8C0C8, 0x181C1E],
    [0x1D1B14, 0x332E20, 0xE0D8C0, 0x262318],
];

/// The theme the web gives a paper: the sum of its id's characters, mod 8.
pub fn paper_theme(id: i64, dark: bool) -> PaperTheme {
    let sum: u32 = id.to_string().bytes().map(u32::from).sum();
    let [bg, border, text, accent] = if dark { DARK } else { LIGHT }[(sum % 8) as usize];
    PaperTheme {
        bg: hex(bg),
        border: hex(border),
        text: hex(text),
        accent: hex(accent),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn paper_theme_follows_the_web_hash() {
        // "1" is char code 49; 49 % 8 = 1, beige.
        assert_eq!(paper_theme(1, false).bg, hex(0xF5F0E8));
        // "12" is 49 + 50 = 99; 99 % 8 = 3, green.
        assert_eq!(paper_theme(12, true).bg, hex(0x061C12));
    }
}
