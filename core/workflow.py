"""Investigation and Decision Workflow Engine for Fraxillion (Segment 6).

Implements a formal finite state machine for case progression,
maker-checker governance for investigation decisions, and chronological audit trail logging.
"""

from datetime import datetime
import sqlite3
from typing import Any

# Formal Case State Machine
ALLOWED = {
    "NEW": ["TRIAGE"],
    "TRIAGE": ["INVESTIGATING", "CLOSED"],
    "INVESTIGATING": ["DECIDED"],
    "DECIDED": ["FILED", "CLOSED"],
    "FILED": [],
    "CLOSED": [],
}


def transition(
    conn: sqlite3.Connection,
    case_id: str,
    new_state: str,
    actor: str,
    reason: str = "",
) -> str:
    """Transition a case to a new state following the ALLOWED state machine.

    Raises:
        ValueError: If the transition is illegal under the state machine.
    """
    cur = conn.execute("SELECT status FROM cases WHERE case_id=?", (case_id,))
    row = cur.fetchone()
    if not row:
        raise ValueError(f"Case '{case_id}' does not exist.")

    old_state = row["status"]
    allowed_next = ALLOWED.get(old_state, [])
    if new_state not in allowed_next:
        raise ValueError(
            f"Illegal state transition: '{old_state}' -> '{new_state}'. "
            f"Allowed transitions from '{old_state}' are: {allowed_next}."
        )

    now_iso = datetime.now().isoformat()
    conn.execute("UPDATE cases SET status=? WHERE case_id=?", (new_state, case_id))

    # Log transition in audit trail
    details = f"{old_state} -> {new_state}" + (f": {reason}" if reason else "")
    conn.execute(
        """
        INSERT INTO audit_log (actor, action, object_type, object_id, details, created_at)
        VALUES (?, 'TRANSITION', 'CASE', ?, ?, ?)
        """,
        (actor.strip() or "SYSTEM", case_id, details, now_iso),
    )
    conn.commit()
    return new_state


def create_decision(
    conn: sqlite3.Connection,
    case_id: str,
    decision_type: str,
    grounds: str,
    rationale: str,
    maker: str,
    evidence_refs: str = "",
) -> int:
    """Create a proposed decision awaiting checker review.

    Args:
        conn: SQLite connection.
        case_id: Target case ID.
        decision_type: One of CLOSE, MONITOR, FILE_CPFIR, FILE_STR.
        grounds: Grounds of suspicion (e.g., LAYERING, PROFILE_MISMATCH).
        rationale: Explanatory justification (must be at least 30 characters).
        maker: Investigator username proposing the decision.
        evidence_refs: Associated evidence IDs.

    Returns:
        int: Created decision ID.
    """
    valid_types = ["CLOSE", "MONITOR", "FILE_CPFIR", "FILE_STR"]
    if decision_type not in valid_types:
        raise ValueError(f"Invalid decision_type '{decision_type}'. Must be one of {valid_types}.")

    cleaned_rationale = (rationale or "").strip()
    if len(cleaned_rationale) < 30:
        raise ValueError(
            f"Decision rationale must be at least 30 characters long (currently {len(cleaned_rationale)})."
        )

    full_grounds = grounds.strip()
    if evidence_refs:
        full_grounds = f"{full_grounds} (Evidence: {evidence_refs})"

    now_iso = datetime.now().isoformat()
    maker_clean = (maker or "student").strip()

    cur = conn.execute(
        """
        INSERT INTO decisions (case_id, decision_type, grounds, rationale, maker, status, created_at)
        VALUES (?, ?, ?, ?, ?, 'PENDING', ?)
        """,
        (case_id, decision_type, full_grounds, cleaned_rationale, maker_clean, now_iso),
    )
    decision_id = cur.lastrowid

    # Log in audit log
    conn.execute(
        """
        INSERT INTO audit_log (actor, action, object_type, object_id, details, created_at)
        VALUES (?, 'CREATE_DECISION', 'CASE', ?, ?, ?)
        """,
        (
            maker_clean,
            case_id,
            f"Decision #{decision_id} ({decision_type}) proposed by maker '{maker_clean}'.",
            now_iso,
        ),
    )
    conn.commit()
    return decision_id


