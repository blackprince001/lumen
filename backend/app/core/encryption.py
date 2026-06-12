"""Symmetric encryption for sensitive data (API keys, etc.).

Uses Fernet (AES-128-CBC) with a key derived from the app's
JWT_SECRET_KEY to encrypt/decrypt values stored in the database.
"""

import base64
import hashlib

from cryptography.fernet import Fernet

from app.core.config import settings


def _get_fernet_key() -> bytes:
  """Derive a Fernet-compatible 32-byte key from JWT_SECRET_KEY."""
  raw = hashlib.sha256(settings.JWT_SECRET_KEY.encode()).digest()
  return base64.urlsafe_b64encode(raw)


_fernet = Fernet(_get_fernet_key())


def encrypt_value(value: str) -> str:
  """Encrypt a plaintext value.

  Args:
      value: Plaintext to encrypt

  Returns:
      URL-safe base64-encoded ciphertext
  """
  return _fernet.encrypt(value.encode()).decode()


def decrypt_value(encrypted: str) -> str:
  """Decrypt a previously encrypted value.

  Args:
      encrypted: Fernet ciphertext (URL-safe base64)

  Returns:
      Decrypted plaintext
  """
  return _fernet.decrypt(encrypted.encode()).decode()
