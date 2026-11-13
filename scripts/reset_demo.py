"""Reset Fraxillion demo environment to a pristine state.

Actions:
1. Deletes existing fraxillion.db database file.
2. Clears generated files in exports/ and evidence_files/.
3. Re-initializes database schema from core/schema.sql.
4. Ingests clean baseline synthetic transactions and alerts from data/.

Usage:
    python scripts/reset_demo.py
"""

import os
from pathlib import Path
import shutil
import sqlite3
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DB_PATH = PROJECT_ROOT / "fraxillion.db"
SCHEMA_PATH = PROJECT_ROOT / "core" / "schema.sql"
DATA_DIR = PROJECT_ROOT / "data"
EXPORTS_DIR = PROJECT_ROOT / "exports"
EVIDENCE_DIR = PROJECT_ROOT / "evidence_files"


def reset_environment():
    print("=" * 65)
    print("FRAXILLION: RESETTING DEMO ENVIRONMENT TO CLEAN PRISTINE STATE")
    print("=" * 65)

    # 1. Close connections and delete SQLite database file
    if DB_PATH.exists():
        try:
            DB_PATH.unlink()
            print("✓ Removed existing database: fraxillion.db")
        except Exception as e:
            print(f"! Notice removing fraxillion.db: {e}")
    else:
        print("✓ No existing fraxillion.db found.")

    # 2. Clear exports/ directory
    EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
    cleared_exports = 0
    for f in EXPORTS_DIR.glob("*"):
        if f.is_file():
            f.unlink()
            cleared_exports += 1
    print(f"✓ Cleared {cleared_exports} file(s) from exports/")

    # 3. Clear evidence_files/ directory
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    cleared_evidence = 0
    for f in EVIDENCE_DIR.glob("*"):
        if f.is_file():
            f.unlink()
            cleared_evidence += 1
    print(f"✓ Cleared {cleared_evidence} file(s) from evidence_files/")

    # 4. Re-create database schema
    if not SCHEMA_PATH.exists():
        raise FileNotFoundError(f"Schema file not found at: {SCHEMA_PATH}")

    conn = sqlite3.connect(DB_PATH)
    with open(SCHEMA_PATH, "r", encoding="utf-8") as sf:
        schema_sql = sf.read()
    conn.executescript(schema_sql)
    conn.commit()
    print("✓ Initialized fresh database schema from core/schema.sql")

    # 5. Load and ingest clean synthetic datasets
    txns_csv = DATA_DIR / "synthetic_transactions.csv"
    alerts_csv = DATA_DIR / "synthetic_alerts.csv"

    if not txns_csv.exists() or not alerts_csv.exists():
        print("! Synthetic CSVs missing. Generating them first...")
        from scripts.generate_data import generate_dataset
        generate_dataset()

    df_txns = pd.read_csv(txns_csv)
    df_alerts = pd.read_csv(alerts_csv)

    cur = conn.cursor()

    # Ingest transactions
    for _, r in df_txns.iterrows():
        cur.execute(
            """
            INSERT INTO transactions (txn_id, ts, from_account, to_account, to_vpa, amount, channel, device_id, city, is_fraud)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                r["txn_id"], r["ts"], r["from_account"], r["to_account"],
                r["to_vpa"], float(r["amount"]), r["channel"],
                r["device_id"], r["city"], int(r["is_fraud"]),
            ),
        )

    # Ingest alerts
    for _, r in df_alerts.iterrows():
        cur.execute(
            """
            INSERT INTO alerts (alert_id, txn_id, account_id, device_id, to_vpa, rule, severity, score, reason, ts, is_fraud)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                r["alert_id"], r["txn_id"], r["account_id"], r["device_id"],
                r["to_vpa"], r["rule"], r["severity"], float(r["score"]),
                r["reason"], r["ts"], int(r["is_fraud"]),
            ),
        )

    # Log reset in audit trail
    cur.execute(
        """
        INSERT INTO audit_log (actor, action, object_type, object_id, details)
        VALUES ('SYSTEM', 'RESET_DEMO', 'DATABASE', 'fraxillion.db', 'Demo environment reset to baseline synthetic state')
        """
    )
    conn.commit()

    total_txns = cur.execute("SELECT COUNT(*) FROM transactions").fetchone()[0]
    total_alerts = cur.execute("SELECT COUNT(*) FROM alerts").fetchone()[0]
    total_cases = cur.execute("SELECT COUNT(*) FROM cases").fetchone()[0]
    conn.close()

    print("✓ Ingested baseline synthetic data:")
    print(f"    - Transactions : {total_txns:,}")
    print(f"    - Alerts       : {total_alerts:,}")
    print(f"    - Cases        : {total_cases} (ready for correlation demo)")
    print("=" * 65)
    print("READY FOR DEMO! Start the Streamlit application with:")
    print("    streamlit run app.py")
    print("=" * 65)


if __name__ == "__main__":
    reset_environment()
