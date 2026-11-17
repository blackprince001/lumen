// Copied from learning-app desktop @ bbf6eb8 (src/state/query.rs, uses the app's `Api` global); extract into desktop-kit after L2.
//! A small stand-in for TanStack Query: one shared `Resource` per key, so
//! every view showing the same server data reads (and refreshes) the same
//! copy.
//!
//! - Keys mirror the web query keys (`groups`, `groups/<id>`, …), so
//!   `invalidate("groups")` refreshes the same things the web app does.
//! - Data older than 30s is refetched when a view asks for it again (the
//!   web `staleTime`).
//! - `poll_while` replaces `refetchInterval` predicates: keep refetching on
//!   an interval while the data says work is still running, then stop.

use std::{
    collections::HashMap,
    future::Future,
    rc::Rc,
    time::{Duration, Instant},
};

use futures::future::LocalBoxFuture;
use gpui::{AnyEntity, App, AppContext as _, Context, Entity, Global, Task};

use super::Remote;
use crate::{api::Api, kit::net::ApiError};

const STALE_AFTER: Duration = Duration::from_secs(30);

type Fetch<T> = Rc<dyn Fn(&Api) -> LocalBoxFuture<'static, Result<T, ApiError>>>;
type Predicate<T> = Rc<dyn Fn(&T) -> bool>;

pub struct Resource<T> {
    pub state: Remote<T>,
    fetch: Fetch<T>,
    stale_after: Option<Duration>,
    poll: Option<(Duration, Predicate<T>)>,
    fetched_at: Option<Instant>,
    task: Option<Task<()>>,
}

impl<T: 'static> Resource<T> {
    pub fn value(&self) -> Option<&T> {
        self.state.value()
    }

    pub fn refetch(&mut self, cx: &mut Context<Self>) {
        self.state.begin();
        cx.notify();
        let request = (self.fetch)(&Api::global(cx));
        self.task = Some(cx.spawn(async move |this, cx| {
            let result = request.await;
            let next_poll = this
                .update(cx, |this, cx| {
                    this.state.finish(result);
                    this.fetched_at = Some(Instant::now());
                    cx.notify();
                    match (&this.poll, this.state.value()) {
                        (Some((every, keep_going)), Some(value)) if keep_going(value) => {
                            Some(*every)
                        }
                        _ => None,
                    }
                })
                .ok()
                .flatten();
            if let Some(every) = next_poll {
                cx.background_executor().timer(every).await;
                this.update(cx, |this, cx| this.refetch(cx)).ok();
            }
        }));
    }

    /// Optimistic edit; the next fetch replaces it with the server's copy.
    pub fn update_value(&mut self, cx: &mut Context<Self>, edit: impl FnOnce(&mut T)) {
        self.state.update(edit);
        cx.notify();
    }

    fn is_stale(&self) -> bool {
        match (self.fetched_at, self.stale_after) {
            (None, _) => true,
            (Some(_), None) => false,
            (Some(at), Some(after)) => at.elapsed() > after,
        }
    }
}

struct Entry {
    entity: AnyEntity,
    refetch: Rc<dyn Fn(&mut App)>,
}

#[derive(Default)]
pub struct Queries {
    entries: HashMap<String, Entry>,
}

impl Global for Queries {}

/// Describe a query, then `.get(cx)` it.
pub struct Query<T> {
    key: String,
    fetch: Fetch<T>,
    poll: Option<(Duration, Predicate<T>)>,
    stale_after: Option<Duration>,
}

impl<T: 'static> Query<T> {
    pub fn new<F, Fut>(key: impl Into<String>, fetch: F) -> Self
    where
        F: Fn(&Api) -> Fut + 'static,
        Fut: Future<Output = Result<T, ApiError>> + 'static,
    {
        Self {
            key: key.into(),
            fetch: Rc::new(move |api| Box::pin(fetch(api))),
            poll: None,
            stale_after: Some(STALE_AFTER),
        }
    }

    /// Never refetch on revisit (images, things that don't change).
    pub fn never_stale(mut self) -> Self {
        self.stale_after = None;
        self
    }

    /// Refetch every `every` while `keep_going(data)` holds.
    pub fn poll_while(
        mut self,
        every: Duration,
        keep_going: impl Fn(&T) -> bool + 'static,
    ) -> Self {
        self.poll = Some((every, Rc::new(keep_going)));
        self
    }

    /// The shared resource for this key: created and fetched on first use,
    /// refetched if stale.
    pub fn get(self, cx: &mut App) -> Entity<Resource<T>> {
        if !cx.has_global::<Queries>() {
            cx.set_global(Queries::default());
        }
        let existing = cx
            .global::<Queries>()
            .entries
            .get(&self.key)
            .and_then(|entry| entry.entity.clone().downcast::<Resource<T>>().ok());
        if let Some(entity) = existing {
            let (stale, loading) = {
                let r = entity.read(cx);
                (r.is_stale(), r.state.is_loading())
            };
            if stale && !loading {
                entity.update(cx, |r, cx| r.refetch(cx));
            }
            return entity;
        }

        let entity = cx.new(|cx| {
            let mut resource = Resource {
                state: Remote::Loading,
                fetch: self.fetch,
                poll: self.poll,
                stale_after: self.stale_after,
                fetched_at: None,
                task: None,
            };
            resource.refetch(cx);
            resource
        });
        let weak = entity.downgrade();
        cx.global_mut::<Queries>().entries.insert(
            self.key,
            Entry {
                entity: entity.clone().into_any(),
                refetch: Rc::new(move |cx| {
                    if let Some(entity) = weak.upgrade() {
                        entity.update(cx, |r, cx| r.refetch(cx));
                    }
                }),
            },
        );
        entity
    }
}

/// Refetch every cached query whose key is `prefix` or starts with `prefix/`.
pub fn invalidate(prefix: &str, cx: &mut App) {
    let Some(queries) = cx.try_global::<Queries>() else {
        return;
    };
    let refetches: Vec<_> = queries
        .entries
        .iter()
        .filter(|(key, _)| *key == prefix || key.starts_with(&format!("{prefix}/")))
        .map(|(_, entry)| entry.refetch.clone())
        .collect();
    for refetch in refetches {
        refetch(cx);
    }
}

/// Drop everything (sign-out): the next user must not see this one's data.
pub fn clear(cx: &mut App) {
    cx.set_global(Queries::default());
}
