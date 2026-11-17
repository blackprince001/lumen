//! Where the app talks to, and the Google client it signs in with.

use url::Url;

#[cfg(debug_assertions)]
const DEFAULT_API_URL: &str = "http://localhost:8000/api/v1";
#[cfg(not(debug_assertions))]
const DEFAULT_API_URL: &str = "https://lumen.pkab.work/api/v1";

/// `LUMEN_API_URL`, or the default for this build: the local Docker Compose
/// stack in debug builds, the live site in release builds.
pub fn api_url() -> Url {
    let raw = std::env::var("LUMEN_API_URL").unwrap_or_else(|_| DEFAULT_API_URL.into());
    // A trailing slash makes `join` append to `/api/v1` instead of replacing it.
    Url::parse(&format!("{}/", raw.trim_end_matches('/')))
        .unwrap_or_else(|err| panic!("LUMEN_API_URL is not a URL ({raw}): {err}"))
}

/// A Google "Desktop app" OAuth client.
#[derive(Debug, Clone)]
pub struct GoogleClient {
    pub id: String,
    pub secret: String,
}

/// From `LUMEN_GOOGLE_CLIENT_ID` and `LUMEN_GOOGLE_CLIENT_SECRET`. Google
/// issues a secret for desktop clients and says it isn't confidential; PKCE
/// is what protects the flow.
pub fn google_client() -> Option<GoogleClient> {
    let get = |key: &str| std::env::var(key).ok().filter(|v| !v.trim().is_empty());
    Some(GoogleClient {
        id: get("LUMEN_GOOGLE_CLIENT_ID")?,
        secret: get("LUMEN_GOOGLE_CLIENT_SECRET")?,
    })
}

/// Debug builds only: sign in as the local admin so screens can be checked
/// without Google. Compiled out of release builds.
#[cfg(debug_assertions)]
pub fn dev_admin() -> Option<(String, String)> {
    let get = |key: &str| std::env::var(key).ok().filter(|v| !v.is_empty());
    Some((get("LUMEN_DEV_ADMIN_USER")?, get("LUMEN_DEV_ADMIN_PASSWORD")?))
}
