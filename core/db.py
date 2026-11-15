"""Database connection and initialization utilities for Fraxillion.

Uses pathlib so the SQLite database file and schema.sql are always
located relative to the project root directory, working seamlessly on Windows.
"""

from pathlib import Path
import sqlite3

# Define the project root directory as two levels up from this file (core/..)
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = PROJECT_ROOT / "fraxillion.db"
SCHEMA_PATH = PROJECT_ROOT / "core" / "schema.sql"


def get_conn(db_path: Path | str | None = None) -> sqlite3.Connection:
    """Return a connection to the SQLite database.

    Configured with Row factory for dict-like column access and
    check_same_thread=False for multithreaded web server compatibility.
    """
    path = Path(db_path) if db_path else DEFAULT_DB_PATH
    conn = sqlite3.connect(str(path), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(conn: sqlite3.Connection | None = None) -> None:
    """Initialize database tables using schema.sql.

    Safe to run repeatedly because all table statements use CREATE TABLE IF NOT EXISTS.
    """
    should_close = False
    if conn is None:
        conn = get_conn()
        should_close = True

    try:
        with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
            schema_script = f.read()
        conn.executescript(schema_script)
        conn.commit()
    finally:
        if should_close:
            conn.close()


def ensure_db() -> None:
    """Ensure that the database and all tables are initialized.

    Called at the top of pages to guarantee tables exist even if a page
    is accessed directly or out of order.
    """
    init_db()
