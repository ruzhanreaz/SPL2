from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class TriageStatus(str, Enum):
    EMERGENCY = "emergency"
    HIGH_CONFIDENCE = "high_confidence"
    NEEDS_REVIEW = "needs_review"


class TriageRequest(BaseModel):
    symptoms: str = Field(min_length=3, max_length=4000)


class LlmTriageDraft(BaseModel):
    suggested_specialty: str = Field(min_length=2, max_length=120)
    confidence_score: float = Field(ge=0.0, le=1.0)
    reasoning: str = Field(min_length=3, max_length=3000)


class TriageResult(BaseModel):
    status: TriageStatus
    suggested_specialty: str
    confidence_score: float = Field(ge=0.0, le=1.0)
    reasoning: str
    escalation_warning: str | None = None


class TriageStreamEvent(BaseModel):
    event: str
    message: str
    result: TriageResult | None = None
