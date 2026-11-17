//! The sign-in screen: the logo and "Continue with Google".

use gpui::{
    Context, Entity, FontWeight, InteractiveElement, IntoElement, ObjectFit,
    ParentElement, Render, StatefulInteractiveElement, Styled, StyledImage as _, Task, Window,
    div, img, prelude::FluentBuilder, px,
};

use crate::{
    app::google,
    config,
    kit::{
        net::{spawn, spawn_cancellable},
        ui::{Spinner, Type},
    },
    state::session::SessionStore,
    theme::ActivePalette,
};

pub struct AuthView {
    session: Entity<SessionStore>,
    /// The sign-in in progress, if any. Dropping it cancels the wait and
    /// closes the loopback listener.
    pending: Option<Task<()>>,
}

impl AuthView {
    pub fn new(_: &mut Window, cx: &mut Context<Self>) -> Self {
        let session = SessionStore::global(cx);
        cx.observe(&session, |_, _, cx| cx.notify()).detach();
        Self { session, pending: None }
    }

    /// Start the Google flow, or cancel it if one is already waiting.
    fn continue_with_google(&mut self, cx: &mut Context<Self>) {
        if self.pending.take().is_some() {
            cx.notify();
            return;
        }
        let Some(client) = config::google_client() else { return };
        self.session.update(cx, |s, cx| s.clear_sign_in_error(cx));
        let session = self.session.clone();
        let begin = spawn(google::begin(client));
        self.pending = Some(cx.spawn(async move |this, cx| {
            let outcome = async {
                let flow = begin.await?;
                let url = flow.url();
                this.update(cx, |_, cx| cx.open_url(&url)).ok();
                spawn_cancellable(flow.complete()).await
            }
            .await;
            match outcome {
                Ok(id_token) => {
                    let task = session.update(cx, |s, cx| s.sign_in_google(id_token, cx));
                    task.await;
                }
                Err(err) => {
                    session.update(cx, |s, cx| s.sign_in_failed(err.to_string().into(), cx));
                }
            }
            this.update(cx, |this, cx| {
                this.pending = None;
                cx.notify();
            })
            .ok();
        }));
        cx.notify();
    }
}

impl Render for AuthView {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let t = *cx.palette();
        let configured = config::google_client().is_some();
        let waiting = self.pending.is_some();
        let error = self.session.read(cx).sign_in_error.clone();

        let button = div()
            .id("google")
            .role(gpui::Role::Button)
            .aria_label("Continue with Google")
            .h(px(36.))
            .w(px(260.))
            .flex()
            .items_center()
            .justify_center()
            .gap(px(10.))
            .rounded(px(7.))
            .border_1()
            .border_color(t.button_secondary_border)
            .bg(t.surface_raised)
            .text_color(t.text_primary)
            .chrome()
            .type_body()
            .font_weight(FontWeight::MEDIUM)
            .when(!configured, |el| el.opacity(0.5).cursor_not_allowed())
            .when(configured, |el| {
                el.cursor_pointer()
                    .hover(move |s| s.bg(t.hover))
                    .on_click(cx.listener(|this, _, _, cx| this.continue_with_google(cx)))
            })
            .child(if waiting {
                Spinner::new().size(px(16.)).into_any_element()
            } else {
                img("icons/google-color.svg").size(px(16.)).object_fit(ObjectFit::Contain).into_any_element()
            })
            .child("Continue with Google");

        div()
            .size_full()
            .bg(t.window_bg)
            .flex()
            .items_center()
            .justify_center()
            .child(
                div()
                    .w(px(320.))
                    .flex()
                    .flex_col()
                    .items_center()
                    .gap(px(14.))
                    .child(img("app/logo-128.png").size(px(64.)).object_fit(ObjectFit::Contain))
                    .child(
                        div()
                            .flex()
                            .flex_col()
                            .items_center()
                            .gap(px(4.))
                            .child(
                                div()
                                    .content()
                                    .type_heading()
                                    .font_weight(FontWeight::BOLD)
                                    .text_color(t.text_primary)
                                    .child("Lumen"),
                            )
                            .child(
                                div()
                                    .chrome()
                                    .type_body()
                                    .text_color(t.text_secondary)
                                    .child("Your personal research library"),
                            ),
                    )
                    .child(div().mt(px(10.)).child(button))
                    .when(waiting, |el| {
                        el.child(
                            div()
                                .type_small()
                                .text_color(t.text_secondary)
                                .child("Finish signing in in your browser. Click again to cancel."),
                        )
                    })
                    .when(!configured, |el| {
                        el.child(
                            div()
                                .type_small()
                                .text_center()
                                .text_color(t.text_secondary)
                                .child("Google sign-in isn’t set up in this build. It needs LUMEN_GOOGLE_CLIENT_ID and LUMEN_GOOGLE_CLIENT_SECRET."),
                        )
                    })
                    .children(error.map(|error| {
                        div()
                            .id("sign-in-error")
                            .role(gpui::Role::Alert)
                            .type_small()
                            .text_center()
                            .text_color(t.danger)
                            .child(error)
                    })),
            )
    }
}
