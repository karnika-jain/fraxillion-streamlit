"""Evidence Management & Cryptographic Hash Chaining Engine (Segment 5).

Provides tamper-evident evidence capture, verification, and bundle export.
Every evidence item stores a SHA-256 file hash linked to the previous item's hash.
Modifying or deleting any file on disk breaks the chain and triggers immediate verification failure.
"""

from datetime import datetime
import hashlib
import json
import os
from pathlib import Path
import sqlite3
from typing import Any
import zipfile


def sha256_file(path: str | Path) -> str:
    """Compute SHA-256 hash of a file on disk reading in chunks."""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def canonical(obj: dict[str, Any]) -> bytes:
    """Produce deterministic UTF-8 bytes for a JSON object with sorted keys."""
    return json.dumps(obj, sort_keys=True, separators=(",", ":")).encode("utf-8")


def add_evidence(
    conn: sqlite3.Connection,
    case_id: str,
    path: str | Path,
    kind: str = "DOCUMENT",
    actor: str = "INVESTIGATOR",
) -> dict[str, Any]:
    """Capture and cryptographically seal an evidence file into the hash chain.

    Args:
        conn: SQLite database connection.
        case_id: ID of the case this evidence belongs to.
        path: Path to the evidence file on disk.
        kind: Evidence category (DOCUMENT, SCREENSHOT, TRANSACTION_EXPORT, etc.).
        actor: User or role adding the evidence.

    Returns:
        dict: Sealed evidence details including file_hash, prev_hash, and item_hash.
    """
    path_str = str(path)
    if not os.path.exists(path_str):
        raise FileNotFoundError(f"Evidence file does not exist: {path_str}")

    # 1. Retrieve the latest item_hash in the chain (genesis is 64 zeros)
    cur = conn.execute("SELECT item_hash FROM evidence ORDER BY id DESC LIMIT 1")
    last_row = cur.fetchone()
    prev_hash = last_row[0] if last_row and last_row[0] else "0" * 64

    # 2. Hash the raw file contents
    file_hash = sha256_file(path_str)

    # 3. Create canonical payload and compute new item_hash
    item_payload = {
        "case_id": case_id,
        "file_hash": file_hash,
        "prev_hash": prev_hash,
        "kind": kind,
    }
    item_hash = hashlib.sha256(canonical(item_payload)).hexdigest()

    # 4. Insert into evidence table
    now_iso = datetime.now().isoformat()
    cur = conn.execute(
        """
        INSERT INTO evidence (case_id, path, kind, file_hash, prev_hash, item_hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (case_id, path_str, kind, file_hash, prev_hash, item_hash, now_iso),
    )
    evidence_id = cur.lastrowid

    # 5. Record action in audit log
    details = (
        f"Sealed evidence #{evidence_id} for case {case_id}. "
        f"File: {os.path.basename(path_str)}, SHA-256: {file_hash[:12]}..., Prev: {prev_hash[:12]}..."
    )
    conn.execute(
        """
        INSERT INTO audit_log (actor, action, object_type, object_id, details, created_at)
        VALUES (?, 'ADD_EVIDENCE', 'EVIDENCE', ?, ?, ?)
        """,
        (actor, str(evidence_id), details, now_iso),
    )
    conn.commit()

    return {
        "id": evidence_id,
        "case_id": case_id,
        "path": path_str,
        "kind": kind,
        "file_hash": file_hash,
        "prev_hash": prev_hash,
        "item_hash": item_hash,
        "created_at": now_iso,
    }


def verify_chain(conn: sqlite3.Connection) -> tuple[bool, int | None, str]:
    """Verify the entire evidence hash chain from genesis to the latest item.

    Checks:
    1. prev_hash matches the previous item's item_hash.
    2. item_hash matches the canonical payload computation.
    3. The file exists on disk and its current SHA-256 matches the stored file_hash.

    Returns:
        tuple: (ok: bool, failing_id: int | None, message: str)
    """
    rows = conn.execute("SELECT * FROM evidence ORDER BY id ASC").fetchall()
    if not rows:
        return True, None, "Evidence ledger is empty. Chain is intact."

    expected_prev = "0" * 64

    for row in rows:
        row_id = row["id"]
        stored_prev = row["prev_hash"]
        stored_file_hash = row["file_hash"]
        stored_item_hash = row["item_hash"]
        file_path = row["path"]

        # Check A: Verify chain link to previous item
        if stored_prev != expected_prev:
            msg = (
                f"Broken hash chain at evidence item #{row_id}: "
                f"prev_hash ({stored_prev[:12]}...) does not match expected ({expected_prev[:12]}...)"
            )
            return False, row_id, msg

        # Check B: Verify file presence and content integrity on disk
        if not os.path.exists(file_path):
            msg = f"Evidence file missing from disk: '{file_path}' (Evidence #{row_id})"
            return False, row_id, msg

        current_disk_hash = sha256_file(file_path)
        if current_disk_hash != stored_file_hash:
            msg = (
                f"Tamper detected at evidence item #{row_id} ('{os.path.basename(file_path)}')! "
                f"Stored hash: {stored_file_hash[:12]}... Disk hash: {current_disk_hash[:12]}..."
            )
            return False, row_id, msg

        # Check C: Recompute and verify item_hash
        payload = {
            "case_id": row["case_id"],
            "file_hash": stored_file_hash,
            "prev_hash": stored_prev,
            "kind": row["kind"],
        }
        recomputed_item_hash = hashlib.sha256(canonical(payload)).hexdigest()
        if recomputed_item_hash != stored_item_hash:
            msg = (
                f"Integrity check failed at evidence item #{row_id}: "
                f"item_hash mismatch ({stored_item_hash[:12]}... vs recomputed {recomputed_item_hash[:12]}...)"
            )
            return False, row_id, msg

        # Advance expected previous hash to current item
        expected_prev = stored_item_hash

    return True, None, "All evidence items passed cryptographic hash verification. Chain is intact."


def export_bundle(conn: sqlite3.Connection, case_id: str, out_path: str | Path) -> str:
    """Export all evidence items for a case into a sealed ZIP bundle with manifest.json.

    Args:
        conn: SQLite connection.
        case_id: Target case ID.
        out_path: Destination path for the ZIP archive.

    Returns:
        str: Path to the generated ZIP bundle.
    """
    rows = conn.execute(
        "SELECT * FROM evidence WHERE case_id=? ORDER BY id ASC", (case_id,)
    ).fetchall()

    out_path_str = str(out_path)
    os.makedirs(os.path.dirname(out_path_str), exist_ok=True)

    manifest: list[dict[str, Any]] = []

    with zipfile.ZipFile(out_path_str, "w", zipfile.ZIP_DEFLATED) as z:
        for r in rows:
            file_path = r["path"]
            filename = os.path.basename(file_path)
            if os.path.exists(file_path):
                z.write(file_path, arcname=filename)
            manifest.append({
                "evidence_id": r["id"],
                "case_id": r["case_id"],
                "filename": filename,
                "kind": r["kind"],
                "file_sha256": r["file_hash"],
                "prev_hash": r["prev_hash"],
                "item_hash": r["item_hash"],
                "created_at": r["created_at"],
            })

        # Embed canonical manifest in archive
        z.writestr("manifest.json", json.dumps(manifest, indent=2))

    # Log export action
    conn.execute(
        """
        INSERT INTO audit_log (actor, action, object_type, object_id, details, created_at)
        VALUES (?, 'EXPORT_EVIDENCE', 'CASE', ?, ?, ?)
        """,
        ("INVESTIGATOR", case_id, f"Exported {len(rows)} evidence items to {os.path.basename(out_path_str)}", datetime.now().isoformat()),
    )
    conn.commit()

    return out_path_str
