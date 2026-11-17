// Copied from learning-app desktop @ bbf6eb8 (src/state/remote.rs); extract into desktop-kit after L2.
//! `Remote<T>`: one value for "data from the server", in place of the
//! `isPending` / `error` / `data` triple a query hook returns.

use crate::kit::net::ApiError;

#[derive(Debug, Clone)]
pub enum Remote<T> {
    /// Nothing yet; a request is in flight.
    Loading,
    /// Fresh data.
    Ready(T),
    /// Data on screen while a newer copy loads.
    Refreshing(T),
    /// The last request failed. `stale` keeps whatever was on screen, so a
    /// failed refresh doesn't blank the page.
    Failed { error: ApiError, stale: Option<T> },
}

impl<T> Remote<T> {
    pub fn value(&self) -> Option<&T> {
        match self {
            Remote::Ready(v) | Remote::Refreshing(v) => Some(v),
            Remote::Failed { stale, .. } => stale.as_ref(),
            Remote::Loading => None,
        }
    }

    pub fn error(&self) -> Option<&ApiError> {
        match self {
            Remote::Failed { error, .. } => Some(error),
            _ => None,
        }
    }

    pub fn is_loading(&self) -> bool {
        matches!(self, Remote::Loading | Remote::Refreshing(_))
    }

    /// Move to the in-flight state for a new request, keeping what we have.
    pub fn begin(&mut self) {
        *self = match std::mem::replace(self, Remote::Loading) {
            Remote::Ready(v) | Remote::Refreshing(v) => Remote::Refreshing(v),
            Remote::Failed { stale: Some(v), .. } => Remote::Refreshing(v),
            Remote::Failed { stale: None, .. } | Remote::Loading => Remote::Loading,
        };
    }

    /// Settle with a request's result.
    pub fn finish(&mut self, result: Result<T, ApiError>) {
        *self = match result {
            Ok(v) => Remote::Ready(v),
            Err(error) => {
                let stale = match std::mem::replace(self, Remote::Loading) {
                    Remote::Ready(v) | Remote::Refreshing(v) => Some(v),
                    Remote::Failed { stale, .. } => stale,
                    Remote::Loading => None,
                };
                Remote::Failed { error, stale }
            }
        };
    }

    /// Edit the data in place (optimistic updates). No-op without data.
    pub fn update(&mut self, edit: impl FnOnce(&mut T)) {
        match self {
            Remote::Ready(v) | Remote::Refreshing(v) => edit(v),
            Remote::Failed { stale: Some(v), .. } => edit(v),
            _ => {}
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn err() -> ApiError {
        ApiError::Network("down".into())
    }

    #[test]
    fn refresh_keeps_data_and_failure_keeps_it_stale() {
        let mut r = Remote::Loading;
        r.finish(Ok(1));
        r.begin();
        assert!(matches!(r, Remote::Refreshing(1)));
        r.finish(Err(err()));
        assert_eq!(r.value(), Some(&1));
        assert!(r.error().is_some());
        r.begin();
        assert!(matches!(r, Remote::Refreshing(1)));
    }

    #[test]
    fn first_failure_has_nothing_stale() {
        let mut r: Remote<i32> = Remote::Loading;
        r.finish(Err(err()));
        assert_eq!(r.value(), None);
        r.begin();
        assert!(matches!(r, Remote::Loading));
    }
}
