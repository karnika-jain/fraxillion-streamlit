"""Safe integration hooks for teammate's ML and Graph modules (Step 6).

Gracefully attempts to import and invoke `score_case` from `core.score`
and `get_case_graph_html` from `core.graph`. Never crashes the calling page
if a module is missing or throws an error.
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


def get_risk(case_id: str) -> dict[str, Any]:
    """Attempt to score a case using core.score.score_case.

    Returns:
        dict: If successful, the result from score_case() with keys
              {"score": float, "reasons": list[str], "model": str}.
              If missing or on error, returns fallback:
              {"score": None, "reasons": [], "model": "not available"}.
    """
    fallback: dict[str, Any] = {
        "score": None,
        "reasons": [],
        "model": "not available",
    }
    try:
        from core.score import score_case

        result = score_case(case_id)
        if isinstance(result, dict) and "score" in result:
            return result
        return fallback
    except ImportError:
        logger.debug("core.score module not installed or score_case not found.")
        return fallback
    except Exception as exc:
        logger.warning("Error invoking core.score.score_case('%s'): %s", case_id, exc)
        return fallback


def get_graph_html(case_id: str, hops: int = 2) -> str | None:
    """Attempt to render a case money-trail graph via core.graph.get_case_graph_html.

    Returns:
        str | None: Raw HTML string suitable for st.components.v1.html,
                    or None if the module is missing or fails.
    """
    try:
        from core.graph import get_case_graph_html

        html_str = get_case_graph_html(case_id, hops=hops)
        if isinstance(html_str, str) and html_str.strip():
            return html_str
        return None
    except ImportError:
        logger.debug("core.graph module not found or get_case_graph_html missing.")
        return None
    except Exception as exc:
        logger.warning("Error invoking core.graph.get_case_graph_html('%s'): %s", case_id, exc)
        return None
