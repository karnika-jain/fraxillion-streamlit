"""Unit tests for Alert Correlation Engine (Segment 2).

Tests:
1. test_hub_is_excluded: A key used by more than hub_threshold alerts must not merge them.
"""

from pathlib import Path
import sqlite3
import tempfile
import pytest

from core.correlate import correlate


@pytest.fixture
def temp_db():
    """Create isolated temporary SQLite database with alerts and transactions tables."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tf:
        db_path = tf.name

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.executescript(
        """
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
        """
    )
    yield conn
    conn.close()
    try:
        Path(db_path).unlink(missing_ok=True)
    except Exception:
        pass


def test_hub_is_excluded(temp_db):
    """Assert an attribute key shared by more than hub_threshold alerts is dropped as a hub

    and strictly DOES NOT merge unrelated alerts into a false giant cluster.
    """
    hub_vpa = "popular_merchant@okaxis"
    hub_threshold = 10

    # Insert 15 alerts that share the hub VPA, but each has a distinct account and distinct device
    for i in range(1, 16):
        aid = f"AL_HUB_{i:03d}"
        tid = f"TXN_HUB_{i:03d}"
        acct = f"USER_{i:03d}"
        dev = f"DEV_{i:03d}"

        temp_db.execute(
            """
            INSERT INTO transactions (txn_id, ts, from_account, to_account, to_vpa, amount, channel, device_id, city, is_fraud)
            VALUES (?, '2026-11-05T12:00:00', ?, 'MERCHANT', ?, 250.0, 'UPI', ?, 'Delhi', 0)
            """,
            (tid, acct, hub_vpa, dev),
        )
        temp_db.execute(
            """
            INSERT INTO alerts (alert_id, txn_id, account_id, device_id, to_vpa, rule, severity, score, reason, ts, is_fraud)
            VALUES (?, ?, ?, ?, ?, 'NEW_BENEFICIARY', 'LOW', 0.35, 'Merchant purchase', '2026-11-05T12:02:00', 0)
            """,
            (aid, tid, acct, dev, hub_vpa),
        )

    # Insert 3 legitimate fraud alerts that share an independent mule device (D_MULE_99)
    for j in range(1, 4):
        aid = f"AL_MULE_{j:03d}"
        tid = f"TXN_MULE_{j:03d}"
        temp_db.execute(
            """
            INSERT INTO transactions (txn_id, ts, from_account, to_account, to_vpa, amount, channel, device_id, city, is_fraud)
            VALUES (?, '2026-11-09T23:30:00', 'MULE_ACCT', 'BENEF', 'cashout@okaxis', 9000.0, 'UPI', 'D_MULE_99', 'Mumbai', 1)
            """,
            (tid,),
        )
        temp_db.execute(
            """
            INSERT INTO alerts (alert_id, txn_id, account_id, device_id, to_vpa, rule, severity, score, reason, ts, is_fraud)
            VALUES (?, ?, 'MULE_ACCT', 'D_MULE_99', 'cashout@okaxis', 'FAN_OUT_5_IN_10MIN', 'HIGH', 0.95, 'Mule fanout', '2026-11-09T23:32:00', 1)
            """,
            (aid, tid),
        )

    temp_db.commit()

    # Run correlation with hub_threshold = 10
    res = correlate(temp_db, hub_threshold=hub_threshold, max_case_size=30)

    # Check dropped hubs
    dropped_hubs = res["dropped_hubs"]
    assert len(dropped_hubs) == 1
    assert dropped_hubs[0]["key"] == f"vpa:{hub_vpa}"
    assert dropped_hubs[0]["alert_count"] == 15

    # Check candidates: The 15 hub alerts must NOT merge into a 15-alert cluster!
    # Only the 3 mule alerts sharing D_MULE_99 should form a candidate case.
    candidates = res["candidates"]
    assert len(candidates) == 1
    assert candidates[0]["alert_count"] == 3
    assert set(candidates[0]["alerts"]) == {"AL_MULE_001", "AL_MULE_002", "AL_MULE_003"}
    assert "dev:D_MULE_99" in candidates[0]["shared_keys"]
