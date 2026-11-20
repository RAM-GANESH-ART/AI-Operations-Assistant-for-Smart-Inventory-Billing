"""
Idempotency Service
AI Operations Assistant for Smart Inventory & Billing
GLA University – Semester 3 Main Project

Provides atomic claim-or-replay semantics for state-changing operations
(such as Point-of-Sale checkouts) in accordance with the API & Interface
Design specification:
- Accepts client-supplied Idempotency-Key header.
- Claims key atomically using PostgreSQL ON CONFLICT DO NOTHING to eliminate races.
- Hashes request payload to reject key reuse with altered payloads (HTTP 422).
- Returns cached responses for already completed requests (HTTP 200/201).
- Rejects concurrent in-flight duplicates with HTTP 409 Conflict.
- Cleans up failed attempts to allow clean retries.
"""

import hashlib
import json
import sys
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

SERVICES_DIR = Path(__file__).resolve().parent
DB_DIR = SERVICES_DIR.parent / "database"

if str(DB_DIR) not in sys.path:
    sys.path.insert(0, str(DB_DIR))

from connection import get_connection


class IdempotencyService:
    """Manages transactional idempotency keys and cached response payloads."""

    @staticmethod
    def init_table() -> None:
        """Create the idempotency_keys table if it does not already exist."""
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS idempotency_keys (
                        key VARCHAR(128) PRIMARY KEY,
                        request_hash VARCHAR(64) NOT NULL,
                        status VARCHAR(20) NOT NULL CHECK (
                            status IN ('IN_PROGRESS', 'SUCCEEDED', 'FAILED')
                        ),
                        response_code INTEGER,
                        response_body JSONB,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
                    );
                    CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created 
                        ON idempotency_keys(created_at);
                """)

    @staticmethod
    def compute_hash(payload: Dict[str, Any]) -> str:
        """Compute deterministic SHA-256 hash of a JSON-serializable dictionary."""
        serialized = json.dumps(payload, sort_keys=True, default=str)
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

    @classmethod
    def claim_or_fetch(
        cls, key: str, request_hash: str
    ) -> Tuple[str, Optional[Tuple[int, Dict[str, Any]]]]:
        """
        Atomically attempt to claim an idempotency key.
        
        Returns:
            ("CLAIMED", None) -> Caller has claimed the key and must process the request.
            ("SUCCEEDED", (response_code, response_body)) -> Already succeeded; replay cached response.
            ("IN_PROGRESS", None) -> Concurrent duplicate in-flight; reject with 409.
            ("MISMATCH", None) -> Reused with a different request payload; reject with 422.
        """
        # Ensure table exists
        cls.init_table()

        with get_connection() as conn:
            with conn.cursor() as cur:
                # 1. Attempt atomic insert
                cur.execute("""
                    INSERT INTO idempotency_keys (key, request_hash, status)
                    VALUES (%s, %s, 'IN_PROGRESS')
                    ON CONFLICT (key) DO NOTHING
                    RETURNING key;
                """, (key, request_hash))
                inserted = cur.fetchone()

                if inserted:
                    # Successfully claimed the key
                    return ("CLAIMED", None)

                # 2. Key exists: inspect existing state
                cur.execute("""
                    SELECT request_hash, status, response_code, response_body
                    FROM idempotency_keys
                    WHERE key = %s;
                """, (key,))
                existing = cur.fetchone()

                if not existing:
                    # Rare race where previous row was removed right after conflict
                    cur.execute("""
                        INSERT INTO idempotency_keys (key, request_hash, status)
                        VALUES (%s, %s, 'IN_PROGRESS')
                        ON CONFLICT (key) DO NOTHING
                        RETURNING key;
                    """, (key, request_hash))
                    second_try = cur.fetchone()
                    if second_try:
                        return ("CLAIMED", None)
                    return ("IN_PROGRESS", None)

                stored_hash, status, code, body = existing

                # Guard payload: check if body changed
                if stored_hash != request_hash:
                    return ("MISMATCH", None)

                if status == "SUCCEEDED":
                    return ("SUCCEEDED", (code, body))

                if status == "IN_PROGRESS":
                    return ("IN_PROGRESS", None)

                # If status == 'FAILED', allow retry by overwriting state to IN_PROGRESS
                cur.execute("""
                    UPDATE idempotency_keys
                    SET status = 'IN_PROGRESS', updated_at = CURRENT_TIMESTAMP
                    WHERE key = %s;
                """, (key,))
                return ("CLAIMED", None)

    @classmethod
    def save_success(cls, key: str, response_code: int, response_body: Dict[str, Any]) -> None:
        """Mark an idempotency key as SUCCEEDED and store the response payload."""
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE idempotency_keys
                    SET status = 'SUCCEEDED',
                        response_code = %s,
                        response_body = %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE key = %s;
                """, (response_code, json.dumps(response_body), key))

    @classmethod
    def remove_key(cls, key: str) -> None:
        """Remove a key on failure so subsequent attempts can be retried cleanly."""
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM idempotency_keys WHERE key = %s;", (key,))
