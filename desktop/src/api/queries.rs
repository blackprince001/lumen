//! The server data screens read, as shared `Resource`s keyed like the web's
//! query keys.

use gpui::{App, Entity};

use super::types::{Group, PaperList};
use crate::kit::state::query::{Query, Resource};

/// Home's grid: the six newest papers (`papersApi.list(1, 6, …date_added desc)`).
pub fn recent_papers(cx: &mut App) -> Entity<Resource<PaperList>> {
    Query::new("papers/recent", |api| {
        api.get("/papers?page=1&page_size=6&sort_by=date_added&sort_order=desc")
    })
    .get(cx)
}

/// Every folder the user can see, flat.
pub fn groups(cx: &mut App) -> Entity<Resource<Vec<Group>>> {
    Query::new("groups", |api| api.get("/groups")).get(cx)
}
