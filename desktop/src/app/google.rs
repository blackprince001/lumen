//! Google sign-in through the installed-app (loopback) flow.
//!
//! 1. Listen on `127.0.0.1` on a free port.
//! 2. Open Google's consent page with a PKCE challenge, a random `state` and
//!    that address as the redirect.
//! 3. Catch the redirect, check `state`, and trade the code and PKCE verifier
//!    for tokens at Google's token endpoint.
//! 4. Hand the ID token to the caller, who posts it to `/auth/google`.
//!
//! The pure parts (challenge, request parsing, state check, URL) are unit
//! tested; the network parts need a real client and are not.

use std::time::Duration;

use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
use rand::RngExt as _;
use sha2::{Digest as _, Sha256};
use tokio::{
    io::{AsyncReadExt as _, AsyncWriteExt as _},
    net::{TcpListener, TcpStream},
};
use url::Url;

use crate::config::GoogleClient;

const AUTH_ENDPOINT: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT: &str = "https://oauth2.googleapis.com/token";
/// How long we wait for the person to finish in the browser.
const TIMEOUT: Duration = Duration::from_secs(5 * 60);

#[derive(Debug, Clone, thiserror::Error)]
pub enum GoogleError {
    #[error("Couldn't start sign-in: {0}")]
    Listen(String),
    #[error("Sign-in timed out. Try again.")]
    TimedOut,
    #[error("Google sign-in was cancelled.")]
    Denied,
    #[error("Google sent back an error: {0}")]
    Google(String),
    #[error("Couldn't reach Google. Check your connection and try again.")]
    Network,
    #[error("Google didn't send an ID token.")]
    NoIdToken,
}

/// A sign-in that has its listener open and is ready to send the person to
/// Google.
pub struct Flow {
    listener: TcpListener,
    client: GoogleClient,
    verifier: String,
    state: String,
    redirect: String,
}

/// Open the loopback listener. Run on the HTTP runtime.
pub async fn begin(client: GoogleClient) -> Result<Flow, GoogleError> {
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| GoogleError::Listen(e.to_string()))?;
    let port = listener
        .local_addr()
        .map_err(|e| GoogleError::Listen(e.to_string()))?
        .port();
    Ok(Flow {
        listener,
        client,
        verifier: random_urlsafe(32),
        state: random_urlsafe(16),
        redirect: format!("http://127.0.0.1:{port}"),
    })
}

impl Flow {
    /// The consent page to open in the browser.
    pub fn url(&self) -> String {
        auth_url(&self.client.id, &self.redirect, &challenge(&self.verifier), &self.state)
    }

    /// Wait for the redirect and trade the code for an ID token.
    pub async fn complete(self) -> Result<String, GoogleError> {
        let code = tokio::time::timeout(TIMEOUT, self.wait_for_code())
            .await
            .map_err(|_| GoogleError::TimedOut)??;
        exchange(&self.client, &code, &self.verifier, &self.redirect).await
    }

    async fn wait_for_code(&self) -> Result<String, GoogleError> {
        loop {
            let (mut stream, _) = self
                .listener
                .accept()
                .await
                .map_err(|e| GoogleError::Listen(e.to_string()))?;
            // Browsers open spare connections that never send anything; give
            // each a few seconds, then move on.
            let read = tokio::time::timeout(Duration::from_secs(5), read_request_line(&mut stream)).await;
            let Ok(Ok(Some(line))) = read else {
                continue;
            };
            match parse_callback(&line, &self.state) {
                Callback::Code(code) => {
                    respond(&mut stream, 200, "You're signed in", "You can close this tab and return to Lumen.").await;
                    return Ok(code);
                }
                Callback::Error(error) => {
                    respond(&mut stream, 200, "Sign-in didn't finish", "You can close this tab and return to Lumen.").await;
                    return Err(if error == "access_denied" {
                        GoogleError::Denied
                    } else {
                        GoogleError::Google(error)
                    });
                }
                Callback::BadState => {
                    respond(&mut stream, 400, "Sign-in was refused", "That request didn't match a sign-in started in Lumen.").await;
                }
                Callback::Other => {
                    respond(&mut stream, 404, "Not found", "").await;
                }
            }
        }
    }
}

async fn read_request_line(stream: &mut TcpStream) -> std::io::Result<Option<String>> {
    let mut buf = Vec::with_capacity(1024);
    let mut chunk = [0u8; 1024];
    // The first line is all we need; stop at its end, with a cap on size.
    while buf.len() < 8192 && !buf.contains(&b'\n') {
        let n = stream.read(&mut chunk).await?;
        if n == 0 {
            break;
        }
        buf.extend_from_slice(&chunk[..n]);
    }
    let text = String::from_utf8_lossy(&buf);
    Ok(text.lines().next().map(str::to_string).filter(|l| !l.is_empty()))
}

