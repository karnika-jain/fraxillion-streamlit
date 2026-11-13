"""Unit tests for core.integration (Step 6)."""

from __future__ import annotations

import sqlite3

from core.integration import get_graph_html, get_risk


def test_integration_fallback_on_missing_case() -> None:
    # A case that does not exist returns either a scored dict from score_case (e.g. 0.0) or fallback
    risk = get_risk("CS-NONEXISTENT")
    assert isinstance(risk, dict)
    assert "score" in risk
    assert "reasons" in risk
    assert "model" in risk

    graph_html = get_graph_html("CS-NONEXISTENT")
    assert graph_html is None or "No alerts or focus account found" in graph_html
