//! The menu bar, as drawn on the NativeMenuBar board: Lumen, File, Edit,
//! View, Paper, Window, Help. `cx.set_menus` hands these to macOS as real
//! system menus.

use gpui::{App, Menu, MenuItem, OsAction, SystemMenuType};
use gpui_component::input;

use super::actions::*;

/// What the menus need to know about the active window.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MenuState {
    pub sidebar_visible: bool,
}

impl Default for MenuState {
    fn default() -> Self {
        Self { sidebar_visible: true }
    }
}

pub fn install(state: MenuState, cx: &mut App) {
    cx.set_menus(menus(state));
}

/// An item whose feature isn't built yet. Nothing handles its action, so
/// macOS dims it, with its shortcut shown.
fn off(name: &str, action: impl gpui::Action) -> MenuItem {
    MenuItem::action(name.to_string(), action)
}

fn menus(state: MenuState) -> Vec<Menu> {
    let sort_by = Menu::new("Sort By").items([
        MenuItem::action("Date Added", ViewAsGrid).disabled(true),
        MenuItem::action("Title", ViewAsGrid).disabled(true),
        MenuItem::action("Year", ViewAsGrid).disabled(true),
    ]);
    let reading_status = Menu::new("Reading Status").items([
        MenuItem::action("Not Started", AddToGroup).disabled(true),
        MenuItem::action("In Progress", AddToGroup).disabled(true),
        MenuItem::action("Read", AddToGroup).disabled(true),
    ]);
    let priority = Menu::new("Priority").items([
        MenuItem::action("Low", AddToGroup).disabled(true),
        MenuItem::action("Medium", AddToGroup).disabled(true),
        MenuItem::action("High", AddToGroup).disabled(true),
    ]);
    let recent = Menu::new("Open Recent").items([MenuItem::action("No Recent Papers", AddToGroup).disabled(true)]);

    vec![
        Menu::new("Lumen").items([
            MenuItem::action("About Lumen", About),
            MenuItem::separator(),
            MenuItem::action("Settings…", OpenSettings),
            off("Check for Updates…", CheckForUpdates),
            MenuItem::separator(),
            MenuItem::os_submenu("Services", SystemMenuType::Services),
            MenuItem::separator(),
            MenuItem::action("Hide Lumen", HideApp),
            MenuItem::action("Hide Others", HideOthers),
            MenuItem::action("Show All", ShowAll),
            MenuItem::separator(),
            MenuItem::action("Sign Out…", SignOut),
            MenuItem::action("Quit Lumen", Quit),
        ]),
        Menu::new("File").items([
            off("New Research", NewResearch),
            off("Add Paper…", AddPaper),
            off("New Folder", NewFolder),
            MenuItem::action("New Library Window", NewLibraryWindow),
            MenuItem::submenu(recent),
            MenuItem::separator(),
            MenuItem::action("Close Window", CloseWindow),
            MenuItem::action("Close All", CloseAll),
            MenuItem::separator(),
            off("Import Links…", ImportLinks),
            off("Export…", Export),
            off("Share…", Share),
            MenuItem::separator(),
            off("Print…", Print),
        ]),
        Menu::new("Edit").items([
            MenuItem::os_action("Undo", input::Undo, OsAction::Undo),
            MenuItem::os_action("Redo", input::Redo, OsAction::Redo),
            MenuItem::separator(),
            MenuItem::os_action("Cut", input::Cut, OsAction::Cut),
            MenuItem::os_action("Copy", input::Copy, OsAction::Copy),
            off("Copy Citation", CopyCitation),
            MenuItem::os_action("Paste", input::Paste, OsAction::Paste),
            MenuItem::os_action("Select All", input::SelectAll, OsAction::SelectAll),
            MenuItem::separator(),
            MenuItem::action("Search Library…", SearchLibrary),
            off("Find in Paper…", FindInPaper),
            off("Find Next", FindNext),
            MenuItem::separator(),
            off("Highlight Selection", HighlightSelection),
            off("Add Comment", AddComment),
        ]),
        Menu::new("View").items([
            MenuItem::action(
                if state.sidebar_visible { "Hide Sidebar" } else { "Show Sidebar" },
                ToggleSidebar,
            ),
            off("Show Inspector", ToggleInspector),
            off("Show Thumbnails", ToggleThumbnails),
            MenuItem::separator(),
            MenuItem::action("as Grid", ViewAsGrid).checked(true),
            off("as List", ViewAsList),
            MenuItem::submenu(sort_by),
            MenuItem::separator(),
            off("Actual Size", ActualSize),
            off("Zoom In", ZoomIn),
            off("Zoom Out", ZoomOut),
            MenuItem::separator(),
            off("Zen Reading", ZenReading),
            MenuItem::action("Enter Full Screen", EnterFullScreen),
        ]),
        Menu::new("Paper").items([
            off("Previous Page", PreviousPage),
            off("Next Page", NextPage),
            off("Go to Page…", GoToPage),
            MenuItem::separator(),
            off("Bookmark Page", BookmarkPage),
            off("Highlighter Tool", HighlighterTool),
            off("Explain Selection", ExplainSelection),
            MenuItem::separator(),
            MenuItem::submenu(reading_status),
            MenuItem::submenu(priority),
            off("Add to Group…", AddToGroup),
            MenuItem::separator(),
            off("Chat About Paper", ChatAboutPaper),
            off("Download PDF", DownloadPdf),
        ]),
        // The menu named "Window" is the one macOS fills with the open
        // windows, tab commands and the layout items.
        Menu::new("Window").items([
            MenuItem::action("Minimize", Minimize),
            MenuItem::action("Zoom", Zoom),
            MenuItem::separator(),
            MenuItem::action("Library", ShowLibrary),
            MenuItem::separator(),
            MenuItem::action("Bring All to Front", BringAllToFront),
        ]),
        Menu::new("Help").items([
            off("Lumen Help", LumenHelp),
            off("Keyboard Shortcuts", KeyboardShortcuts),
            off("Release Notes", ReleaseNotes),
            MenuItem::separator(),
            off("Report a Problem…", ReportProblem),
        ]),
    ]
}
