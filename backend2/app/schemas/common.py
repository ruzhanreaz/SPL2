from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.models.enums import MetricCode


class MeasurementOut(BaseModel):
    metric_code: MetricCode
    value: float
    unit: str
    measured_at: datetime
    confidence: float | None = None


class ManualMeasurementCreate(BaseModel):
    metric_code: MetricCode
    value: float
    measured_at: datetime | None = None
    unit: str | None = None


class ManualMeasurementResponse(BaseModel):
    measurement_id: int
    patient_id: str
    metric_code: MetricCode
    value: float
    unit: str
    measured_at: datetime


class ReportUploadResponse(BaseModel):
    report_id: int
    status: str
    extracted_count: int
    needs_review: bool


class DriveIngestionItem(BaseModel):
    report_id: int
    status: str
    extracted_count: int
    needs_review: bool


class DriveIngestionResponse(BaseModel):
    patient_id: str
    ingested_count: int
    items: list[DriveIngestionItem]


class TrendPoint(BaseModel):
    measured_at: datetime
    value: float
    unit: str


class MetricTrend(BaseModel):
    metric_code: MetricCode
    unit: str
    points: list[TrendPoint]


class PatientTrendResponse(BaseModel):
    patient_id: str
    trends: list[MetricTrend]


class DocumentMetadata(BaseModel):
    objectName: str
    fileName: str
    mimeType: str | None = None
    issuedAt: datetime | None = None
    uploadedAt: datetime | None = None


class MeasurementTableItem(BaseModel):
    measurement_id: int
    patient_id: str
    report_id: int | None
    metric_code: MetricCode
    value: float
    unit: str
    measured_at: datetime
    confidence: float | None = None


class MeasurementTableResponse(BaseModel):
    patient_id: str
    items: list[MeasurementTableItem]


class MeasurementUpdateRequest(BaseModel):
    metric_code: MetricCode | None = None
    value: float | None = None
    unit: str | None = None
    measured_at: datetime | None = None
    confidence: float | None = None


class AiDoctorConversationMessage(BaseModel):
    role: str
    text: str


class AiDoctorSuggestionRequest(BaseModel):
    symptoms: str
    conversation: list[AiDoctorConversationMessage] = Field(default_factory=list)
    session_id: str | None = Field(default=None, alias="sessionId")
    mode: Literal["auto", "api", "fallback"] = "auto"


class AiDoctorSuggestionDoctor(BaseModel):
    id: int | None = None
    doctorId: int | None = None
    name: str
    specialization: str
    yearsOfExperience: int | None = None
    location: str | None = None
    consultationFee: float | None = None


class AiDoctorSuggestionResponse(BaseModel):
    field: str
    confidence: int
    experience: str
    related: list[str]
    doctors: list[AiDoctorSuggestionDoctor]
    source: str
    needsMoreInfo: bool
    answerAccepted: bool
    nextQuestion: str | None = None
    questionType: str | None = None
    assistantMessage: str | None = None


class AiHealthCheckerStatusResponse(BaseModel):
    provider: str
    model: str
    endpoint: str
    available: bool
    activeSource: str
    fallbackEnabled: bool
