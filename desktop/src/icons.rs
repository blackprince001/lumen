//! Lumen's own icons, generated into `assets/icons` by `scripts/gen-icons.mjs`.
//! Names follow the web's icon components.

use gpui::SharedString;

macro_rules! icons {
    ($($variant:ident => $file:literal,)*) => {
        #[derive(Debug, Clone, Copy, PartialEq, Eq)]
        pub enum IconName { $($variant,)* }

        impl IconName {
            pub fn path(self) -> SharedString {
                match self { $(IconName::$variant => concat!("icons/", $file, ".svg").into(),)* }
            }
        }

        impl From<IconName> for SharedString {
            fn from(name: IconName) -> Self {
                name.path()
            }
        }
    };
}

icons! {
    Alert => "warning",
    Annotations => "file-text",
    Archive => "archive",
    Chevron => "chevron-right",
    ChevronDown => "chevron-down",
    Chip => "chip",
    Citations => "citation-graph",
    Close => "close",
    Dashboard => "chart-bars",
    Discovery => "discover",
    Feed => "feed",
    Folder => "folder",
    FolderOpen => "folder-open",
    Groups => "library",
    Home => "home",
    Library => "file-text",
    Logout => "logout",
    Palette => "palette",
    PanelLeft => "panel-left-close",
    PanelRight => "panel-right-open",
    Plus => "plus",
    Research => "microscope",
    Search => "search",
    Settings => "settings",
    Sparkles => "sparkles",
    User => "user",
    Users => "users",
    ViewGrid => "view-grid",
    ViewList => "view-list",
}

/// The 22pt settings-tab icons, drawn with a thinner stroke.
impl IconName {
    pub fn large(self) -> SharedString {
        let path = self.path();
        path.replace(".svg", "-lg.svg").into()
    }
}
