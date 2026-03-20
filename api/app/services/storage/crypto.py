"""
Credential encryption/decryption using Fernet symmetric encryption.
OAuth tokens are encrypted at rest; the app SECRET_KEY is the key material.
"""

import base64
import hashlib
import json

from cryptography.fernet import Fernet


def _fernet(secret_key: str) -> Fernet:
    # Derive a 32-byte key from the app secret via SHA-256, then base64url-encode
    raw = hashlib.sha256(secret_key.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(raw))


def encrypt_credentials(creds: dict, secret_key: str) -> dict:
    """Encrypt a credentials dict. Returns {"_enc": "<ciphertext>"}."""
    f = _fernet(secret_key)
    cipher = f.encrypt(json.dumps(creds).encode()).decode()
    return {"_enc": cipher}


def decrypt_credentials(stored: dict, secret_key: str) -> dict:
    """Decrypt credentials. Pass-through if not encrypted (legacy/manual records)."""
    if "_enc" not in stored:
        return stored
    f = _fernet(secret_key)
    return json.loads(f.decrypt(stored["_enc"].encode()))
