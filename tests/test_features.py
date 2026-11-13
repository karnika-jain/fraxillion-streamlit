"""Unit tests for core.features (Segment 3)."""

from __future__ import annotations

import pandas as pd

from core.features import FEATURE_COLUMNS, build_features


def test_feature_columns_and_night_flag() -> None:
    df = pd.DataFrame(
        [
            {
                "txn_id": "T1",
                "ts": "2026-11-05 14:10:00",
                "from_account": "A1",
                "to_account": "A2",
                "amount": 1250.0,
                "device_id": "D1",
            },
            {
                "txn_id": "T2",
                "ts": "2026-11-05 23:45:00",
                "from_account": "A1",
                "to_account": "A3",
                "amount": 5000.0,
                "device_id": "D1",
            },
        ]
    )
    out = build_features(df)
    for col in FEATURE_COLUMNS:
        assert col in out.columns
        assert not out[col].isna().any()

    assert list(out["is_night"]) == [0, 1]
    assert list(out["amount_round"]) == [0, 1]
    assert list(out["is_new_beneficiary"]) == [1, 1]


def test_rolling_velocity_and_pass_through() -> None:
    df = pd.DataFrame(
        [
            # Inflow of 100,000 to MULE at 10:00
            {
                "txn_id": "T1",
                "ts": "2026-11-06 10:00:00",
                "from_account": "SRC1",
                "to_account": "MULE",
                "amount": 100000.0,
                "device_id": "D_SRC",
            },
            # Rapid outflow legs from MULE totaling 90,000 within 1 hour
            {
                "txn_id": "T2",
                "ts": "2026-11-06 10:15:00",
                "from_account": "MULE",
                "to_account": "B1",
                "amount": 45000.0,
                "device_id": "D_MULE",
            },
            {
                "txn_id": "T3",
                "ts": "2026-11-06 10:30:00",
                "from_account": "MULE",
                "to_account": "B2",
                "amount": 45000.0,
                "device_id": "D_MULE",
            },
            # Repeat to B1 should not be new beneficiary
            {
                "txn_id": "T4",
                "ts": "2026-11-06 10:45:00",
                "from_account": "MULE",
                "to_account": "B1",
                "amount": 2000.0,
                "device_id": "D_MULE",
            },
        ]
    )
    out = build_features(df)
    # T3 is 2nd outbound txn from MULE with 2 distinct beneficiaries
    assert out.loc[2, "txn_count_24h"] == 2
    assert out.loc[2, "distinct_beneficiaries_24h"] == 2
    assert out.loc[2, "in_out_ratio_24h"] == 0.9
    # T4 is repeat transfer to B1
    assert out.loc[3, "is_new_beneficiary"] == 0
    assert out.loc[3, "distinct_beneficiaries_24h"] == 2
