"""Unit tests for core.score and teammate handshake contract."""

from __future__ import annotations

import sqlite3

from core.score import score_case


def _create_test_db() -> sqlite3.Connection:
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

    # Normal daytime transaction for Case 2 (low risk)
    conn.execute(
        "INSERT INTO transactions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ("T_NORM", "2026-11-05 11:20:00", "A0001", "A0002", "u2@okaxis", 450.0, "UPI", "D0001", "Pune", 0),
    )
    conn.execute(
        "INSERT INTO alerts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ("AL_NORM", "T_NORM", "A0001", "D0001", "u2@okaxis", "NEW_BENEFICIARY", "LOW", 0.35, "First transfer", "2026-11-05 11:21:00", 0, "k0"),
    )
    conn.execute(
        "INSERT INTO cases VALUES (?, ?, ?, ?, ?, ?, ?)",
        ("CS-NORM", "Normal Test", "NEW", "LOW", 450.0, "acct:A0001", "2026-11-05 11:22:00"),
    )
    conn.execute("INSERT INTO case_alerts VALUES (?, ?)", ("CS-NORM", "AL_NORM"))

    # Mule fan-out at night with shared device across 3 accounts for Case 1 (high risk)
    for idx, src in enumerate(["A0197", "A0198", "A0199"]):
        conn.execute(
            "INSERT INTO transactions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                f"T_DEV_{idx}",
                f"2026-11-09 23:1{idx}:00",
                src,
                f"A00{idx+10}",
                f"b{idx}@okaxis",
                9000.0,
                "UPI",
                "D0099",
                "Mumbai",
                1,
            ),
        )

    for j in range(6):
        tid = f"T_MULE_{j}"
        aid = f"AL_MULE_{j}"
        conn.execute(
            "INSERT INTO transactions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                tid,
                f"2026-11-09 23:4{j}:00",
                "A0199",
                f"A01{j:02d}",
                f"benef{j}@okhdfcbank",
                10000.0,
                "UPI",
                "D0099",
                "Mumbai",
                1,
            ),
        )
        conn.execute(
            "INSERT INTO alerts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                aid,
                tid,
                "A0199",
                "D0099",
                f"benef{j}@okhdfcbank",
                "FAN_OUT_5_IN_10MIN",
                "HIGH",
                0.94,
                "Fan-out burst",
                f"2026-11-09 23:4{j}:30",
                1,
                f"km_{j}",
            ),
        )
        conn.execute("INSERT INTO case_alerts VALUES (?, ?)", ("CS-2026-0001", aid))

    conn.execute(
        "INSERT INTO cases VALUES (?, ?, ?, ?, ?, ?, ?)",
        ("CS-2026-0001", "Mule Ring", "NEW", "HIGH", 60000.0, "acct:A0199,dev:D0099", "2026-11-09 23:50:00"),
    )
    conn.commit()
    return conn


def test_score_case_contract_and_ranking() -> None:
    conn = _create_test_db()
    try:
        mule_res = score_case("CS-2026-0001", conn=conn)
        norm_res = score_case("CS-NORM", conn=conn)

        for res in (mule_res, norm_res):
            assert set(res.keys()) == {"score", "reasons", "model"}
            assert isinstance(res["score"], float)
            assert 0.0 <= res["score"] <= 1.0
            assert isinstance(res["reasons"], list)
            assert len(res["reasons"]) > 0
            assert res["model"] == "RandomForest"

        assert mule_res["score"] > 0.65
        assert mule_res["score"] > norm_res["score"]
    finally:
        conn.close()
