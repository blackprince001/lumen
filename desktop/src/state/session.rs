//! Who is signed in.
//!
//! At launch the app asks `/auth/refresh` (with the cookie saved in the
//! Keychain) for an access token, then `/auth/me` for the user. A 401 means
//! nobody is signed in; no answer at all is `Unreachable`, with a retry,
//! rather than a sign-in screen the user doesn't need.

use futures::{StreamExt as _, channel::mpsc::UnboundedReceiver};
use gpui::{App, AppContext as _, Context, Entity, Global, SharedString, Task};

use crate::{
    api::{Api, types::User},
    kit::net::ApiError,
};

#[derive(Debug, Clone)]
pub enum Session {
    Checking,
    SignedIn(User),
    SignedOut,
    Unreachable(ApiError),
}

pub struct SessionStore {
    pub state: Session,
    /// Why the last sign-in failed, shown on the sign-in screen.
    pub sign_in_error: Option<SharedString>,
    checking: Option<Task<()>>,
    _expiry: Task<()>,
}

struct GlobalSession(Entity<SessionStore>);
impl Global for GlobalSession {}

impl SessionStore {
    /// `expired` fires when the server refuses to renew a signed-in session.
    pub fn init(mut expired: UnboundedReceiver<()>, cx: &mut App) -> Entity<Self> {
        let store = cx.new(|cx| {
            let expiry = cx.spawn(async move |this: gpui::WeakEntity<SessionStore>, cx| {
                while expired.next().await.is_some() {
                    this.update(cx, |this, cx| this.expired(cx)).ok();
                }
            });
            let mut store = SessionStore {
                state: Session::Checking,
                sign_in_error: None,
                checking: None,
                _expiry: expiry,
            };
            store.check(cx);
            store
        });
        cx.set_global(GlobalSession(store.clone()));
        store
    }

    pub fn global(cx: &App) -> Entity<Self> {
        cx.global::<GlobalSession>().0.clone()
    }

    pub fn user(&self) -> Option<&User> {
        match &self.state {
            Session::SignedIn(user) => Some(user),
            _ => None,
        }
    }

    /// Find out who we are: refresh, then `/auth/me`.
    pub fn check(&mut self, cx: &mut Context<Self>) {
        if matches!(self.state, Session::SignedIn(_) | Session::Checking) && self.checking.is_some() {
            return;
        }
        self.state = Session::Checking;
        cx.notify();
        let api = Api::global(cx);
        self.checking = Some(cx.spawn(async move |this, cx| {
            let result = restore(&api).await;
            this.update(cx, |this, cx| {
                this.state = match result {
                    Ok(user) => Session::SignedIn(user),
                    Err(err) if err.is_status(401) || err.is_status(403) => Session::SignedOut,
                    Err(err) => Session::Unreachable(err),
                };
                this.checking = None;
                cx.notify();
            })
            .ok();
        }));
    }

    /// Finish a sign-in whose ID token Google just gave us.
    pub fn sign_in_google(&mut self, id_token: String, cx: &mut Context<Self>) -> Task<()> {
        let request = Api::global(cx).sign_in_google(id_token);
        cx.spawn(async move |this, cx| {
            let result = request.await;
            this.update(cx, |this, cx| match result {
                Ok(user) => this.set_user(user, cx),
                Err(err) => this.sign_in_failed(err.to_string().into(), cx),
            })
            .ok();
        })
    }

    /// Sign out here even when the server can't be reached; the refresh
    /// token just expires on its own.
    pub fn sign_out(&mut self, cx: &mut Context<Self>) {
        let request = Api::global(cx).sign_out();
        cx.spawn(async move |_, _| request.await).detach();
        self.state = Session::SignedOut;
        self.sign_in_error = None;
        cx.notify();
    }

    /// The server refused to renew the session underneath us.
    fn expired(&mut self, cx: &mut Context<Self>) {
        if matches!(self.state, Session::SignedIn(_)) {
            Api::global(cx).clear_session();
            self.state = Session::SignedOut;
            cx.notify();
        }
    }

    pub fn set_user(&mut self, user: User, cx: &mut Context<Self>) {
        self.state = Session::SignedIn(user);
        self.sign_in_error = None;
        cx.notify();
    }

    pub fn sign_in_failed(&mut self, message: SharedString, cx: &mut Context<Self>) {
        self.sign_in_error = Some(message);
        cx.notify();
    }

    pub fn clear_sign_in_error(&mut self, cx: &mut Context<Self>) {
        if self.sign_in_error.take().is_some() {
            cx.notify();
        }
    }
}

async fn restore(api: &Api) -> Result<User, ApiError> {
    match api.restore().await {
        Ok(()) => {}
        #[cfg(debug_assertions)]
        Err(err) if err.is_status(401) => {
            // Debug builds can sign in as the local admin instead.
            let Some((username, password)) = crate::config::dev_admin() else {
                return Err(err);
            };
            return api.sign_in_admin(username, password).await;
        }
        Err(err) => return Err(err),
    }
    api.get::<User>("auth/me").await
}
