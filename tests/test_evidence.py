"""Tests for Evidence Management and Hash Chaining (Segment 5).

Verifies that the SHA-256 hash chain correctly links items, verifies integrity,
and detects any single-byte modification or missing file on disk.
"""

from pathlib import Path
import sqlite3
import tempfile
import pytest

from core.db import init_db
from core.evidence import add_evidence, export_bundle, verify_chain


@pytest.fixture
def test_db():
    """Create an in-memory SQLite database initialized with Fraxillion schema."""
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    init_db(conn)
    # Create dummy case
    conn.execute(
        "INSERT INTO cases (case_id, title, status, severity, amount) VALUES ('CS-TEST-0001', 'Test Case', 'NEW', 'HIGH', 1000.0)"
    )
    conn.commit()
    yield conn
    conn.close()


def test_hash_chain_creation_and_linking(test_db):
    """Test that multiple evidence items are chained with prev_hash matching previous item_hash."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        file1 = Path(tmp_dir) / "evidence_1.txt"
        file2 = Path(tmp_dir) / "evidence_2.txt"

        file1.write_text("Case evidence document content 1", encoding="utf-8")
        file2.write_text("Case evidence document content 2", encoding="utf-8")

        # 1. Add first item (genesis prev_hash should be 64 zeros)
        ev1 = add_evidence(test_db, "CS-TEST-0001", file1, kind="DOCUMENT")
        assert ev1["prev_hash"] == "0" * 64
        assert len(ev1["file_hash"]) == 64
        assert len(ev1["item_hash"]) == 64

        # 2. Add second item (prev_hash must match ev1 item_hash)
        ev2 = add_evidence(test_db, "CS-TEST-0001", file2, kind="DOCUMENT")
        assert ev2["prev_hash"] == ev1["item_hash"]

        # 3. Verify clean chain
        ok, failing_id, msg = verify_chain(test_db)
        assert ok is True
        assert failing_id is None


def test_hash_chain_detects_tamper(test_db):
    """Test that modifying even a single byte of an evidence file causes verification failure."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        file1 = Path(tmp_dir) / "audit_trail.txt"
        file1.write_text("Original pristine content", encoding="utf-8")

        ev = add_evidence(test_db, "CS-TEST-0001", file1, kind="DOCUMENT")

        # Verify before tampering: passes
        ok, _, _ = verify_chain(test_db)
        assert ok is True

        # Tamper: append one single space to the file
        file1.write_text("Original pristine content ", encoding="utf-8")

        # Verify after tampering: must fail at that item!
        ok, failing_id, msg = verify_chain(test_db)
        assert ok is False
        assert failing_id == ev["id"]
        assert "Tamper detected" in msg

        # Restore original content: verification passes again!
        file1.write_text("Original pristine content", encoding="utf-8")
        ok, failing_id, _ = verify_chain(test_db)
        assert ok is True
        assert failing_id is None


def test_export_bundle_contains_manifest(test_db):
    """Test exporting an evidence bundle produces a valid ZIP with manifest.json."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        file1 = Path(tmp_dir) / "doc.txt"
        file1.write_text("Test document", encoding="utf-8")
        add_evidence(test_db, "CS-TEST-0001", file1, kind="DOCUMENT")

        zip_out = Path(tmp_dir) / "bundle.zip"
        export_bundle(test_db, "CS-TEST-0001", zip_out)

        assert zip_out.exists()
        import zipfile
        with zipfile.ZipFile(zip_out, "r") as z:
            names = z.namelist()
            assert "manifest.json" in names
            assert "doc.txt" in names
