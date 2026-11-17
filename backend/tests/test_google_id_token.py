"""Google ID token verification through the public function, with real google-auth checks.

Only the cert fetch is faked. google-auth still verifies the RSA signature,
expiry, and audience itself.
"""

import datetime
import json
import time

import pytest
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID
from google.auth import jwt as google_jwt
from google.auth.crypt import RSASigner

from app.core import security

KEY_ID = "test-kid"
WEB_CLIENT_ID = "web-client.apps.googleusercontent.com"
DESKTOP_CLIENT_ID = "desktop-client.apps.googleusercontent.com"
OTHER_CLIENT_ID = "other-client.apps.googleusercontent.com"


@pytest.fixture(scope="module")
def signing_material():
  key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
  private_pem = key.private_bytes(
    serialization.Encoding.PEM,
    serialization.PrivateFormat.PKCS8,
    serialization.NoEncryption(),
  ).decode("ascii")

  name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "test-google-signer")])
  now = datetime.datetime.now(datetime.timezone.utc)
  cert = (
    x509.CertificateBuilder()
    .subject_name(name)
    .issuer_name(name)
    .public_key(key.public_key())
    .serial_number(x509.random_serial_number())
    .not_valid_before(now - datetime.timedelta(days=1))
    .not_valid_after(now + datetime.timedelta(days=1))
    .sign(key, hashes.SHA256())
  )
  cert_pem = cert.public_bytes(serialization.Encoding.PEM).decode("ascii")
  return private_pem, cert_pem


@pytest.fixture
def fake_certs_endpoint(monkeypatch, signing_material):
  """Replace the transport google-auth uses to fetch Google's public certs."""
  _, cert_pem = signing_material
  body = json.dumps({KEY_ID: cert_pem}).encode("utf-8")

  class FakeResponse:
    status = 200
    data = body

  def fake_request(url, method="GET", **kwargs):
    return FakeResponse()

  monkeypatch.setattr(security.google_requests, "Request", lambda: fake_request)


def _mint(signing_material, aud, iss="https://accounts.google.com"):
  private_pem, _ = signing_material
  signer = RSASigner.from_string(private_pem, key_id=KEY_ID)
  now = int(time.time())
  payload = {
    "iss": iss,
    "aud": aud,
    "sub": "1234567890",
    "email": "ada@example.com",
    "name": "Ada Lovelace",
    "iat": now,
    "exp": now + 3600,
  }
  return google_jwt.encode(signer, payload).decode("ascii")


@pytest.fixture
def configure_audiences(monkeypatch):
  def _configure(web: str, desktop: str):
    monkeypatch.setattr(security.settings, "GOOGLE_CLIENT_ID", web)
    monkeypatch.setattr(security.settings, "GOOGLE_DESKTOP_CLIENT_ID", desktop)

  return _configure


def test_web_audience_token_is_accepted(
  signing_material, fake_certs_endpoint, configure_audiences
):
  configure_audiences(web=WEB_CLIENT_ID, desktop="")
  token = _mint(signing_material, aud=WEB_CLIENT_ID)

  info = security.verify_google_id_token(token)

  assert info["sub"] == "1234567890"
  assert info["email"] == "ada@example.com"
  assert info["name"] == "Ada Lovelace"


def test_desktop_audience_token_is_accepted_when_desktop_id_is_set(
  signing_material, fake_certs_endpoint, configure_audiences
):
  configure_audiences(web=WEB_CLIENT_ID, desktop=DESKTOP_CLIENT_ID)
  token = _mint(signing_material, aud=DESKTOP_CLIENT_ID)

  info = security.verify_google_id_token(token)

  assert info["email"] == "ada@example.com"


def test_desktop_audience_token_is_rejected_when_desktop_id_is_empty(
  signing_material, fake_certs_endpoint, configure_audiences
):
  configure_audiences(web=WEB_CLIENT_ID, desktop="")
  token = _mint(signing_material, aud=DESKTOP_CLIENT_ID)

  with pytest.raises(ValueError, match="wrong audience"):
    security.verify_google_id_token(token)


def test_token_for_unknown_audience_is_rejected(
  signing_material, fake_certs_endpoint, configure_audiences
):
  configure_audiences(web=WEB_CLIENT_ID, desktop=DESKTOP_CLIENT_ID)
  token = _mint(signing_material, aud=OTHER_CLIENT_ID)

  with pytest.raises(ValueError, match="wrong audience"):
    security.verify_google_id_token(token)


def test_nothing_configured_raises(
  signing_material, fake_certs_endpoint, configure_audiences
):
  configure_audiences(web="", desktop="")
  token = _mint(signing_material, aud=WEB_CLIENT_ID)

  with pytest.raises(ValueError, match="GOOGLE_CLIENT_ID is not configured"):
    security.verify_google_id_token(token)
