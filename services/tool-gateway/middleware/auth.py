import hmac
import hashlib
import os

HMAC_SECRET = os.environ.get("AUTOMIT_HMAC_SECRET", "")


def verify_hmac(signature: str, payload: bytes) -> bool:
    if not signature or not HMAC_SECRET:
        return False
    expected = hmac.new(
        HMAC_SECRET.encode(), payload, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected)