def approve(conn: sqlite3.Connection, decision_id: int, checker: str) -> dict[str, Any]:
    """Approve a pending decision enforcing the Maker-Checker / Four-Eyes principle.

    Maker and checker must be distinct users (case-insensitive check).
    """
    cur = conn.execute("SELECT * FROM decisions WHERE id=?", (decision_id,))
    row = cur.fetchone()
    if not row:
        raise ValueError(f"Decision #{decision_id} not found.")

    if row["status"] != "PENDING":
        raise ValueError(f"Decision #{decision_id} is already {row['status']}.")

    maker = row["maker"]
    checker_clean = (checker or "").strip()
    if not checker_clean:
        raise ValueError("Checker username cannot be empty.")

    # Maker-Checker Rule Enforcement
    if checker_clean.lower() == maker.lower():
        raise ValueError(
            f"Maker-Checker Violation: Maker ('{maker}') and Checker ('{checker_clean}') "
            f"must be different individuals. You cannot approve your own decision."
        )

    now_iso = datetime.now().isoformat()
    conn.execute(
        "UPDATE decisions SET checker=?, status='APPROVED', decided_at=? WHERE id=?",
        (checker_clean, now_iso, decision_id),
    )

    case_id = row["case_id"]
    decision_type = row["decision_type"]

    # Check case status and transition accordingly
    case_row = conn.execute("SELECT status FROM cases WHERE case_id=?", (case_id,)).fetchone()
    case_status = case_row["status"] if case_row else "INVESTIGATING"

    if decision_type == "CLOSE":
        if case_status == "INVESTIGATING":
            transition(conn, case_id, "DECIDED", actor=checker_clean, reason="Decision approved")
            transition(conn, case_id, "CLOSED", actor=checker_clean, reason="Case closed")
        elif case_status in ("TRIAGE", "DECIDED"):
            transition(conn, case_id, "CLOSED", actor=checker_clean, reason="Case closed")
    else:
        # Move to DECIDED if currently INVESTIGATING
        if case_status == "INVESTIGATING":
            transition(conn, case_id, "DECIDED", actor=checker_clean, reason=f"Decision {decision_type} approved")

    # Record approval in audit log
    conn.execute(
        """
        INSERT INTO audit_log (actor, action, object_type, object_id, details, created_at)
        VALUES (?, 'APPROVE_DECISION', 'CASE', ?, ?, ?)
        """,
        (
            checker_clean,
            case_id,
            f"Decision #{decision_id} ({decision_type}) approved by checker '{checker_clean}'.",
            now_iso,
        ),
    )
    conn.commit()
    return {"decision_id": decision_id, "status": "APPROVED", "checker": checker_clean}


def reject(conn: sqlite3.Connection, decision_id: int, checker: str, reason: str = "") -> dict[str, Any]:
    """Reject a pending decision."""
    cur = conn.execute("SELECT * FROM decisions WHERE id=?", (decision_id,))
    row = cur.fetchone()
    if not row:
        raise ValueError(f"Decision #{decision_id} not found.")

    checker_clean = (checker or "").strip() or "reviewer"
    now_iso = datetime.now().isoformat()

    updated_rationale = (row["rationale"] or "") + (f" | REJECTED: {reason}" if reason else "")
    conn.execute(
        "UPDATE decisions SET checker=?, status='REJECTED', decided_at=?, rationale=? WHERE id=?",
        (checker_clean, now_iso, updated_rationale, decision_id),
    )

    case_id = row["case_id"]
    conn.execute(
        """
        INSERT INTO audit_log (actor, action, object_type, object_id, details, created_at)
        VALUES (?, 'REJECT_DECISION', 'CASE', ?, ?, ?)
        """,
        (
            checker_clean,
            case_id,
            f"Decision #{decision_id} rejected by '{checker_clean}': {reason}",
            now_iso,
        ),
    )
    conn.commit()
    return {"decision_id": decision_id, "status": "REJECTED", "checker": checker_clean}


def mark_filed(conn: sqlite3.Connection, case_id: str, actor: str) -> str:
    """Move a DECIDED case to FILED after regulatory reports are generated."""
    return transition(conn, case_id, "FILED", actor=actor, reason="Regulatory reporting completed")


def get_audit_log(conn: sqlite3.Connection, case_id: str) -> list[dict[str, Any]]:
    """Return the chronological audit trail entries relating to a case."""
    cur = conn.execute(
        """
        SELECT id, actor, action, object_type, object_id, details, created_at
        FROM audit_log
        WHERE object_id=? OR details LIKE ?
        ORDER BY id ASC
        """,
        (case_id, f"%{case_id}%"),
    )
    return [dict(r) for r in cur.fetchall()]
