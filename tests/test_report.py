"""Unit tests for Regulatory Reporting (Segment 7).

Tests:
1. test_pfr_header_count_matches_rows
2. test_pfr_field_count_and_sanitization
3. test_str_validation_and_grounds_length
4. test_save_report_and_hash_fingerprint
"""

import sqlite3
import tempfile
from pathlib import Path
import pytest

from core.report import (
    PFR_FIELD_COUNT,
    build_case_object,
    render_pfr,
    render_str,
    save_report,
    validate_pfr,
    validate_str,
)


@pytest.fixture
def temp_db():
    """Create an isolated in-memory or temporary SQLite database with minimal schema."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tf:
        db_path = tf.name

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.executescript(
        """
        CREATE TABLE cases (
            case_id TEXT PRIMARY KEY,
            title TEXT,
            status TEXT DEFAULT 'NEW',
            severity TEXT,
            amount REAL,
            shared_keys TEXT,
            created_at TEXT
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
            is_fraud INTEGER DEFAULT 0
        );

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

        CREATE TABLE case_alerts (
            case_id TEXT,
            alert_id TEXT,
            PRIMARY KEY (case_id, alert_id)
        );

        CREATE TABLE decisions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            case_id TEXT,
            decision_type TEXT,
            grounds TEXT,
            rationale TEXT,
            maker TEXT,
            checker TEXT,
            status TEXT DEFAULT 'PENDING',
            created_at TEXT,
            decided_at TEXT
        );

        CREATE TABLE reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            case_id TEXT,
            regime TEXT,
            path TEXT,
            sha256 TEXT,
            created_at TEXT
        );

        CREATE TABLE audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            actor TEXT,
            action TEXT,
            object_type TEXT,
            object_id TEXT,
            details TEXT,
            created_at TEXT
        );
        """
    )

    # Seed test case CS-TEST-001
    conn.execute(
        "INSERT INTO cases (case_id, status, severity, amount) VALUES ('CS-TEST-001', 'DECIDED', 'HIGH', 28500.00)"
    )

    # Seed 3 transactions & alerts
    for i in range(1, 4):
        txn_id = f"T00000{i}"
        alert_id = f"AL000{i}"
        conn.execute(
            """
            INSERT INTO transactions (txn_id, ts, from_account, to_account, to_vpa, amount, channel, device_id, city, is_fraud)
            VALUES (?, '2026-11-09T23:40:00', 'A0181', ?, ?, 9500.00, 'UPI', 'D0080', 'Mumbai', 1)
            """,
            (txn_id, f"REC000{i}", f"benef{i}@okaxis"),
        )
        conn.execute(
            """
            INSERT INTO alerts (alert_id, txn_id, account_id, device_id, to_vpa, rule, severity, score, reason, ts, is_fraud)
            VALUES (?, ?, 'A0181', 'D0080', ?, 'FAN_OUT_5_IN_10MIN', 'HIGH', 0.95, 'Fan out', '2026-11-09T23:42:00', 1)
            """,
            (alert_id, txn_id, f"benef{i}@okaxis"),
        )
        conn.execute("INSERT INTO case_alerts (case_id, alert_id) VALUES ('CS-TEST-001', ?)", (alert_id,))

    conn.commit()
    yield conn
    conn.close()
    try:
        Path(db_path).unlink(missing_ok=True)
    except Exception:
        pass


def test_pfr_header_count_matches_rows(temp_db):
    """Assert PFR header count strictly matches the number of rendered transaction rows."""
    case_obj = build_case_object(temp_db, "CS-TEST-001")
    pfr_text = render_pfr(case_obj, flag="I")

    lines = pfr_text.strip().splitlines()
    header = lines[0]
    data_rows = lines[1:]

    # Assert header matches PFR:<flag>:<entity>:<DDMMYYYY>:<count>;
    assert header.startswith("PFR:I:010:")
    assert header.endswith(f":{len(data_rows)};")

    # Validate passes with 0 errors
    errors = validate_pfr(pfr_text)
    assert errors == []


def test_pfr_field_count_and_sanitization(temp_db):
    """Assert every row has exactly 48 fields and pipes inside fields are sanitized."""
    case_obj = build_case_object(temp_db, "CS-TEST-001")
    # Add a transaction with an unintended pipe
    case_obj["transactions"].append({
        "utr": "T999999",
        "date": "09112026",
        "time": "23:59:00",
        "amount": "5000.00",
        "instrument": "DEC",
        "system": "UPI",
        "channel": "MOB",
        "to_vpa": "bad|vpa@bank",
    })

    pfr_text = render_pfr(case_obj)
    lines = pfr_text.strip().splitlines()
    data_rows = lines[1:]

    for r in data_rows:
        fields = r.split("|")
        assert len(fields) == PFR_FIELD_COUNT

    # The pipe in bad|vpa@bank was replaced with a space
    assert "bad vpa@bank" in pfr_text
    assert validate_pfr(pfr_text) == []


def test_str_validation_and_grounds_length(temp_db):
    """Assert STR XML satisfies FIU-IND requirements and flags short grounds narrative."""
    case_obj = build_case_object(temp_db, "CS-TEST-001")
    str_xml = render_str(case_obj)

    # Valid STR
    assert validate_str(str_xml) == []

    # Force invalid short grounds
    case_obj["suspicion"]["grounds"] = "Suspicious money flow"
    short_str_xml = render_str(case_obj)
    errors = validate_str(short_str_xml)
    assert len(errors) >= 1
    assert "Grounds of Suspicion is too short" in errors[0]


def test_save_report_and_hash_fingerprint(temp_db):
    """Assert save_report exports file, records SHA-256 fingerprint and audit entry."""
    case_obj = build_case_object(temp_db, "CS-TEST-001")
    pfr_text = render_pfr(case_obj)

    res = save_report(temp_db, "CS-TEST-001", "PFR", pfr_text, actor="OFFICER_A")
    assert Path(res["path"]).exists()
    assert len(res["sha256"]) == 64

    # Check reports table
    row = temp_db.execute("SELECT * FROM reports WHERE id=?", (res["report_id"],)).fetchone()
    assert row["case_id"] == "CS-TEST-001"
    assert row["sha256"] == res["sha256"]

    # Check audit log
    audit = temp_db.execute("SELECT * FROM audit_log WHERE object_id='CS-TEST-001'").fetchall()
    assert len(audit) >= 1
    assert "GENERATE_REPORT" in [a["action"] for a in audit]
