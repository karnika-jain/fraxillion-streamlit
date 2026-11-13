"""Unit tests for core.graph detectors and PyVis handshake."""

from __future__ import annotations

import sqlite3

from core.graph import (
    build_graph,
    fan_in,
    fan_out,
    get_case_graph_html,
    pass_through,
)


def test_fan_out_detector() -> None:
    txns = [
        {
            "txn_id": f"T{i}",
            "ts": f"2026-11-09 23:{10 + i * 5:02d}:00",
            "from_account": "MULE_1",
            "to_account": f"B_{i}",
            "amount": 5000.0,
        }
        for i in range(6)
    ]
    G = build_graph(txns)
    hits = fan_out(G, "MULE_1", window_minutes=60, k=5)
    assert len(hits) >= 1
    assert hits[0]["target_count"] == 6


def test_fan_in_detector() -> None:
    txns = [
        {
            "txn_id": f"TI{i}",
            "ts": f"2026-11-09 14:{i * 3:02d}:00",
            "from_account": f"SRC_{i}",
            "to_account": "COLL_1",
            "amount": 2000.0,
        }
        for i in range(10)
    ]
    G = build_graph(txns)
    hits = fan_in(G, "COLL_1", window_hours=24, k=10)
    assert len(hits) == 1
    assert hits[0]["source_count"] == 10


def test_pass_through_detector() -> None:
    txns = [
        {
            "txn_id": "TIN",
            "ts": "2026-11-09 10:00:00",
            "from_account": "FEEDER",
            "to_account": "MULE_PT",
            "amount": 100000.0,
        },
        {
            "txn_id": "TOUT",
            "ts": "2026-11-09 11:00:00",
            "from_account": "MULE_PT",
            "to_account": "EXIT_1",
            "amount": 92000.0,
        },
    ]
    G = build_graph(txns)
    res = pass_through(G, "MULE_PT", hours=24, ratio=0.80)
    assert res is not None
    assert res["is_pass_through"] is True
    assert res["ratio"] == 0.92


def test_get_case_graph_html_contract() -> None:
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.executescript(
        """
        CREATE TABLE transactions (
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
        CREATE TABLE alerts (
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
        CREATE TABLE cases (
            case_id TEXT PRIMARY KEY,
            title TEXT,
            status TEXT DEFAULT 'NEW',
            severity TEXT,
            amount REAL,
            shared_keys TEXT,
            created_at TEXT
        );
        CREATE TABLE case_alerts (
            case_id TEXT,
            alert_id TEXT,
            PRIMARY KEY (case_id, alert_id)
        );
        """
    )
    conn.execute(
        "INSERT INTO transactions VALUES ('T1', '2026-11-09 23:40:00', 'A0199', 'A0010', 'b@okaxis', 9800.0, 'UPI', 'D0099', 'Mumbai', 1)"
    )
    conn.execute(
        "INSERT INTO alerts VALUES ('AL1', 'T1', 'A0199', 'D0099', 'b@okaxis', 'FAN_OUT', 'HIGH', 0.92, 'Fan out', '2026-11-09 23:41:00', 1, 'k1')"
    )
    conn.execute(
        "INSERT INTO cases VALUES ('CS-2026-0001', 'Mule Ring', 'NEW', 'HIGH', 9800.0, 'acct:A0199', '2026-11-09 23:42:00')"
    )
    conn.execute("INSERT INTO case_alerts VALUES ('CS-2026-0001', 'AL1')")
    conn.commit()

    try:
        html_str = get_case_graph_html("CS-2026-0001", conn=conn)
        assert isinstance(html_str, str)
        assert "<html" in html_str.lower()
        assert "A0199" in html_str
        assert "A0010" in html_str
    finally:
        conn.close()
