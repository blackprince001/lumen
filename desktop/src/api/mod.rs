//! HTTP client for the Lumen server (`/api/v1`).
//!
//! Sign-in gives a short-lived access token, kept in memory and sent as a
//! Bearer header, and a refresh token in an httpOnly cookie. The cookie jar is
//! saved to the Keychain (see `kit::net::vault`), so a relaunch can ask
//! `/auth/refresh` for a new access token without signing in again. The
//! server rotates the refresh token on every use, so the jar is saved right
//! after each response.
//!
//! A token is renewed a minute before it expires, and once more when a
//! request still comes back 401 (then the request is tried again). Renewals
//! are single-file: requests that find the token stale together share one
//! refresh, because the second use of a rotated refresh token is rejected.

pub mod queries;
pub mod types;

use std::{
    future::Future,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

use futures::channel::mpsc::UnboundedSender;
use reqwest::{Method, header};
use reqwest_cookie_store::CookieStoreMutex;
use serde::{Serialize, de::DeserializeOwned};
use url::Url;

use crate::kit::net::{ApiError, spawn, vault::Vault};
use types::{RefreshResponse, TokenResponse};

/// Renew the access token when less than this is left.
const REFRESH_MARGIN: Duration = Duration::from_secs(60);

#[derive(Clone)]
pub struct Api {
    inner: Arc<Inner>,
}

struct Inner {
    http: reqwest::Client,
    jar: Arc<CookieStoreMutex>,
    vault: Vault,
    base: Url,
    token: Mutex<Option<Access>>,
    /// Held while refreshing, so concurrent requests share one refresh.
    refreshing: tokio::sync::Mutex<()>,
    /// Told when the server refuses the refresh token mid-session.
    expired: UnboundedSender<()>,
}

#[derive(Clone)]
struct Access {
    token: String,
    expires_at: Instant,
}

impl Access {
    fn new(token: String, expires_in: u64) -> Self {
        Self {
            token,
            expires_at: Instant::now() + Duration::from_secs(expires_in),
        }
    }

    fn is_stale(&self) -> bool {
        Instant::now() + REFRESH_MARGIN >= self.expires_at
    }
}

impl gpui::Global for Api {}

impl Api {
    /// `expired` receives a message when a signed-in session can no longer be
    /// renewed.
    pub fn new(base: Url, expired: UnboundedSender<()>) -> Self {
        let vault = Vault::new(&base);
        let jar = Arc::new(CookieStoreMutex::new(vault.load()));
        let http = reqwest::Client::builder()
            .cookie_provider(jar.clone())
            .user_agent(concat!("lumen-desktop/", env!("CARGO_PKG_VERSION")))
            .build()
            .expect("failed to build the HTTP client");
        Self {
            inner: Arc::new(Inner {
                http,
                jar,
                vault,
                base,
                token: Mutex::new(None),
                refreshing: tokio::sync::Mutex::new(()),
                expired,
            }),
        }
    }

    pub fn global(cx: &gpui::App) -> Self {
        cx.global::<Api>().clone()
    }

    /// Absolute URL for a server path such as `/papers?page=1`.
    pub fn url(&self, path: &str) -> Url {
        self.inner
            .base
            .join(path.trim_start_matches('/'))
            .unwrap_or_else(|_| self.inner.base.clone())
    }

    /// Forget the session locally: token, cookies and the Keychain copy.
    pub fn clear_session(&self) {
        self.inner.clear();
    }

    /// Tell the server to revoke the refresh token (waiting at most five
    /// seconds, so a dead connection can't hold sign-out up), then forget
    /// the session locally either way.
    pub fn sign_out(&self) -> impl Future<Output = ()> + 'static + use<> {
        let inner = self.inner.clone();
        let url = self.url("auth/logout");
        spawn(async move {
            let token = inner.current().map(|a| a.token);
            let request = inner.once(Method::POST, url, None, token);
            let _ = tokio::time::timeout(Duration::from_secs(5), request).await;
            inner.clear();
        })
    }

    /// Ask for a new access token with the saved refresh cookie. Used at
    /// launch; a 401 here just means "not signed in", so it doesn't count as
    /// an expired session.
    pub fn restore(&self) -> impl Future<Output = Result<(), ApiError>> + 'static + use<> {
        let inner = self.inner.clone();
        spawn(async move { inner.refresh().await })
    }

    /// Trade a Google ID token for a session.
    pub fn sign_in_google(
        &self,
        id_token: String,
    ) -> impl Future<Output = Result<types::User, ApiError>> + 'static + use<> {
        #[derive(Serialize)]
        struct Body {
            id_token: String,
        }
        self.sign_in("auth/google", serde_json::to_string(&Body { id_token }))
    }

    /// The admin account's password sign-in. Only debug builds call this.
    #[cfg_attr(not(debug_assertions), allow(dead_code))]
    pub fn sign_in_admin(
        &self,
        username: String,
        password: String,
    ) -> impl Future<Output = Result<types::User, ApiError>> + 'static + use<> {
        #[derive(Serialize)]
        struct Body {
            username: String,
            password: String,
        }
        self.sign_in("auth/admin/login", serde_json::to_string(&Body { username, password }))
    }

    fn sign_in(
        &self,
        path: &str,
        body: Result<String, serde_json::Error>,
    ) -> impl Future<Output = Result<types::User, ApiError>> + 'static + use<> {
        let inner = self.inner.clone();
        let url = self.url(path);
        spawn(async move {
            let body = body.map_err(|e| ApiError::Encode(e.to_string()))?;
            let text = inner.once(Method::POST, url, Some(body), None).await?;
            let response: TokenResponse = decode(&text)?;
            *inner.token.lock().unwrap() = Some(Access::new(response.access_token, response.expires_in));
            Ok(response.user)
        })
    }

    pub fn get<T>(&self, path: &str) -> impl Future<Output = Result<T, ApiError>> + 'static + use<T>
    where
        T: DeserializeOwned + Send + 'static,
    {
        self.send(Method::GET, path, None)
    }

    fn send<T>(
        &self,
        method: Method,
        path: &str,
        body: Option<String>,
    ) -> impl Future<Output = Result<T, ApiError>> + 'static + use<T>
    where
        T: DeserializeOwned + Send + 'static,
    {
        let inner = self.inner.clone();
        let url = self.url(path);
        spawn(async move {
            let text = inner.authed(method, url, body).await?;
            decode(&text)
        })
    }
}

