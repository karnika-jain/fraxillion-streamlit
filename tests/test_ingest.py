"""Unit tests for Alert & Transaction Ingestion Engine (Segment 1).

Tests:
1. test_rejects_negative_amount
2. test_dedupe_same_alert_twice
"""

from datetime import datetime
from pathlib import Path
import sqlite3
import tempfile
import pytest

from core.ingest import ingest_alerts, ingest_transactions


@pytest.fixture
def temp_db():
    """Create isolated temporary SQLite database with raw_events, alerts, and transactions tables."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tf:
        db_path = tf.name

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS raw_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source TEXT,
            payload_json TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS alerts (
            alert_id TEXT PRIMARY KEY,
            txn_id TEXT,
            account_id TEXT,
            device_id TEXT,
            to_vpa TEXT,
            rule TEXT,
            severity TEXT,
            score REAL,
            reason TEXT,
            ts TEXT,
            is_fraud INTEGER DEFAULT 0,
            dedupe_key TEXT UNIQUE
        );

        CREATE TABLE IF NOT EXISTS transactions (
            txn_id TEXT PRIMARY KEY,
            ts TEXT,
            from_account TEXT,
            to_account TEXT,
            to_vpa TEXT,
            amount REAL,
            channel TEXT,
            device_id TEXT,
            city TEXT,
            is_fraud INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            actor TEXT,
            action TEXT,
            object_type TEXT,
            object_id TEXT,
            details TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );
        """
    )
    yield conn
    conn.close()
    try:
        Path(db_path).unlink(missing_ok=True)
    except Exception:
        pass


def test_rejects_negative_amount(temp_db):
    """Assert transaction with negative or zero amount is rejected with a clear diagnostic message."""
    bad_rows = [
        {
            "txn_id": "T_NEG_001",
            "ts": datetime.now().isoformat(),
            "from_account": "A0001",
            "to_account": "A0002",
            "to_vpa": "user@okaxis",
            "amount": -500.0,  # Negative amount
            "channel": "UPI",
            "device_id": "D0001",
            "city": "Mumbai",
            "is_fraud": 0,
        },
        {
            "txn_id": "T_ZERO_002",
            "ts": datetime.now().isoformat(),
            "from_account": "A0001",
            "to_account": "A0002",
            "to_vpa": "user@okaxis",
            "amount": 0.0,  # Zero amount
            "channel": "UPI",
            "device_id": "D0001",
            "city": "Mumbai",
            "is_fraud": 0,
        },
        {
            "txn_id": "T_VALID_003",
            "ts": datetime.now().isoformat(),
            "from_account": "A0001",
            "to_account": "A0002",
            "to_vpa": "user@okaxis",
            "amount": 1500.0,  # Valid positive amount
            "channel": "UPI",
            "device_id": "D0001",
            "city": "Mumbai",
            "is_fraud": 0,
        },
    ]

    res = ingest_transactions(bad_rows, temp_db)
    assert res["received"] == 3
    assert res["accepted"] == 1
    assert len(res["rejected"]) == 2

    # Check database only stored the valid transaction
    txns = temp_db.execute("SELECT txn_id FROM transactions").fetchall()
    assert len(txns) == 1
    assert txns[0]["txn_id"] == "T_VALID_003"


def test_dedupe_same_alert_twice(temp_db):
    """Assert ingesting the same alert twice accepts it on the first call and marks as duplicate on the second."""
    alert_row = {
        "alert_id": "AL_TEST_001",
        "txn_id": "T000001",
        "account_id": "A0181",
        "device_id": "D0080",
        "to_vpa": "mule@okaxis",
        "rule": "FAN_OUT_5_IN_10MIN",
        "severity": "HIGH",
        "score": 0.95,
        "reason": "Rapid outbound transfers",
        "ts": datetime.now().isoformat(),
        "is_fraud": 1,
    }

    # First ingest: accepted
    res1 = ingest_alerts([alert_row], temp_db)
    assert res1["received"] == 1
    assert res1["accepted"] == 1
    assert res1["duplicates"] == 0
    assert len(res1["rejected"]) == 0

    # Second ingest of exact same alert: duplicate
    res2 = ingest_alerts([alert_row], temp_db)
    assert res2["received"] == 1
    assert res2["accepted"] == 0
    assert res2["duplicates"] == 1
    assert len(res2["rejected"]) == 0

    # Database still has exactly 1 alert row
    alerts = temp_db.execute("SELECT alert_id FROM alerts").fetchall()
    assert len(alerts) == 1
