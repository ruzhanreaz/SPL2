from __future__ import annotations

import logging

from app.schemas.triage import TriageResult, TriageStatus

LOGGER = logging.getLogger(__name__)


ESCALATION_WARNING = (
    "Consult a licensed medical professional for definitive advice. "
    "If symptoms worsen, seek urgent care immediately."
)


def escalate_with_general_medicine(reasoning: str, source: str) -> TriageResult:
    LOGGER.warning("triage_escalation_triggered source=%s reason=%s", source, reasoning)
    return TriageResult(
        status=TriageStatus.NEEDS_REVIEW,
        suggested_specialty="General Medicine",
        confidence_score=0.5,
        reasoning=reasoning,
        escalation_warning=ESCALATION_WARNING,
    )