/// 204s and some 202s have no body; let `()` and `Option` decode from null.
fn decode<T: DeserializeOwned>(text: &str) -> Result<T, ApiError> {
    let text = if text.trim().is_empty() { "null" } else { text };
    serde_json::from_str(text).map_err(|err| ApiError::Decode(err.to_string()))
}

impl Inner {
    fn current(&self) -> Option<Access> {
        self.token.lock().unwrap().clone()
    }

    fn clear(&self) {
        *self.token.lock().unwrap() = None;
        if let Ok(mut jar) = self.jar.lock() {
            jar.clear();
        }
        self.vault.forget();
    }

    /// A request with the Bearer token: renewed first if it's about to run
    /// out, and tried again after a renewal if the server still says 401.
    async fn authed(&self, method: Method, url: Url, body: Option<String>) -> Result<String, ApiError> {
        if let Some(access) = self.current()
            && access.is_stale()
        {
            self.refresh_if_unchanged(Some(access.token)).await?;
        }
        let sent_with = self.current().map(|a| a.token);
        match self.once(method.clone(), url.clone(), body.clone(), sent_with.clone()).await {
            Err(err) if err.is_status(401) => {
                self.refresh_if_unchanged(sent_with).await?;
                let token = self.current().map(|a| a.token);
                self.once(method, url, body, token).await
            }
            other => other,
        }
    }

    /// One request, no retries. Saves the cookie jar afterwards.
    async fn once(
        &self,
        method: Method,
        url: Url,
        body: Option<String>,
        bearer: Option<String>,
    ) -> Result<String, ApiError> {
        let mut request = self
            .http
            .request(method, url)
            .header(header::ACCEPT, "application/json");
        if let Some(token) = bearer {
            request = request.bearer_auth(token);
        }
        if let Some(body) = body {
            request = request.header(header::CONTENT_TYPE, "application/json").body(body);
        }
        let response = request.send().await.map_err(ApiError::network)?;
        self.vault.save(&self.jar);
        let status = response.status();
        let text = response.text().await.map_err(ApiError::network)?;
        if status.is_success() {
            Ok(text)
        } else {
            Err(ApiError::from_response(status.as_u16(), &text))
        }
    }

    /// Refresh unless another request already did while we waited for our
    /// turn (the token is no longer the one the caller used). A server that
    /// refuses the refresh token ends the session.
    async fn refresh_if_unchanged(&self, used: Option<String>) -> Result<(), ApiError> {
        let _turn = self.refreshing.lock().await;
        if self.current().map(|a| a.token) != used {
            return Ok(());
        }
        let result = self.refresh_now().await;
        if let Err(err) = &result
            && matches!(err.status(), Some(401 | 403))
        {
            *self.token.lock().unwrap() = None;
            self.expired.unbounded_send(()).ok();
        }
        result
    }

    async fn refresh(&self) -> Result<(), ApiError> {
        let _turn = self.refreshing.lock().await;
        self.refresh_now().await
    }

    async fn refresh_now(&self) -> Result<(), ApiError> {
        let url = self.base.join("auth/refresh").expect("a relative path joins");
        let text = self.once(Method::POST, url, None, None).await?;
        let response: RefreshResponse = decode(&text)?;
        *self.token.lock().unwrap() = Some(Access::new(response.access_token, response.expires_in));
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_goes_stale_a_minute_early() {
        assert!(Access::new("t".into(), 30).is_stale());
        assert!(Access::new("t".into(), 60).is_stale());
        assert!(!Access::new("t".into(), 600).is_stale());
    }

    #[test]
    fn joins_paths_under_the_api_prefix() {
        let (tx, _rx) = futures::channel::mpsc::unbounded();
        let api = Api::new(Url::parse("http://localhost:8000/api/v1/").unwrap(), tx);
        assert_eq!(api.url("/auth/me").as_str(), "http://localhost:8000/api/v1/auth/me");
        assert_eq!(
            api.url("/papers?page=1").as_str(),
            "http://localhost:8000/api/v1/papers?page=1"
        );
    }
}
