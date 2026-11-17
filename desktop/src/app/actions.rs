//! Every action the menu bar can send, and the keys bound to them.
//!
//! An item is enabled when something in the focused window handles its
//! action. Items for features that aren't built yet have no handler, so
//! macOS draws them dimmed, with their shortcut already in place.

use gpui::{App, KeyBinding, actions};

actions!(
    lumen,
    [
        // Lumen
        About,
        OpenSettings,
        CheckForUpdates,
        HideApp,
        HideOthers,
        ShowAll,
        SignOut,
        Quit,
        // File
        NewResearch,
        AddPaper,
        NewFolder,
        NewLibraryWindow,
        CloseWindow,
        CloseAll,
        ImportLinks,
        Export,
        Share,
        Print,
        // Edit
        CopyCitation,
        SearchLibrary,
        FindInPaper,
        FindNext,
        HighlightSelection,
        AddComment,
        // View
        ToggleSidebar,
        ToggleInspector,
        ToggleThumbnails,
        ViewAsGrid,
        ViewAsList,
        ActualSize,
        ZoomIn,
        ZoomOut,
        ZenReading,
        EnterFullScreen,
        // Paper
        PreviousPage,
        NextPage,
        GoToPage,
        BookmarkPage,
        HighlighterTool,
        ExplainSelection,
        AddToGroup,
        ChatAboutPaper,
        DownloadPdf,
        // Window
        Minimize,
        Zoom,
        ShowLibrary,
        BringAllToFront,
        // Help
        LumenHelp,
        KeyboardShortcuts,
        ReleaseNotes,
        ReportProblem,
    ]
);

pub fn bind_keys(cx: &mut App) {
    cx.bind_keys([
        KeyBinding::new("cmd-,", OpenSettings, None),
        KeyBinding::new("cmd-h", HideApp, None),
        KeyBinding::new("alt-cmd-h", HideOthers, None),
        KeyBinding::new("cmd-q", Quit, None),
        KeyBinding::new("cmd-n", NewResearch, None),
        KeyBinding::new("cmd-o", AddPaper, None),
        KeyBinding::new("shift-cmd-n", NewFolder, None),
        KeyBinding::new("alt-cmd-n", NewLibraryWindow, None),
        KeyBinding::new("cmd-w", CloseWindow, None),
        KeyBinding::new("alt-cmd-w", CloseAll, None),
        KeyBinding::new("shift-cmd-i", ImportLinks, None),
        KeyBinding::new("shift-cmd-e", Export, None),
        KeyBinding::new("cmd-p", Print, None),
        KeyBinding::new("alt-cmd-c", CopyCitation, None),
        KeyBinding::new("cmd-k", SearchLibrary, None),
        KeyBinding::new("cmd-f", FindInPaper, None),
        KeyBinding::new("cmd-g", FindNext, None),
        KeyBinding::new("ctrl-cmd-h", HighlightSelection, None),
        KeyBinding::new("alt-cmd-m", AddComment, None),
        KeyBinding::new("ctrl-cmd-s", ToggleSidebar, None),
        KeyBinding::new("shift-cmd-l", ToggleInspector, None),
        KeyBinding::new("alt-cmd-t", ToggleThumbnails, None),
        KeyBinding::new("cmd-1", ViewAsGrid, None),
        KeyBinding::new("cmd-2", ViewAsList, None),
        KeyBinding::new("cmd-0", ActualSize, None),
        KeyBinding::new("cmd-=", ZoomIn, None),
        KeyBinding::new("cmd--", ZoomOut, None),
        KeyBinding::new("shift-cmd-f", ZenReading, None),
        KeyBinding::new("ctrl-cmd-f", EnterFullScreen, None),
        KeyBinding::new("cmd-[", PreviousPage, None),
        KeyBinding::new("cmd-]", NextPage, None),
        KeyBinding::new("alt-cmd-g", GoToPage, None),
        KeyBinding::new("cmd-d", BookmarkPage, None),
        KeyBinding::new("shift-cmd-h", HighlighterTool, None),
        KeyBinding::new("alt-cmd-e", ExplainSelection, None),
        KeyBinding::new("shift-cmd-g", AddToGroup, None),
        KeyBinding::new("shift-cmd-c", ChatAboutPaper, None),
        KeyBinding::new("shift-cmd-d", DownloadPdf, None),
        KeyBinding::new("cmd-m", Minimize, None),
        KeyBinding::new("alt-cmd-l", ShowLibrary, None),
        KeyBinding::new("cmd-?", LumenHelp, None),
        KeyBinding::new("cmd-/", KeyboardShortcuts, None),
    ]);
}
