from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass

from pydantic import ValidationError

from app.core.settings import Settings, get_settings
from app.schemas.triage import LlmTriageDraft, TriageResult, TriageStatus
from app.services.fallback import escalate_with_general_medicine
from app.services.provider import ProviderError, get_llm_provider_chain

LOGGER = logging.getLogger(__name__)

EMERGENCY_PATTERN = re.compile(
    r"\b(chest pain|cannot breathe|can't breathe|difficulty breathing|"
    r"stroke|unconscious|severe bleeding|anaphylaxis)\b",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class ContextItem:
    key: str
    value: str


class ContextRetriever:
    _KEYWORD_CONTEXT: tuple[ContextItem, ...] = (
        ContextItem(
            key="chest pain",
            value=(
                "Possible cardiac red flags include pain radiating to arm, diaphoresis, "
                "syncope, and severe dyspnea. Escalate emergency symptoms immediately."
            ),
        ),
        ContextItem(
            key="difficulty breathing",
            value=(
                "Respiratory triage should assess oxygen compromise, accessory muscle use, "
                "and inability to complete sentences."
            ),
        ),
        ContextItem(
            key="headache",
            value=(
                "Neurology red flags include thunderclap onset, focal deficits, confusion, "
                "neck stiffness, or altered consciousness."
            ),
        ),
        ContextItem(
            key="abdominal pain",
            value=(
                "Gastro triage evaluates location, severity, vomiting, GI bleed signs, "
                "and dehydration risk."
            ),
        ),
        ContextItem(
            key="rash",
            value=(
                "Dermatology triage evaluates rash morphology, distribution, mucosal involvement, "
                "and systemic symptoms such as fever."
            ),
        ),
    )

    def retrieve(self, symptoms: str, max_items: int = 2) -> list[str]:
        text = symptoms.lower()
        matches = [item.value for item in self._KEYWORD_CONTEXT if item.key in text]
        if matches:
            return matches[:max_items]
        return [
            "General triage guidance: prioritize life-threatening symptoms, then route by "
            "most affected organ system and symptom cluster."
        ]


class TriageService:
    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()
        self._providers = get_llm_provider_chain(self._settings)
        self._retriever = ContextRetriever()

    def _build_prompt(self, symptoms: str, clinical_context: list[str]) -> str:
        context = "\n".join(f"- {line}" for line in clinical_context)
        schema = {
            "suggested_specialty": "string",
            "confidence_score": "float_0_to_1",
            "reasoning": "string",
        }
        return (
            "You are a medical triage assistant. Use the provided clinical context for "
            "terminology and safer routing. Do not diagnose. Return JSON only.\n\n"
            f"Clinical Context:\n{context}\n\n"
            f"Patient Symptoms:\n{symptoms}\n\n"
            f"Required JSON schema:\n{json.dumps(schema)}"
        )

    async def triage(self, symptoms: str) -> TriageResult:
        if EMERGENCY_PATTERN.search(symptoms):
            return TriageResult(
                status=TriageStatus.EMERGENCY,
                suggested_specialty="Emergency Medicine",
                confidence_score=1.0,
                reasoning=(
                    "Emergency symptom pattern detected. Immediate in-person care is needed."
                ),
                escalation_warning=(
                    "Call emergency services or go to the nearest emergency department now."
                ),
            )

        context = self._retriever.retrieve(symptoms)
        prompt = self._build_prompt(symptoms, context)
        low_confidence_values: list[float] = []
        had_provider_or_schema_error = False

        for provider in self._providers:
            try:
                raw = await provider.complete_json(
                    prompt=prompt,
                    timeout_seconds=self._settings.triage_timeout_seconds,
                )
                draft = LlmTriageDraft.model_validate(raw)
            except (ProviderError, ValidationError, ValueError) as exc:
                LOGGER.warning(
                    "triage_provider_or_schema_error provider=%s error=%s",
                    provider.__class__.__name__,
                    exc,
                )
                had_provider_or_schema_error = True
                continue

            if draft.confidence_score >= self._settings.triage_confidence_threshold:
                return TriageResult(
                    status=TriageStatus.HIGH_CONFIDENCE,
                    suggested_specialty=draft.suggested_specialty,
                    confidence_score=draft.confidence_score,
                    reasoning=draft.reasoning,
                    escalation_warning=None,
                )

            low_confidence_values.append(draft.confidence_score)

        if low_confidence_values:
            best_confidence = max(low_confidence_values)
            return escalate_with_general_medicine(
                reasoning=(
                    "Escalation triggered due to low confidence from model output. "
                    f"Best model confidence={best_confidence:.2f}."
                ),
                source="low_confidence",
            )

        if had_provider_or_schema_error:
            return escalate_with_general_medicine(
                reasoning=(
                    "Escalation triggered because the AI triage service is "
                    "temporarily unavailable."
                ),
                source="provider_or_schema_error",
            )

        return escalate_with_general_medicine(
            reasoning=(
                "Escalation triggered because the AI triage service is "
                "temporarily unavailable."
            ),
            source="provider_or_schema_error",
        )
