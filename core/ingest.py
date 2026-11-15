"""Ingestion and boundary validation engine for Fraxillion.

Ingests raw alerts and transactions, persists raw payloads for lineage,
validates schemas with Pydantic v2, and performs idempotent deduplication.
"""

from datetime import datetime
import hashlib
import json
import sqlite3
from typing import Any

from pydantic import ValidationError
from core.models import AlertIn, TransactionIn


def dedupe_key_alert(alert_id: str, account_id: str) -> str:
    """Compute deterministic SHA-256 deduplication key for alerts."""
    raw = f"{alert_id}|{account_id}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def ingest_alerts(rows: list[dict[str, Any]], conn: sqlite3.Connection) -> dict[str, Any]:
    """Ingest a batch of alert rows with raw capture, validation, and deduplication.

    Returns:
        dict: {"received": int, "accepted": int, "duplicates": int, "rejected": list[dict]}
    """
    received = len(rows)
    accepted = 0
    duplicates = 0
    rejected: list[dict[str, Any]] = []

    for i, raw_row in enumerate(rows):
        # 1. Raw-first persistence: store original payload before validation
        try:
            payload_str = json.dumps(raw_row, default=str)
            conn.execute(
                "INSERT INTO raw_events(source, payload_json) VALUES (?, ?)",
                ("ALERT_INGEST", payload_str),
            )
        except Exception:
            pass

        # 2. Boundary schema validation via Pydantic
        try:
            # Clean empty strings / nulls for optional fields
            row_dict = dict(raw_row)
            if "score" in row_dict and row_dict["score"] is not None:
                try:
                    row_dict["score"] = float(row_dict["score"])
                except (ValueError, TypeError):
                    pass
            if "is_fraud" in row_dict and row_dict["is_fraud"] is not None:
                try:
                    row_dict["is_fraud"] = int(row_dict["is_fraud"])
                except (ValueError, TypeError):
                    pass

            alert = AlertIn(**row_dict)
        except (ValidationError, Exception) as err:
            err_msg = str(err).replace("\n", "; ")
            rejected.append({"row": i + 1, "error": err_msg})
            continue

        # 3. Deduplication via deterministic hash key
        key = dedupe_key_alert(alert.alert_id, alert.account_id)
        cur = conn.execute(
            """
            INSERT OR IGNORE INTO alerts (
                alert_id, txn_id, account_id, device_id, to_vpa,
                rule, severity, score, reason, ts, is_fraud, dedupe_key
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                alert.alert_id,
                alert.txn_id,
                alert.account_id,
                alert.device_id or "",
                alert.to_vpa or "",
                alert.rule,
                alert.severity,
                alert.score,
                alert.reason,
                alert.ts.isoformat(),
                alert.is_fraud,
                key,
            ),
        )

        if cur.rowcount == 1:
            accepted += 1
        else:
            duplicates += 1

    conn.commit()

    # 4. Audit log entry for traceability
    log_details = (
        f"Alerts Batch - Received: {received}, Accepted: {accepted}, "
        f"Duplicates: {duplicates}, Rejected: {len(rejected)}"
    )
    conn.execute(
        """
        INSERT INTO audit_log (actor, action, object_type, object_id, details, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            "SYSTEM",
            "INGEST_ALERTS",
            "BATCH",
            f"BATCH-{int(datetime.now().timestamp())}",
            log_details,
            datetime.now().isoformat(),
        ),
    )
    conn.commit()

    return {
        "received": received,
        "accepted": accepted,
        "duplicates": duplicates,
        "rejected": rejected,
    }


def ingest_transactions(rows: list[dict[str, Any]], conn: sqlite3.Connection) -> dict[str, Any]:
    """Ingest a batch of transaction rows with raw capture, validation, and deduplication.

    Returns:
        dict: {"received": int, "accepted": int, "duplicates": int, "rejected": list[dict]}
    """
    received = len(rows)
    accepted = 0
    duplicates = 0
    rejected: list[dict[str, Any]] = []

    for i, raw_row in enumerate(rows):
        # 1. Raw-first persistence: store original payload before validation
        try:
            payload_str = json.dumps(raw_row, default=str)
            conn.execute(
                "INSERT INTO raw_events(source, payload_json) VALUES (?, ?)",
                ("TXN_INGEST", payload_str),
            )
        except Exception:
            pass

        # 2. Boundary schema validation via Pydantic
        try:
            row_dict = dict(raw_row)
            if "amount" in row_dict and row_dict["amount"] is not None:
                try:
                    row_dict["amount"] = float(row_dict["amount"])
                except (ValueError, TypeError):
                    pass
            if "is_fraud" in row_dict and row_dict["is_fraud"] is not None:
                try:
                    row_dict["is_fraud"] = int(row_dict["is_fraud"])
                except (ValueError, TypeError):
                    pass

            txn = TransactionIn(**row_dict)
        except (ValidationError, Exception) as err:
            err_msg = str(err).replace("\n", "; ")
            rejected.append({"row": i + 1, "error": err_msg})
            continue

        # 3. Deduplication via primary key txn_id
        cur = conn.execute(
            """
            INSERT OR IGNORE INTO transactions (
                txn_id, ts, from_account, to_account, to_vpa,
                amount, channel, device_id, city, is_fraud
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                txn.txn_id,
                txn.ts.isoformat(),
                txn.from_account,
                txn.to_account,
                txn.to_vpa,
                round(txn.amount, 2),
                txn.channel,
                txn.device_id,
                txn.city,
                txn.is_fraud,
            ),
        )

        if cur.rowcount == 1:
            accepted += 1
        else:
            duplicates += 1

    conn.commit()

    # 4. Audit log entry
    log_details = (
        f"Transactions Batch - Received: {received}, Accepted: {accepted}, "
        f"Duplicates: {duplicates}, Rejected: {len(rejected)}"
    )
    conn.execute(
        """
        INSERT INTO audit_log (actor, action, object_type, object_id, details, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            "SYSTEM",
            "INGEST_TRANSACTIONS",
            "BATCH",
            f"BATCH-{int(datetime.now().timestamp())}",
            log_details,
            datetime.now().isoformat(),
        ),
    )
    conn.commit()

    return {
        "received": received,
        "accepted": accepted,
        "duplicates": duplicates,
        "rejected": rejected,
    }
