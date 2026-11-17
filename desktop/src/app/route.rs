//! Where a library window is. The sidebar's items, in the order the web
//! sidebar and the NativeLibrary board list them.

use crate::icons::IconName;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Route {
    Home,
    Dashboard,
    Library,
    Groups,
    Discovery,
    DeepResearch,
    HfPapers,
    ForYou,
    ResearchArchive,
    DiscoveryArchive,
    Annotations,
    Citations,
    Authors,
    /// A folder from the sidebar's Folders tree.
    Folder(i64),
}

impl Route {
    pub fn title(self) -> &'static str {
        match self {
            Route::Home => "Home",
            Route::Dashboard => "Dashboard",
            Route::Library => "Library",
            Route::Groups => "Groups",
            Route::Discovery => "Discovery",
            Route::DeepResearch => "Deep Research",
            Route::HfPapers => "HF Papers",
            Route::ForYou => "For You",
            Route::ResearchArchive => "Research Archive",
            Route::DiscoveryArchive => "Discovery Archive",
            Route::Annotations => "Annotations",
            Route::Citations => "Citations",
            Route::Authors => "Authors",
            Route::Folder(_) => "Folder",
        }
    }

    pub fn icon(self) -> IconName {
        match self {
            Route::Home => IconName::Home,
            Route::Dashboard => IconName::Dashboard,
            Route::Library => IconName::Library,
            Route::Groups => IconName::Groups,
            Route::Discovery => IconName::Discovery,
            Route::DeepResearch => IconName::Research,
            Route::HfPapers => IconName::Feed,
            Route::ForYou => IconName::Sparkles,
            Route::ResearchArchive | Route::DiscoveryArchive => IconName::Archive,
            Route::Annotations => IconName::Annotations,
            Route::Citations => IconName::Citations,
            Route::Authors => IconName::Users,
            Route::Folder(_) => IconName::Folder,
        }
    }
}

/// A sidebar section: a header and its items.
pub struct Section {
    pub title: &'static str,
    pub items: &'static [Route],
}

/// The fixed sections. Folders come from the server and follow these.
pub const SECTIONS: [Section; 3] = [
    Section {
        title: "Library",
        items: &[Route::Home, Route::Dashboard, Route::Library, Route::Groups],
    },
    Section {
        title: "Discover",
        items: &[
            Route::Discovery,
            Route::DeepResearch,
            Route::HfPapers,
            Route::ForYou,
            Route::ResearchArchive,
            Route::DiscoveryArchive,
        ],
    },
    Section {
        title: "Tools",
        items: &[Route::Annotations, Route::Citations, Route::Authors],
    },
];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sidebar_lists_every_page_once() {
        let all: Vec<Route> = SECTIONS.iter().flat_map(|s| s.items.iter().copied()).collect();
        assert_eq!(all.len(), 13);
        for (i, a) in all.iter().enumerate() {
            assert!(!all[i + 1..].contains(a), "{a:?} listed twice");
        }
    }
}
