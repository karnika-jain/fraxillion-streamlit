"""Pydantic v2 models for boundary data validation.

Validates incoming Alert and Transaction payloads before ingestion into SQLite.
Invalid rows are rejected with clear error messages without stopping the batch.
"""

from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field, field_validator


class AlertIn(BaseModel):
    """Schema for ingested alert records."""

    alert_id: str = Field(min_length=1, description="Unique alert identifier")
    txn_id: str = Field(min_length=1, description="Associated transaction ID")
    account_id: str = Field(min_length=1, description="Subject account ID")
    device_id: str | None = None
    to_vpa: str | None = None
    rule: str = Field(min_length=1, description="Detection rule triggered")
    severity: Literal["LOW", "MEDIUM", "HIGH"] = "MEDIUM"
    score: float = Field(ge=0.0, le=1.0, description="Risk score between 0.0 and 1.0")
    reason: str = ""
    ts: datetime
    is_fraud: int = 0

    @field_validator("alert_id", mode="before")
    @classmethod
    def validate_alert_id(cls, v: object) -> str:
        if v is None:
            raise ValueError("alert_id cannot be empty or null")
        if isinstance(v, float) and (v != v):  # NaN check
            raise ValueError("alert_id cannot be empty or null")
        s = str(v).strip()
        if not s or s.lower() == "nan":
            raise ValueError("alert_id cannot be empty")
        return s

    @field_validator("severity", mode="before")
    @classmethod
    def normalize_severity(cls, v: object) -> str:
        s = str(v).strip().upper() if v is not None else "MEDIUM"
        if s not in ("LOW", "MEDIUM", "HIGH"):
            raise ValueError(f"severity must be LOW, MEDIUM, or HIGH, got '{v}'")
        return s


class TransactionIn(BaseModel):
    """Schema for ingested UPI transaction records."""

    txn_id: str = Field(min_length=1, description="Unique transaction ID")
    ts: datetime
    from_account: str = Field(min_length=1, description="Sender account number")
    to_account: str = Field(min_length=1, description="Recipient account number")
    to_vpa: str = ""
    amount: float = Field(gt=0.0, description="Transaction amount must be strictly greater than 0")
    channel: str = "UPI"
    device_id: str = ""
    city: str = ""
    is_fraud: int = 0

    @field_validator("txn_id", mode="before")
    @classmethod
    def validate_txn_id(cls, v: object) -> str:
        if v is None:
            raise ValueError("txn_id cannot be empty or null")
        if isinstance(v, float) and (v != v):  # NaN check
            raise ValueError("txn_id cannot be empty or null")
        s = str(v).strip()
        if not s or s.lower() == "nan":
            raise ValueError("txn_id cannot be empty")
        return s