async fn respond(stream: &mut TcpStream, status: u16, title: &str, message: &str) {
    let reason = match status {
        200 => "OK",
        400 => "Bad Request",
        _ => "Not Found",
    };
    let body = format!(
        "<!doctype html><html><head><meta charset=\"utf-8\"><title>Lumen</title>\
         <meta name=\"color-scheme\" content=\"light dark\">\
         <style>body{{font:15px -apple-system,system-ui,sans-serif;display:grid;place-items:center;height:100vh;margin:0}}\
         main{{text-align:center}}h1{{font-size:20px;margin:0 0 8px}}p{{margin:0;opacity:.65}}</style></head>\
         <body><main><h1>{title}</h1><p>{message}</p></main></body></html>"
    );
    let reply = format!(
        "HTTP/1.1 {status} {reason}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    // The browser may have gone already; nothing to do about it.
    let _ = stream.write_all(reply.as_bytes()).await;
    let _ = stream.shutdown().await;
}

async fn exchange(
    client: &GoogleClient,
    code: &str,
    verifier: &str,
    redirect: &str,
) -> Result<String, GoogleError> {
    #[derive(serde::Deserialize)]
    struct Tokens {
        id_token: Option<String>,
        error: Option<String>,
        error_description: Option<String>,
    }
    let body = url::form_urlencoded::Serializer::new(String::new())
        .append_pair("code", code)
        .append_pair("client_id", &client.id)
        .append_pair("client_secret", &client.secret)
        .append_pair("code_verifier", verifier)
        .append_pair("grant_type", "authorization_code")
        .append_pair("redirect_uri", redirect)
        .finish();
    let response = reqwest::Client::new()
        .post(TOKEN_ENDPOINT)
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(body)
        .send()
        .await
        .map_err(|_| GoogleError::Network)?;
    let tokens: Tokens = response.json().await.map_err(|_| GoogleError::Network)?;
    if let Some(error) = tokens.error {
        return Err(GoogleError::Google(tokens.error_description.unwrap_or(error)));
    }
    tokens.id_token.ok_or(GoogleError::NoIdToken)
}

fn random_urlsafe(bytes: usize) -> String {
    let mut buf = vec![0u8; bytes];
    rand::rng().fill(buf.as_mut_slice());
    URL_SAFE_NO_PAD.encode(buf)
}

/// PKCE S256: base64url(sha256(verifier)), no padding.
fn challenge(verifier: &str) -> String {
    URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()))
}

fn auth_url(client_id: &str, redirect: &str, challenge: &str, state: &str) -> String {
    let mut url = Url::parse(AUTH_ENDPOINT).expect("a constant URL parses");
    url.query_pairs_mut()
        .append_pair("client_id", client_id)
        .append_pair("redirect_uri", redirect)
        .append_pair("response_type", "code")
        .append_pair("scope", "openid email profile")
        .append_pair("code_challenge", challenge)
        .append_pair("code_challenge_method", "S256")
        .append_pair("state", state)
        .append_pair("prompt", "select_account");
    url.into()
}

#[derive(Debug, PartialEq, Eq)]
enum Callback {
    Code(String),
    Error(String),
    /// A callback whose `state` isn't ours.
    BadState,
    /// Anything else: a favicon, a stray request.
    Other,
}

/// Read Google's redirect from the request line (`GET /?code=…&state=… HTTP/1.1`).
fn parse_callback(request_line: &str, expected_state: &str) -> Callback {
    let mut parts = request_line.split_whitespace();
    let (Some("GET"), Some(target)) = (parts.next(), parts.next()) else {
        return Callback::Other;
    };
    let Ok(url) = Url::parse(&format!("http://127.0.0.1{target}")) else {
        return Callback::Other;
    };
    if url.path() != "/" {
        return Callback::Other;
    }
    let param = |key: &str| url.query_pairs().find(|(k, _)| k == key).map(|(_, v)| v.into_owned());
    if param("code").is_none() && param("error").is_none() {
        return Callback::Other;
    }
    if param("state").as_deref() != Some(expected_state) {
        return Callback::BadState;
    }
    match (param("error"), param("code")) {
        (Some(error), _) => Callback::Error(error),
        (None, Some(code)) => Callback::Code(code),
        (None, None) => Callback::Other,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn challenge_matches_the_rfc_7636_example() {
        // RFC 7636, appendix B.
        assert_eq!(
            challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
            "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
        );
    }

    #[test]
    fn verifier_is_long_enough_and_url_safe() {
        let v = random_urlsafe(32);
        assert_eq!(v.len(), 43);
        assert!(v.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_'));
        assert_ne!(v, random_urlsafe(32));
    }

    #[test]
    fn reads_the_code() {
        assert_eq!(
            parse_callback("GET /?code=4%2F0abc&state=xyz&scope=openid HTTP/1.1", "xyz"),
            Callback::Code("4/0abc".into())
        );
    }

    #[test]
    fn reads_an_error() {
        assert_eq!(
            parse_callback("GET /?error=access_denied&state=xyz HTTP/1.1", "xyz"),
            Callback::Error("access_denied".into())
        );
    }

    #[test]
    fn refuses_another_state() {
        assert_eq!(parse_callback("GET /?code=c&state=other HTTP/1.1", "xyz"), Callback::BadState);
        assert_eq!(parse_callback("GET /?code=c HTTP/1.1", "xyz"), Callback::BadState);
    }

    #[test]
    fn ignores_everything_else() {
        assert_eq!(parse_callback("GET /favicon.ico HTTP/1.1", "xyz"), Callback::Other);
        assert_eq!(parse_callback("GET / HTTP/1.1", "xyz"), Callback::Other);
        assert_eq!(parse_callback("POST /?code=c&state=xyz HTTP/1.1", "xyz"), Callback::Other);
        assert_eq!(parse_callback("", "xyz"), Callback::Other);
    }

    #[test]
    fn consent_url_has_what_google_needs() {
        let url = Url::parse(&auth_url("id.apps", "http://127.0.0.1:5000", "chal", "st")).unwrap();
        let q: std::collections::HashMap<_, _> = url.query_pairs().collect();
        assert_eq!(url.host_str(), Some("accounts.google.com"));
        assert_eq!(q["client_id"], "id.apps");
        assert_eq!(q["redirect_uri"], "http://127.0.0.1:5000");
        assert_eq!(q["response_type"], "code");
        assert_eq!(q["scope"], "openid email profile");
        assert_eq!(q["code_challenge"], "chal");
        assert_eq!(q["code_challenge_method"], "S256");
        assert_eq!(q["state"], "st");
        assert_eq!(q["prompt"], "select_account");
    }
}
