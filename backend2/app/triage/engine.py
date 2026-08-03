from __future__ import annotations

from dataclasses import dataclass
import re
from typing import Any


@dataclass
class TriagePrediction:
    field: str
    confidence: float
    reasoning: str


class TriageEngine:
    def __init__(self) -> None:
        self._keyword_map: dict[str, tuple[str, ...]] = {
            "Cardiology": (
                "chest pain",
                "chest discomfort",
                "heart palpitations",
                "palpitation",
                "heart racing",
                "irregular heartbeat",
                "high blood pressure",
                "hypertension",
                "ankle swelling",
            ),
            "Dermatology": (
                "rash",
                "persistent rashes",
                "itch",
                "itching",
                "hives",
                "eczema",
                "psoriasis",
                "acne",
                "skin allergy",
                "unusual moles",
                "skin lesion",
                "skin lesions",
            ),
            "Gastroenterology": (
                "stomach",
                "abdomen",
                "abdominal",
                "abdominal pain",
                "nausea",
                "vomit",
                "vomiting",
                "diarrhea",
                "constipation",
                "bloating",
                "acid reflux",
                "heartburn",
                "chronic heartburn",
                "blood in stool",
            ),
            "Neurology": (
                "headache",
                "migraine",
                "migraines",
                "dizzy",
                "dizziness",
                "vertigo",
                "tremor",
                "tremors",
                "numb",
                "tingling",
                "seizure",
                "seizures",
            ),
            "Pulmonology": (
                "cough",
                "chronic cough",
                "shortness of breath",
                "dyspnea",
                "breath",
                "wheezing",
                "asthma",
                "lung",
                "phlegm",
            ),
            "ENT": (
                "ear pain",
                "ear discharge",
                "ear infection",
                "ear infections",
                "hearing loss",
                "runny nose",
                "sinus",
                "sinus pain",
                "sore throat",
                "throat pain",
                "chronic hoarseness",
                "hoarseness",
                "tonsil",
            ),
            "Orthopedics": (
                "joint pain",
                "knee pain",
                "back pain",
                "sports injuries",
                "sports injury",
                "muscle weakness",
                "neck pain",
                "shoulder pain",
                "sprain",
                "fracture",
            ),
            "Rheumatology": (
                "joint stiffness",
                "joint swelling",
                "morning stiffness",
                "inflammatory joint pain",
                "autoimmune joint pain",
            ),
            "Urology": (
                "burning urination",
                "painful urination",
                "blood in urine",
                "frequent urination",
                "kidney issues",
                "kidney pain",
                "urinary",
                "uti",
            ),
            "Gynecology": (
                "period pain",
                "irregular period",
                "irregular menstruation",
                "heavy bleeding",
                "pelvic pain",
                "vaginal discharge",
                "pregnant",
                "reproductive issues",
                "menstrual",
            ),
            "Endocrinology": (
                "thyroid",
                "high sugar",
                "low sugar",
                "diabetes",
                "weight gain",
                "weight loss",
                "unexplained weight changes",
                "excessive thirst",
                "fatigue",
                "hormone",
            ),
            "Psychiatry": (
                "anxiety",
                "persistent anxiety",
                "panic",
                "depression",
                "mood swings",
                "insomnia",
                "sleep disturbances",
                "stress",
                "overthinking",
            ),
            "Ophthalmology": (
                "eye pain",
                "blurred vision",
                "red eye",
                "floaters",
                "light sensitivity",
                "vision loss",
                "double vision",
            ),
            "Allergy & Immunology": (
                "seasonal allergies",
                "severe seasonal allergies",
                "food allergy",
                "food allergies",
                "unexplained hives",
                "allergic reaction",
            ),
            "Hematology": (
                "easy bruising",
                "anemia",
                "pale skin",
                "frequent infections",
            ),
        }
        self._fallback_field = "General Medicine"
        self._field_priority: tuple[str, ...] = (
            "Cardiology",
            "Pulmonology",
            "Neurology",
            "Gastroenterology",
            "Hematology",
            "Urology",
            "Gynecology",
            "Endocrinology",
            "Ophthalmology",
            "ENT",
            "Allergy & Immunology",
            "Dermatology",
            "Rheumatology",
            "Orthopedics",
            "Psychiatry",
            "General Medicine",
        )
        self._rheumatology_priority_terms: tuple[str, ...] = (
            "joint stiffness",
            "morning stiffness",
            "joint swelling",
            "inflammatory",
            "autoimmune",
        )
        self._orthopedics_priority_terms: tuple[str, ...] = (
            "sports injury",
            "sports injuries",
            "fracture",
            "sprain",
            "back pain",
            "knee pain",
            "shoulder pain",
            "neck pain",
        )

        # Keep external ML dependencies optional so fallback logic remains available
        # even in lean deployments.
        self._embedder: Any | None = None
        self._model: Any | None = None
        self._labels: list[str] = []
        self._init_optional_model()

    def _init_optional_model(self) -> None:
        try:
            from sentence_transformers import (  # type: ignore[import-not-found]
                SentenceTransformer,
            )
            from sklearn.linear_model import (  # type: ignore[import-not-found]
                LogisticRegression,
            )
        except Exception:
            return

        samples: list[str] = []
        labels: list[str] = []
        for field, keywords in self._keyword_map.items():
            for keyword in keywords:
                samples.append(f"I have {keyword}")
                labels.append(field)
                samples.append(f"Persistent {keyword} for 3 days")
                labels.append(field)

        # Add a small baseline class for generic symptoms.
        generic_samples = [
            "I have fever and weakness",
            "body pain with fatigue",
            "general illness for two days",
            "not feeling well",
            "mild cold and tiredness",
        ]
        samples.extend(generic_samples)
        labels.extend([self._fallback_field] * len(generic_samples))

        if len(samples) < 10:
            return

        try:
            embedder = SentenceTransformer("all-MiniLM-L6-v2")
            vectors = embedder.encode(samples)
            model = LogisticRegression(max_iter=2000)
            model.fit(vectors, labels)
        except Exception:
            return

        self._embedder = embedder
        self._model = model
        self._labels = sorted(set(labels))

    def suggest(self, text: str) -> dict[str, object]:
        normalized = self._normalize_text(text)
        if not normalized:
            return {
                "field": self._fallback_field,
                "confidence": 0.55,
                "reasoning": "There is limited symptom detail, so General Medicine is recommended as the safest next step.",
            }

        keyword_prediction = self._keyword_prediction(normalized)
        if keyword_prediction is not None:
            return {
                "field": keyword_prediction.field,
                "confidence": keyword_prediction.confidence,
                "reasoning": keyword_prediction.reasoning,
            }

        if self._embedder is not None and self._model is not None:
            try:
                vector = self._embedder.encode([normalized])
                probs = self._model.predict_proba(vector)[0]
                classes = list(self._model.classes_)
                max_idx = max(range(len(probs)), key=lambda idx: probs[idx])
                field = str(classes[max_idx])
                confidence = float(probs[max_idx])
                return {
                    "field": field,
                    "confidence": max(0.45, min(0.95, confidence)),
                    "reasoning": f"Based on the symptom pattern, {field} appears to be an appropriate specialty for next-step evaluation.",
                }
            except Exception:
                pass

        return {
            "field": self._fallback_field,
            "confidence": 0.58,
            "reasoning": "The symptoms are non-specific, so General Medicine is recommended for initial evaluation.",
        }

    def _keyword_prediction(self, normalized_text: str) -> TriagePrediction | None:
        scores: dict[str, float] = {}
        hits_by_field: dict[str, list[str]] = {}
        for field, keywords in self._keyword_map.items():
            hit_terms: list[str] = []
            score = 0.0
            for keyword in keywords:
                if keyword in normalized_text:
                    # Longer/more specific phrases get higher weight.
                    weight = 1.0 + min(1.5, max(0.0, (len(keyword) - 6) / 12.0))
                    score += weight
                    hit_terms.append(keyword)
            if score > 0.0:
                scores[field] = score
                hits_by_field[field] = hit_terms

        if not scores:
            return None

        field = self._choose_best_field(scores, normalized_text)
        score = scores[field]
        confidence = min(0.93, 0.58 + (score * 0.06))

        top_hits = sorted(hits_by_field.get(field, []), key=len, reverse=True)[:2]
        if top_hits:
            symptom_summary = ", ".join(top_hits)
            reasoning = (
                f"Based on the symptom profile (including {symptom_summary}), "
                f"{field} is the most appropriate specialty for next-step evaluation."
            )
        else:
            reasoning = (
                f"Based on the symptoms shared, {field} is the most relevant specialty "
                "for next-step evaluation."
            )

        reasoning = (
            reasoning
        )
        return TriagePrediction(field=field, confidence=confidence, reasoning=reasoning)

    def _normalize_text(self, text: str | None) -> str:
        cleaned = (text or "").strip().lower()
        cleaned = re.sub(r"[^a-z0-9\s/-]", " ", cleaned)
        cleaned = re.sub(r"\s+", " ", cleaned)
        return cleaned.strip()

    def _choose_best_field(self, scores: dict[str, float], normalized_text: str) -> str:
        top_score = max(scores.values())
        top_fields = [
            field for field, score in scores.items() if abs(score - top_score) < 1e-6
        ]
        if len(top_fields) == 1:
            return top_fields[0]

        # Explicitly resolve common overlap between Orthopedics and Rheumatology.
        if "Orthopedics" in top_fields and "Rheumatology" in top_fields:
            rheum_hits = sum(
                1 for term in self._rheumatology_priority_terms if term in normalized_text
            )
            ortho_hits = sum(
                1 for term in self._orthopedics_priority_terms if term in normalized_text
            )
            if rheum_hits > ortho_hits:
                return "Rheumatology"
            if ortho_hits > rheum_hits:
                return "Orthopedics"

        # Final deterministic tie-break using clinical priority order.
        priority_rank = {
            field: index for index, field in enumerate(self._field_priority)
        }
        return min(top_fields, key=lambda field: priority_rank.get(field, 999))
