"""Contrats V1 du détecteur AIOps. Les signaux de cyber sont corrélés côté SOC."""
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict, field_validator


class MetricsWindow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    service: str = Field(default="payment-api", pattern=r"^[a-z][a-z0-9-]{1,48}$")
    observed_at: datetime
    window_seconds: int = Field(default=60, ge=30, le=300)
    requests_per_second: float = Field(ge=0, le=100000)
    error_rate: float = Field(ge=0, le=1)
    latency_p95_ms: float = Field(ge=0, le=1000000)
    cpu_usage_percent: float = Field(ge=0, le=100)

    @field_validator("observed_at")
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("observed_at doit inclure un fuseau horaire (ex. +00:00 ou Z)")
        return value


class AnomalyResponse(BaseModel):
    incident_id: str
    timestamp: datetime
    service: str
    anomaly_detected: bool
    anomaly_score: float
    model_version: str
    recommendation: str
    evidence: dict[str, float]
    note: str
