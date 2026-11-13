"""Unit tests for Investigation and Decision Workflow (Segment 6).

Verifies the Finite State Machine transitions, illegal transition blocking,
and the Four-Eyes Maker-Checker principle.
"""

import sqlite3
import pytest

from core.db import init_db
from core.workflow import (
    approve,
    create_decision,
    get_audit_log,
    mark_filed,
    reject,
    transition,
)


@pytest.fixture
def db_conn():
    """Create an in-memory SQLite database initialized with Fraxillion schema."""
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    init_db(conn)
    # Insert a test case
    conn.execute(
        "INSERT INTO cases (case_id, title, status, severity, amount) "
        "VALUES ('CS-TEST-0001', 'Test Syndicate', 'NEW', 'HIGH', 50000.0)"
    )
    conn.commit()
    yield conn
    conn.close()


def test_legal_state_machine_transitions(db_conn):
    """Test that a case cleanly transitions through NEW -> TRIAGE -> INVESTIGATING."""
    # 1. NEW -> TRIAGE
    st1 = transition(db_conn, "CS-TEST-0001", "TRIAGE", actor="analyst_1", reason="Initial triage")
    assert st1 == "TRIAGE"

    # 2. TRIAGE -> INVESTIGATING
    st2 = transition(db_conn, "CS-TEST-0001", "INVESTIGATING", actor="analyst_1", reason="Commence investigation")
    assert st2 == "INVESTIGATING"


def test_illegal_state_transition_is_blocked(db_conn):
    """Test that skipping states (e.g. NEW directly to FILED or DECIDED) is strictly blocked."""
    with pytest.raises(ValueError, match="Illegal state transition"):
        transition(db_conn, "CS-TEST-0001", "FILED", actor="analyst_1")

    with pytest.raises(ValueError, match="Illegal state transition"):
        transition(db_conn, "CS-TEST-0001", "DECIDED", actor="analyst_1")


def test_decision_rationale_minimum_length(db_conn):
    """Test that a short rationale (< 30 characters) is rejected."""
    with pytest.raises(ValueError, match="at least 30 characters"):
        create_decision(
            conn=db_conn,
            case_id="CS-TEST-0001",
            decision_type="FILE_STR",
            grounds="RAPID_FAN_OUT",
            rationale="Too short note.",
            maker="student",
        )


def test_maker_checker_violation_blocked(db_conn):
    """Test that a maker cannot approve their own decision (Four-Eyes principle)."""
    # Create valid decision
    dec_id = create_decision(
        conn=db_conn,
        case_id="CS-TEST-0001",
        decision_type="FILE_STR",
        grounds="RAPID_FAN_OUT",
        rationale="Account received rapid funds and transferred 95% out to 8 beneficiaries within 40 minutes.",
        maker="student",
    )

    # Attempt approval with same user (case-insensitive) -> must fail!
    with pytest.raises(ValueError, match="Maker-Checker Violation"):
        approve(db_conn, dec_id, checker="student")

    with pytest.raises(ValueError, match="Maker-Checker Violation"):
        approve(db_conn, dec_id, checker="  STUDENT ")


def test_maker_checker_approval_and_filing(db_conn):
    """Test that a different checker can approve, moving the case to DECIDED and then FILED."""
    # Transition case to INVESTIGATING first
    transition(db_conn, "CS-TEST-0001", "TRIAGE", actor="analyst_1")
    transition(db_conn, "CS-TEST-0001", "INVESTIGATING", actor="analyst_1")

    # Maker proposes decision
    dec_id = create_decision(
        conn=db_conn,
        case_id="CS-TEST-0001",
        decision_type="FILE_STR",
        grounds="RAPID_FAN_OUT",
        rationale="Comprehensive investigation confirms mule account layering across multiple unverified handles.",
        maker="student",
    )

    # Checker approves
    res = approve(db_conn, dec_id, checker="compliance_officer")
    assert res["status"] == "APPROVED"

    # Case should now be in DECIDED status
    case_row = db_conn.execute("SELECT status FROM cases WHERE case_id='CS-TEST-0001'").fetchone()
    assert case_row["status"] == "DECIDED"

    # Mark as FILED
    final_st = mark_filed(db_conn, "CS-TEST-0001", actor="compliance_officer")
    assert final_st == "FILED"

    # Verify audit log recorded the actions
    logs = get_audit_log(db_conn, "CS-TEST-0001")
    actions = [l["action"] for l in logs]
    assert "TRANSITION" in actions
    assert "CREATE_DECISION" in actions
    assert "APPROVE_DECISION" in actions
