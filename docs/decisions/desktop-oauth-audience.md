---
type: ADR
title: Accept a desktop OAuth client as a second Google audience
description: /auth/google accepts ID tokens for the web client and for an optional desktop OAuth client. The server still trusts only Google's signature, issuer and audience.
resource: backend/app/core/security.py
tags: [adr, backend, auth, google, desktop]
timestamp: 2026-11-17T00:00:00Z
---

# Context

The planned Lumen for Mac app signs in with Google's installed-app flow. It uses
PKCE and a loopback redirect, and gets its own Google ID token. That token's
`aud` is the desktop OAuth client ID, not the web client ID. The app then posts
the token to `/auth/google`, the same way the web app does.

`verify_google_id_token` only accepted `GOOGLE_CLIENT_ID`, so desktop tokens
were rejected.

# Decision

`GOOGLE_DESKTOP_CLIENT_ID` is an optional second audience. The verifier builds
a list of the configured client IDs, skips empty ones, and passes the list to
google-auth. A token is accepted when its `aud` matches either ID. Issuer
checks and the returned user fields are unchanged.

If neither ID is set, verification still fails with `GOOGLE_CLIENT_ID is not
configured`.

The desktop client secret ships inside the app, so it is not a secret. PKCE
protects the sign-in flow. The server does not use the desktop secret. It only
trusts Google's signature, the issuer, and the audience.

# Consequences

* One endpoint serves both clients. No new route or session state is needed.
* A desktop token is accepted only when the operator sets the desktop ID. An
  unset ID leaves the web-only behavior.
* Any app that holds the desktop client ID can get a valid ID token for its own
  sign-in. That is accepted. The token only proves the Google account, and the
  app does not get extra server permissions.
* The env var is added to the backend services in `docker-compose.dev.yml` and
  `docker-compose.prod.yml`. `docker-compose.tunnel.yml` does not pass it.

# Alternatives considered

* **Server-side hand-off route.** The desktop app would send an auth code to a
  new route such as `/auth/desktop/exchange`, and the server would exchange it
  with Google. Learning for Mac uses this shape. It was rejected for Lumen
  because Lumen already accepts ID tokens. A second audience is enough and adds
  no route, no code storage, and no client secret on the server.
