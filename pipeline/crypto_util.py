"""Decrypt values encrypted by the web app (AES-256-GCM, iv.tag.data hex)."""
from __future__ import annotations

import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def decrypt(stored: str) -> str:
    key = bytes.fromhex(os.environ["ENCRYPTION_KEY"])
    iv_h, tag_h, data_h = stored.split(".")
    aes = AESGCM(key)
    plaintext = aes.decrypt(bytes.fromhex(iv_h), bytes.fromhex(data_h) + bytes.fromhex(tag_h), None)
    return plaintext.decode("utf-8")
