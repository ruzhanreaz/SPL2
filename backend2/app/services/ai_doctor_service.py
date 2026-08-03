from __future__ import annotations

import json
import re
import time
from hashlib import sha1
from typing import ClassVar
from dataclasses import dataclass
from pathlib import Path

import httpx

from app.core.settings import Settings, get_settings
from app.schemas.common import (
    AiDoctorSuggestionDoctor,
    AiDoctorSuggestionRequest,
    AiDoctorSuggestionResponse,
    AiHealthCheckerStatusResponse,
)
from app.triage import TriageEngine

EMERGENCY_PATTERN = re.compile(
    r"\b(chest pain|can'?t breathe|difficulty breathing|shortness of breath|"
    r"heart attack|stroke|unconscious|severe bleeding|bleeding heavily|"
    r"suicid|kill myself|anaphylaxis|face drooping|arm weak|speech difficult|"
    r"severe allergic)\b",
    re.IGNORECASE,
)

OFF_TOPIC_PATTERN = re.compile(
    r"\b(write code|python|javascript|stock|crypto|relationship|recipe|sports|weather|"
    r"news|politics|hack|jailbreak|ignore previous)\b",
    re.IGNORECASE,
)

EMERGENCY_MESSAGE = (
    "This sounds like a medical emergency. Seek immediate medical attention now and "
    "ask someone nearby to help you right away. Do not wait."
)

OFF_TOPIC_MESSAGE = (
    "I can only assist with medical symptom assessment. "
    "Please describe your symptoms."
)

DEFAULT_SYSTEM_PROMPT = (
    "You are an expert Medical Triage Assistant. Analyze symptoms and conversation "
    "history to route users to the correct specialty. You are not a doctor and must "
    "never provide definitive diagnosis or prescriptions. Keep a professional, "
    "empathetic, clinical tone. Perform emergency safety checks first; if emergency "
    "signals exist, set is_emergency=true and prioritize emergency guidance. If not "
    "an emergency, predict the best specialty and confidence_score from 0.0 to 1.0. "
    "If confidence_score < 0.6, ask one high-value follow-up question. Always return "
    "strict JSON only with keys: is_emergency, predicted_specialty, confidence_score, "
    "reasoning, follow_up_question, advice."
)

MAX_CONTEXT_MESSAGES = 10
SESSION_TTL_SECONDS = 30 * 60

MAX_CLARIFYING_QUESTIONS = 3


@dataclass
class TriageResult:
    is_emergency: bool
    predicted_specialty: str | None
    confidence_score: float
    reasoning: str
    follow_up_question: str | None
    advice: str


@dataclass
class ConversationState:
    conversation_history: list[dict[str, str]]
    questions_asked: list[str]
    question_count: int
    is_prediction_complete: bool
    updated_at: float


@dataclass
class QuestioningDecision:
    enough_info: bool
    follow_up_question: str | None
    reasoning: str


class AiDoctorService:
    _conversation_states: ClassVar[dict[str, ConversationState]] = {}

    SPECIALTY_KEYWORDS: ClassVar[dict[str, tuple[str, ...]]] = {
        "Cardiology": (
            "chest pain",
            "chest discomfort",
            "palpitation",
            "heart racing",
            "irregular heartbeat",
            "bp",
            "high blood pressure",
            "hypertension",
            "ankle swelling",
        ),
        "Dermatology": (
            "rash",
            "itch",
            "itching",
            "hives",
            "eczema",
            "psoriasis",
            "acne",
            "skin peeling",
            "skin allergy",
            "dandruff",
        ),
        "Gastroenterology": (
            "stomach",
            "abdomen",
            "abdominal",
            "nausea",
            "vomit",
            "vomiting",
            "diarrhea",
            "constipation",
            "bloating",
            "acid reflux",
            "heartburn",
            "indigestion",
        ),
        "Neurology": (
            "headache",
            "migraine",
            "dizzy",
            "dizziness",
            "vertigo",
            "numb",
            "tingling",
            "seizure",
            "fainting",
            "tremor",
        ),
        "Pulmonology": (
            "cough",
            "breath",
            "shortness of breath",
            "wheezing",
            "asthma",
            "lung",
            "phlegm",
            "chest congestion",
            "dry cough",
        ),
        "ENT": (
            "ear pain",
            "ear discharge",
            "nose block",
            "runny nose",
            "sinus",
            "sore throat",
            "throat pain",
            "hoarseness",
            "tonsil",
        ),
        "Orthopedics": (
            "joint pain",
            "knee pain",
            "back pain",
            "neck pain",
            "shoulder pain",
            "sprain",
            "fracture",
            "muscle pain",
            "arthritis",
        ),
        "Urology": (
            "burning urination",
            "urine pain",
            "blood in urine",
            "frequent urination",
            "kidney pain",
            "flank pain",
            "urinary",
            "uti",
        ),
        "Gynecology": (
            "period pain",
            "irregular period",
            "heavy bleeding",
            "pelvic pain",
            "vaginal discharge",
            "pregnancy nausea",
            "pregnant",
            "menstrual",
            "pcos",
        ),
        "Endocrinology": (
            "thyroid",
            "high sugar",
            "low sugar",
            "diabetes",
            "weight gain",
            "weight loss",
            "excessive thirst",
            "frequent hunger",
            "hormone",
        ),
        "Psychiatry": (
            "anxiety",
            "panic",
            "low mood",
            "depression",
            "insomnia",
            "sleep problem",
            "stress",
            "overthinking",
            "fear",
        ),
        "Ophthalmology": (
            "eye pain",
            "blurred vision",
            "red eye",
            "eye redness",
            "watery eye",
            "vision loss",
            "double vision",
            "eye strain",
        ),
    }

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self._cached_prompt: str | None = None
        self._triage_engine = TriageEngine()

    async def get_status(self) -> AiHealthCheckerStatusResponse:
        provider_chain = self._provider_attempt_order()
        provider = provider_chain[0]
        active_source = "rule-triage"
        available = False
        for candidate in provider_chain:
            if await self._is_provider_available(candidate):
                available = True
                active_source = self._provider_source_label(candidate)
                break
        return AiHealthCheckerStatusResponse(
            provider=provider,
            model=self._provider_model(provider),
            endpoint=self._provider_endpoint(provider),
            available=available,
            activeSource=active_source if available else "rule-triage",
            fallbackEnabled=True,
        )

    async def suggest_for_symptoms(
        self, request: AiDoctorSuggestionRequest
    ) -> AiDoctorSuggestionResponse:
        symptoms = (request.symptoms or "").strip()
        if not symptoms:
            raise ValueError("Symptoms cannot be empty.")
        mode = self._normalized_mode(request.mode)

        conversation = self._normalize_conversation(request, symptoms)
        session_id = self._resolve_session_id(request, conversation)
        self._prune_conversation_states()
        state = self._get_or_create_state(session_id)
        state.conversation_history = conversation
        state.updated_at = time.time()
        latest_user_text = self._latest_user_message(conversation)

        if EMERGENCY_PATTERN.search(latest_user_text):
            self._clear_state(session_id)
            return self._build_emergency_response()

        if OFF_TOPIC_PATTERN.search(latest_user_text):
            self._clear_state(session_id)
            return self._build_offtopic_response()

        if mode == "fallback":
            fallback = await self._engine_fallback_response(conversation)
            self._clear_state(session_id)
            return fallback

        if not state.is_prediction_complete:
            if state.question_count < MAX_CLARIFYING_QUESTIONS:
                decision, source = await self._llm_questioning_decision(
                    conversation_history=state.conversation_history,
                    question_count=state.question_count,
                )
                if (
                    decision is not None
                    and not decision.enough_info
                    and decision.follow_up_question
                ):
                    follow_up = decision.follow_up_question.strip()
                    state.question_count = min(
                        MAX_CLARIFYING_QUESTIONS,
                        state.question_count + 1,
                    )
                    state.updated_at = time.time()
                    if not state.questions_asked or state.questions_asked[-1] != follow_up:
                        state.questions_asked.append(follow_up)
                    if (
                        not state.conversation_history
                        or state.conversation_history[-1].get("role") != "assistant"
                        or state.conversation_history[-1].get("content") != follow_up
                    ):
                        state.conversation_history.append(
                            {"role": "assistant", "content": follow_up}
                        )
                    return AiDoctorSuggestionResponse(
                        field="General Medicine",
                        confidence=70,
                        experience="4+ years",
                        related=self._related_fields("General Medicine"),
                        doctors=[],
                        source=source or "rule-triage",
                        needsMoreInfo=True,
                        answerAccepted=True,
                        nextQuestion=follow_up,
                        questionType="FOLLOW_UP",
                        assistantMessage=decision.reasoning or follow_up,
                    )

                if decision is not None and decision.enough_info:
                    state.is_prediction_complete = True

            if state.question_count >= MAX_CLARIFYING_QUESTIONS:
                state.is_prediction_complete = True

        if state.is_prediction_complete:
            final_prediction, source = await self._llm_final_prediction(
                conversation_history=state.conversation_history
            )
            if final_prediction is not None:
                if final_prediction.is_emergency:
                    self._clear_state(session_id)
                    return self._build_emergency_response()

                target_field = final_prediction.predicted_specialty or "General Medicine"
                if final_prediction.confidence_score < 0.6 and mode != "api":
                    fallback = await self._engine_fallback_response(
                        state.conversation_history,
                    )
                    self._clear_state(session_id)
                    return fallback

                doctors = await self._fetch_top_doctors(
                    target_field,
                    ranking_seed=self._combined_user_text(state.conversation_history),
                )
                self._clear_state(session_id)
                return AiDoctorSuggestionResponse(
                    field=target_field,
                    confidence=max(
                        1,
                        min(100, round(final_prediction.confidence_score * 100)),
                    ),
                    experience=self._experience_guidance(target_field),
                    related=self._related_fields(target_field),
                    doctors=doctors,
                    source=source or "openai",
                    needsMoreInfo=False,
                    answerAccepted=True,
                    nextQuestion=None,
                    questionType=None,
                    assistantMessage=final_prediction.reasoning,
                )

        llm_reply, llm_source = await self._call_conversation_model(conversation)
        if llm_reply is not None:
            parsed = self._extract_triage_json(llm_reply)
            if parsed:
                if parsed.is_emergency:
                    self._clear_state(session_id)
                    return self._build_emergency_response()

                target_field = parsed.predicted_specialty or "General Medicine"
                needs_more_info = parsed.confidence_score < 0.6
                if needs_more_info and mode != "api":
                    fallback = await self._engine_fallback_response(
                        conversation,
                    )
                    self._clear_state(session_id)
                    return fallback

                next_question = parsed.follow_up_question
                if needs_more_info and not next_question:
                    next_question = "Can you describe duration, exact location, and severity (1-10) of your symptoms?"

                if not needs_more_info:
                    self._clear_state(session_id)

                doctors = []
                if not needs_more_info:
                    doctors = await self._fetch_top_doctors(
                        target_field,
                        ranking_seed=self._combined_user_text(conversation),
                    )

                return AiDoctorSuggestionResponse(
                    field=target_field,
                    confidence=max(1, min(100, round(parsed.confidence_score * 100))),
                    experience=self._experience_guidance(target_field),
                    related=self._related_fields(target_field),
                    doctors=doctors,
                    source=llm_source or "openai",
                    needsMoreInfo=needs_more_info,
                    answerAccepted=True,
                    nextQuestion=next_question if needs_more_info else None,
                    questionType="FOLLOW_UP" if needs_more_info else None,
                    assistantMessage=parsed.reasoning,
                )

            self._clear_state(session_id)
            return AiDoctorSuggestionResponse(
                field=self._infer_field(self._combined_user_text(conversation)),
                confidence=75,
                experience="4+ years",
                related=self._related_fields(
                    self._infer_field(self._combined_user_text(conversation))
                ),
                doctors=[],
                source=llm_source or "openai",
                needsMoreInfo=True,
                answerAccepted=True,
                nextQuestion=llm_reply.strip()
                or "Can you share symptom severity from 1 to 10?",
                questionType="FOLLOW_UP",
                assistantMessage=llm_reply.strip()
                or "Can you share symptom severity from 1 to 10?",
            )

        if mode == "api":
            self._clear_state(session_id)
            fallback_field = self._infer_field(self._combined_user_text(conversation))
            return AiDoctorSuggestionResponse(
                field=fallback_field,
                confidence=55,
                experience=self._experience_guidance(fallback_field),
                related=self._related_fields(fallback_field),
                doctors=[],
                source="api-unavailable",
                needsMoreInfo=True,
                answerAccepted=True,
                nextQuestion="API mode is enabled, but no model response is available. Please try again or switch to Auto/Fallback mode.",
                questionType="FOLLOW_UP",
                assistantMessage="API mode is enabled, but no model response is available right now.",
            )

        fallback = await self._engine_fallback_response(
            conversation,
        )
        self._clear_state(session_id)
        return fallback

    def _normalized_mode(self, mode: str | None) -> str:
        selected = (mode or "auto").strip().lower()
        return selected if selected in {"auto", "api", "fallback"} else "auto"

    async def _engine_fallback_response(
        self,
        conversation: list[dict[str, str]],
    ) -> AiDoctorSuggestionResponse:
        combined_text = self._combined_user_text(conversation).strip()
        if not combined_text:
            combined_text = self._first_symptom_text(conversation)

        prediction = self._triage_engine.suggest(combined_text)
        field = str(prediction.get("field") or "General Medicine")
        raw_confidence = prediction.get("confidence", 0.6)
        try:
            confidence_value = float(raw_confidence)
        except (TypeError, ValueError):
            confidence_value = 0.6

        confidence_percent = (
            round(confidence_value * 100)
            if confidence_value <= 1.0
            else round(confidence_value)
        )
        confidence_percent = max(1, min(100, confidence_percent))

        base_reasoning = str(prediction.get("reasoning") or "").strip()
        if field == "General Medicine":
            assistant_message = (
                "Based on the symptoms shared, a General Medicine consultation "
                "is the most appropriate next step. This triage guidance is not "
                "a diagnosis."
            )
        else:
            assistant_message = (
                f"Based on the symptoms shared, the most appropriate next step is "
                f"a consultation in {field}. This triage guidance is not a diagnosis."
            )
        if base_reasoning:
            assistant_message = f"{assistant_message} {base_reasoning}"

        doctors = await self._fetch_top_doctors(
            field,
            ranking_seed=combined_text,
        )

        return AiDoctorSuggestionResponse(
            field=field,
            confidence=confidence_percent,
            experience=self._experience_guidance(field),
            related=self._related_fields(field),
            doctors=doctors,
            source="triage-engine",
            needsMoreInfo=False,
            answerAccepted=True,
            nextQuestion=None,
            questionType=None,
            assistantMessage=assistant_message,
        )

    async def _llm_questioning_decision(
        self,
        conversation_history: list[dict[str, str]],
        question_count: int,
    ) -> tuple[QuestioningDecision | None, str | None]:
        prompt = self._build_questioning_prompt(conversation_history, question_count)
        reply, source = await self._call_conversation_model(
            [{"role": "user", "content": prompt}]
        )
        if not reply:
            return None, source

        data = self._extract_json_object(reply)
        if not data:
            return None, source

        enough_info = bool(data.get("enough_info", False))
        follow_up_raw = data.get("follow_up_question")
        follow_up = (
            str(follow_up_raw).strip()
            if isinstance(follow_up_raw, str) and follow_up_raw.strip()
            else None
        )
        reasoning = str(data.get("reasoning", "")).strip()

        return (
            QuestioningDecision(
                enough_info=enough_info,
                follow_up_question=follow_up,
                reasoning=reasoning,
            ),
            source,
        )

    async def _llm_final_prediction(
        self,
        conversation_history: list[dict[str, str]],
    ) -> tuple[TriageResult | None, str | None]:
        prompt = self._build_final_prediction_prompt(conversation_history)
        reply, source = await self._call_conversation_model(
            [{"role": "user", "content": prompt}]
        )
        if not reply:
            return None, source
        return self._extract_triage_json(reply), source

    def _build_questioning_prompt(
        self,
        conversation_history: list[dict[str, str]],
        question_count: int,
    ) -> str:
        serialized_history = json.dumps(conversation_history, ensure_ascii=True)
        return (
            "Goal: Triage with a limit of 3 clarifying questions, then finalize the specialty prediction. "
            "You are in the clarifying stage. Decide whether there is enough information to confidently triage. "
            "If not enough information, generate exactly one highly relevant follow-up question. "
            "Return strict JSON only with keys: enough_info (boolean), follow_up_question (string|null), reasoning (string). "
            "Do not include markdown. "
            f"Current question_count={question_count}, max_questions={MAX_CLARIFYING_QUESTIONS}. "
            f"conversation_history={serialized_history}"
        )

    def _build_final_prediction_prompt(
        self,
        conversation_history: list[dict[str, str]],
    ) -> str:
        serialized_history = json.dumps(conversation_history, ensure_ascii=True)
        return (
            "Goal: Triage with a limit of 3 clarifying questions, then finalize the specialty prediction. "
            "You are in the final prediction stage and must use the full conversation history. "
            "Return strict JSON only with keys: is_emergency (boolean), predicted_specialty (string), "
            "confidence_score (number 0.0-1.0), reasoning (string), follow_up_question (null), advice (string). "
            "Do not include markdown or extra keys. "
            f"conversation_history={serialized_history}"
        )

    def _extract_json_object(self, text: str) -> dict | None:
        fenced_match = re.search(r"```json\s*(\{.*?\})\s*```", text, re.DOTALL)
        raw_json = fenced_match.group(1) if fenced_match else None
        if raw_json is None:
            object_match = re.search(r"(\{.*\})", text, re.DOTALL)
            raw_json = object_match.group(1) if object_match else None
        if raw_json is None:
            return None
        try:
            parsed = json.loads(raw_json)
            return parsed if isinstance(parsed, dict) else None
        except (TypeError, ValueError, json.JSONDecodeError):
            return None

    def _normalize_conversation(
        self, request: AiDoctorSuggestionRequest, symptoms: str
    ) -> list[dict[str, str]]:
        turns: list[dict[str, str]] = []
        for item in request.conversation:
            role = (item.role or "").strip().lower()
            if role not in {"user", "assistant"}:
                continue
            text = (item.text or "").strip()
            if not text:
                continue
            turns.append({"role": role, "content": text})

        if not turns:
            return [{"role": "user", "content": symptoms}]

        if not any(turn["role"] == "user" for turn in turns):
            turns.insert(0, {"role": "user", "content": symptoms})

        return turns[-MAX_CONTEXT_MESSAGES:]

    def _latest_user_message(self, conversation: list[dict[str, str]]) -> str:
        for turn in reversed(conversation):
            if turn["role"] == "user":
                return turn["content"]
        return ""

    def _combined_user_text(self, conversation: list[dict[str, str]]) -> str:
        return " ".join(
            turn["content"].lower() for turn in conversation if turn["role"] == "user"
        )

    def _normalized_provider(self) -> str:
        provider = (self.settings.ai_conversation_provider or "ollama").strip().lower()
        return provider if provider in {"ollama", "groq"} else "ollama"

    def _provider_attempt_order(self) -> list[str]:
        chain: list[str] = []
        if (self.settings.llm_openai_api_key or "").strip():
            chain.append("openai")

        configured = self._normalized_provider()
        alternate = "groq" if configured == "ollama" else "ollama"
        for provider in (configured, alternate):
            if provider not in chain:
                chain.append(provider)

        return chain

    def _provider_source_label(self, provider: str) -> str:
        if provider == "openai":
            return "openai"
        return "groq" if provider == "groq" else "ollama-local"

    def _provider_model(self, provider: str) -> str:
        if provider == "openai":
            _, model = self._resolve_openai_compatible_target()
            return model
        if provider == "groq":
            return self.settings.ai_conversation_groq_model
        return self.settings.ai_conversation_ollama_model

    def _provider_endpoint(self, provider: str) -> str:
        if provider == "openai":
            base_url, _ = self._resolve_openai_compatible_target()
            return base_url
        if provider == "groq":
            return self.settings.ai_conversation_groq_base_url
        return self.settings.ai_conversation_ollama_url

    def _resolve_openai_compatible_target(self) -> tuple[str, str]:
        api_key = (self.settings.llm_openai_api_key or "").strip()
        base_url = self.settings.llm_openai_base_url.rstrip("/")
        model = self.settings.llm_openai_model

        # Groq uses OpenAI-compatible chat completions with gsk_ keys.
        if api_key.startswith("gsk_"):
            if base_url == "https://api.openai.com/v1":
                base_url = "https://api.groq.com/openai/v1"
            if model == "gpt-4o-mini":
                model = "llama-3.3-70b-versatile"

        return base_url, model

    def _openai_chat_url(self) -> str:
        base_url, _ = self._resolve_openai_compatible_target()
        return f"{base_url.rstrip('/')}/chat/completions"

    def _openai_models_url(self) -> str:
        base_url, _ = self._resolve_openai_compatible_target()
        return f"{base_url.rstrip('/')}/models"

    def _groq_models_url(self) -> str:
        return f"{self.settings.ai_conversation_groq_base_url.rstrip('/')}/models"

    def _groq_chat_url(self) -> str:
        return f"{self.settings.ai_conversation_groq_base_url.rstrip('/')}/chat/completions"

    async def _call_conversation_model(
        self, conversation: list[dict[str, str]]
    ) -> tuple[str | None, str | None]:
        providers = self._provider_attempt_order()

        for provider in providers:
            reply = await self._call_provider_model(provider, conversation)
            if reply is not None:
                return reply, self._provider_source_label(provider)

        return None, None

    async def _call_provider_model(
        self, provider: str, conversation: list[dict[str, str]]
    ) -> str | None:
        if provider == "openai":
            return await self._call_openai_model(conversation)
        if provider == "groq":
            return await self._call_groq_model(conversation)
        return await self._call_local_model(conversation)

    async def _call_openai_model(self, conversation: list[dict[str, str]]) -> str | None:
        api_key = (self.settings.llm_openai_api_key or "").strip()
        if not api_key:
            return None

        _, model = self._resolve_openai_compatible_target()
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": self._load_system_prompt()},
                *conversation,
            ],
            "temperature": 0.2,
            "max_tokens": 256,
        }

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        try:
            request_timeout = max(
                8.0, float(self.settings.ai_conversation_timeout_seconds)
            )
            async with httpx.AsyncClient(timeout=request_timeout) as client:
                response = await client.post(
                    self._openai_chat_url(),
                    json=payload,
                    headers=headers,
                )
                response.raise_for_status()
            content = (
                response.json()
                .get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
                .strip()
            )
            return content or None
        except Exception:
            return None

    async def _call_local_model(self, conversation: list[dict[str, str]]) -> str | None:
        payload = {
            "model": self.settings.ai_conversation_ollama_model,
            "messages": [
                {"role": "system", "content": self._load_system_prompt()},
                *conversation,
            ],
            "stream": False,
            "options": {
                "temperature": 0.2,
                "top_p": 0.9,
                "num_predict": 256,
            },
        }

        try:
            request_timeout = max(
                8.0, float(self.settings.ai_conversation_timeout_seconds)
            )
            async with httpx.AsyncClient(timeout=request_timeout) as client:
                response = await client.post(
                    self.settings.ai_conversation_ollama_url,
                    json=payload,
                )
                response.raise_for_status()
            content = response.json().get("message", {}).get("content", "").strip()
            return content or None
        except Exception:
            return None

    async def _call_groq_model(self, conversation: list[dict[str, str]]) -> str | None:
        api_key = (self.settings.ai_conversation_groq_api_key or "").strip()
        if not api_key:
            return None

        payload = {
            "model": self.settings.ai_conversation_groq_model,
            "messages": [
                {"role": "system", "content": self._load_system_prompt()},
                *conversation,
            ],
            "temperature": 0.2,
            "max_tokens": 256,
            "stream": False,
        }

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        try:
            request_timeout = max(
                8.0, float(self.settings.ai_conversation_timeout_seconds)
            )
            async with httpx.AsyncClient(timeout=request_timeout) as client:
                response = await client.post(
                    self._groq_chat_url(),
                    json=payload,
                    headers=headers,
                )
                response.raise_for_status()
            content = (
                response.json()
                .get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
                .strip()
            )
            return content or None
        except Exception:
            return None

    async def _is_provider_available(self, provider: str) -> bool:
        if provider == "openai":
            return await self._is_openai_available()
        if provider == "groq":
            return await self._is_groq_available()
        return await self._is_local_model_available()

    async def _is_openai_available(self) -> bool:
        api_key = (self.settings.llm_openai_api_key or "").strip()
        if not api_key:
            return False

        headers = {"Authorization": f"Bearer {api_key}"}
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                response = await client.get(self._openai_models_url(), headers=headers)
                response.raise_for_status()
            return True
        except Exception:
            return False

    async def _is_local_model_available(self) -> bool:
        tags_url = self._build_ollama_tags_url(self.settings.ai_conversation_ollama_url)
        target = self.settings.ai_conversation_ollama_model.strip().lower()
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                response = await client.get(tags_url)
                response.raise_for_status()
            models = response.json().get("models", [])
            for model in models:
                name = str(model.get("name", "")).strip().lower()
                if (
                    name == target
                    or name.startswith(f"{target}:")
                    or target.startswith(f"{name}:")
                ):
                    return True
            return False
        except Exception:
            return False

    async def _is_groq_available(self) -> bool:
        api_key = (self.settings.ai_conversation_groq_api_key or "").strip()
        if not api_key:
            return False

        headers = {"Authorization": f"Bearer {api_key}"}
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                response = await client.get(self._groq_models_url(), headers=headers)
                response.raise_for_status()
            return True
        except Exception:
            return False

    def _build_ollama_tags_url(self, chat_url: str) -> str:
        url = (chat_url or "").strip()
        if not url:
            return "http://127.0.0.1:11434/api/tags"
        if url.endswith("/api/chat"):
            return f"{url[:-len('/api/chat')]}/api/tags"
        if url.endswith("/api/generate"):
            return f"{url[:-len('/api/generate')]}/api/tags"
        if "/api/" in url:
            return f"{url.split('/api/', maxsplit=1)[0]}/api/tags"
        return f"{url.rstrip('/')}/api/tags"

    def _load_system_prompt(self) -> str:
        if self._cached_prompt is not None:
            return self._cached_prompt

        prompt_path = Path(self.settings.ai_conversation_system_prompt_path)
        if not prompt_path.is_absolute():
            base_dir = Path(__file__).resolve().parents[2]
            prompt_path = (base_dir / prompt_path).resolve()

        try:
            self._cached_prompt = prompt_path.read_text(encoding="utf-8").strip()
        except Exception:
            self._cached_prompt = DEFAULT_SYSTEM_PROMPT

        return self._cached_prompt

    def _extract_triage_json(self, text: str) -> TriageResult | None:
        fenced_match = re.search(r"```json\s*(\{.*?\})\s*```", text, re.DOTALL)
        raw_json = fenced_match.group(1) if fenced_match else None
        if raw_json is None:
            object_match = re.search(
                r"(\{\s*\"(?:is_emergency|suggested_field)\".*?\})",
                text,
                re.DOTALL,
            )
            raw_json = object_match.group(1) if object_match else None
        if raw_json is None:
            return None

        try:
            data = json.loads(raw_json)
            is_emergency = bool(data.get("is_emergency", False))
            predicted_specialty_raw = data.get(
                "predicted_specialty", data.get("suggested_field", "General Medicine")
            )
            predicted_specialty = (
                str(predicted_specialty_raw).strip()
                if predicted_specialty_raw
                else None
            )
            confidence_score = float(data.get("confidence_score", 0.72))
            reasoning = str(
                data.get(
                    "reasoning",
                    "Based on the reported symptoms, this specialty route is most appropriate.",
                )
            ).strip()
            follow_up_question_raw = data.get("follow_up_question")
            follow_up_question = (
                str(follow_up_question_raw).strip()
                if isinstance(follow_up_question_raw, str)
                and follow_up_question_raw.strip()
                else None
            )
            advice = str(
                data.get(
                    "advice",
                    "If symptoms worsen or new concerning symptoms appear, seek urgent in-person care.",
                )
            ).strip()

            return TriageResult(
                is_emergency=is_emergency,
                predicted_specialty=predicted_specialty or "General Medicine",
                confidence_score=max(0.0, min(1.0, confidence_score)),
                reasoning=reasoning,
                follow_up_question=follow_up_question,
                advice=advice,
            )
        except (ValueError, TypeError, json.JSONDecodeError):
            return None

    def _build_emergency_response(self) -> AiDoctorSuggestionResponse:
        return AiDoctorSuggestionResponse(
            field="Emergency Care",
            confidence=100,
            experience="Immediate in-person emergency care",
            related=["Emergency Medicine", "Critical Care"],
            doctors=[],
            source="safety-fast-path",
            needsMoreInfo=False,
            answerAccepted=True,
            nextQuestion=None,
            questionType=None,
            assistantMessage=EMERGENCY_MESSAGE,
        )

    def _build_offtopic_response(self) -> AiDoctorSuggestionResponse:
        return AiDoctorSuggestionResponse(
            field="General Medicine",
            confidence=60,
            experience="4+ years",
            related=["Internal Medicine", "Family Medicine"],
            doctors=[],
            source="safety-fast-path",
            needsMoreInfo=True,
            answerAccepted=False,
            nextQuestion="Please describe your medical symptoms in one or two sentences.",
            questionType="SYMPTOM_DESCRIPTION",
            assistantMessage=OFF_TOPIC_MESSAGE,
        )

    async def _fetch_top_doctors(
        self,
        target_field: str,
        max_count: int = 5,
        ranking_seed: str | None = None,
    ) -> list[AiDoctorSuggestionDoctor]:
        candidate_urls = self._get_public_doctors_urls()
        if not candidate_urls:
            return []

        for doctors_url in candidate_urls:
            try:
                async with httpx.AsyncClient(timeout=8.0) as client:
                    response = await client.get(doctors_url)
                    response.raise_for_status()
                payload = response.json()
                rows = self._extract_doctor_rows(payload)
                if not rows:
                    continue

                target_specialty = self._normalize_specialty(target_field)
                related_specialties = {
                    self._normalize_specialty(item)
                    for item in self._related_fields(target_field)
                }

                ranked_exact: list[tuple[float, float, float, dict]] = []
                ranked_related: list[tuple[float, float, float, dict]] = []
                fallback_ranked: list[tuple[float, float, float, dict]] = []
                for row in rows:
                    if not isinstance(row, dict):
                        continue
                    if row.get("isActive") is False:
                        continue

                    doctor_specialization = self._normalize_specialty(
                        str(row.get("specialization", ""))
                    )
                    if not doctor_specialization:
                        continue

                    years = self._to_float(
                        row.get("yearOfExperience", row.get("yearsOfExperience"))
                    ) or 0.0
                    avg_rating = self._to_float(row.get("averageRating")) or 0.0
                    total_ratings = self._to_float(row.get("totalRatings")) or 0.0
                    fallback_ranked.append((years, avg_rating, total_ratings, row))

                    if doctor_specialization == target_specialty:
                        ranked_exact.append((years, avg_rating, total_ratings, row))
                        continue

                    if doctor_specialization in related_specialties:
                        ranked_related.append((years, avg_rating, total_ratings, row))
                        continue

                    # Keep weak lexical matching as secondary fallback in related bucket.
                    if self._specialty_relevance(
                        doctor_specialization,
                        related_specialties,
                        target_field,
                    ) > 0.0:
                        ranked_related.append((years, avg_rating, total_ratings, row))

                ranked = ranked_exact or ranked_related or fallback_ranked
                ranked.sort(key=lambda item: item[:3], reverse=True)

                top: list[AiDoctorSuggestionDoctor] = []
                for _, _, _, row in ranked[:max_count]:
                    first = str(row.get("firstName", "")).strip()
                    last = str(row.get("lastName", "")).strip()
                    name = (f"{first} {last}").strip() or "Doctor"

                    top.append(
                        AiDoctorSuggestionDoctor(
                            id=self._to_int(row.get("doctorId")),
                            doctorId=self._to_int(row.get("doctorId")),
                            name=name,
                            specialization=str(
                                row.get("specialization", "General Medicine")
                            ),
                            yearsOfExperience=self._to_int(
                                row.get("yearOfExperience", row.get("yearsOfExperience"))
                            ),
                            location=self._to_str_or_none(row.get("location")),
                            consultationFee=self._to_float(
                                row.get("consultationFee")
                            ),
                        )
                    )

                if top:
                    return top
            except Exception:
                continue

        return []

    def _extract_doctor_rows(self, payload: object) -> list[dict]:
        if isinstance(payload, list):
            return [row for row in payload if isinstance(row, dict)]
        if isinstance(payload, dict):
            for key in ("data", "items", "results", "doctors"):
                value = payload.get(key)
                if isinstance(value, list):
                    return [row for row in value if isinstance(row, dict)]
        return []

    def _specialty_relevance(
        self,
        doctor_specialization: str,
        accepted_specialties: set[str],
        target_field: str,
    ) -> float:
        if doctor_specialization in accepted_specialties:
            return 30.0

        target_specialty = self._normalize_specialty(target_field)
        if not target_specialty:
            return 0.0

        if target_specialty in doctor_specialization:
            return 24.0
        if doctor_specialization in target_specialty:
            return 20.0

        doc_tokens = {
            token
            for token in doctor_specialization.split()
            if token and token not in {"and", "medicine", "doctor", "specialist"}
        }
        target_tokens = {
            token
            for token in target_specialty.split()
            if token and token not in {"and", "medicine", "doctor", "specialist"}
        }
        overlap = doc_tokens.intersection(target_tokens)
        if not overlap:
            return 0.0
        return 10.0 + float(len(overlap))

    def _get_public_doctors_urls(self) -> list[str]:
        urls: list[str] = []
        explicit = (self.settings.ai_doctor_public_doctors_url or "").strip()
        if explicit:
            urls.append(explicit)

        backend_base = (self.settings.app_backend_url or "").strip().rstrip("/")
        if backend_base:
            urls.append(f"{backend_base}/api/public/doctors")

        # Common fallback endpoints when backend2 runs in Docker.
        urls.extend(
            [
                "http://127.0.0.1:8080/api/public/doctors",
                "http://host.docker.internal:8080/api/public/doctors",
                "http://backend:8080/api/public/doctors",
                "http://java:8080/api/public/doctors",
            ]
        )

        seen: set[str] = set()
        unique_urls: list[str] = []
        for url in urls:
            if url and url not in seen:
                seen.add(url)
                unique_urls.append(url)
        return unique_urls

    def _normalize_specialty(self, value: str) -> str:
        normalized = re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()
        alias_map = {
            "cardiologist": "cardiology",
            "heart": "cardiology",
            "dermatologist": "dermatology",
            "skin": "dermatology",
            "gastro": "gastroenterology",
            "gastroenterologist": "gastroenterology",
            "neurologist": "neurology",
            "lung": "pulmonology",
            "respiratory": "pulmonology",
            "otolaryngology": "ent",
            "ear nose throat": "ent",
            "orthopaedic": "orthopedics",
            "orthopedic": "orthopedics",
            "bone": "orthopedics",
            "urologist": "urology",
            "gynecologist": "gynecology",
            "gynaecologist": "gynecology",
            "endocrinologist": "endocrinology",
            "psychiatrist": "psychiatry",
            "mental health": "psychiatry",
            "ophthalmologist": "ophthalmology",
            "eye": "ophthalmology",
            "internal medicine": "general medicine",
            "family medicine": "general medicine",
            "general practice": "general medicine",
            "gp": "general medicine",
        }
        return alias_map.get(normalized, normalized)

    def _to_int(self, value: object) -> int | None:
        try:
            if value is None:
                return None
            return int(float(value))
        except (TypeError, ValueError):
            return None

    def _to_float(self, value: object) -> float | None:
        try:
            if value is None:
                return None
            return float(value)
        except (TypeError, ValueError):
            return None

    def _to_str_or_none(self, value: object) -> str | None:
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    def _resolve_session_id(
        self, request: AiDoctorSuggestionRequest, conversation: list[dict[str, str]]
    ) -> str:
        provided = (request.session_id or "").strip()
        if provided:
            return provided

        signature = "\n".join(
            f"{turn['role']}::{turn['content']}" for turn in conversation[-5:]
        )
        digest = sha1(signature.encode("utf-8", errors="ignore")).hexdigest()
        return f"anon-{digest}"

    def _prune_conversation_states(self) -> None:
        now = time.time()
        expired = [
            session_id
            for session_id, session_state in self._conversation_states.items()
            if now - session_state.updated_at > SESSION_TTL_SECONDS
        ]
        for session_id in expired:
            self._conversation_states.pop(session_id, None)

    def _get_or_create_state(self, session_id: str) -> ConversationState:
        state = self._conversation_states.get(session_id)
        if state is None:
            state = ConversationState(
                conversation_history=[],
                questions_asked=[],
                question_count=0,
                is_prediction_complete=False,
                updated_at=time.time(),
            )
            self._conversation_states[session_id] = state
        state.updated_at = time.time()
        return state

    def _clear_state(self, session_id: str) -> None:
        self._conversation_states.pop(session_id, None)

    def _first_symptom_text(self, conversation: list[dict[str, str]]) -> str:
        for turn in conversation:
            if turn["role"] == "user" and turn["content"].strip():
                return turn["content"].strip()
        return ""

    def _infer_field(self, text: str) -> str:
        cleaned = text.lower()
        scores: dict[str, int] = {}
        for specialty, keywords in self.SPECIALTY_KEYWORDS.items():
            matched = sum(1 for keyword in keywords if keyword in cleaned)
            if matched > 0:
                scores[specialty] = matched

        if not scores and self._contains_any(
            cleaned, ["fever", "cold", "weakness", "fatigue", "body pain", "infection"]
        ):
            return "General Medicine"

        if scores:
            return max(scores.items(), key=lambda item: item[1])[0]

        return "General Medicine"

    def _contains_any(self, text: str, keywords: list[str]) -> bool:
        return any(keyword in text for keyword in keywords)

    def _experience_guidance(self, field: str) -> str:
        if field == "Emergency Care":
            return "Immediate in-person emergency care"
        if field in {"Cardiology", "Neurology", "Pulmonology"}:
            return "6+ years"
        return "4+ years"

    def _related_fields(self, field: str) -> list[str]:
        mapping = {
            "Cardiology": ["Internal Medicine", "Pulmonology"],
            "Dermatology": ["Allergy", "Internal Medicine"],
            "Gastroenterology": ["General Surgery", "Internal Medicine"],
            "Neurology": ["Psychiatry", "Internal Medicine"],
            "Pulmonology": ["Internal Medicine", "ENT"],
            "ENT": ["Pulmonology", "Internal Medicine"],
            "Orthopedics": ["Physiotherapy", "General Surgery"],
            "Urology": ["Nephrology", "Internal Medicine"],
            "Gynecology": ["Endocrinology", "General Medicine"],
            "Endocrinology": ["Internal Medicine", "General Medicine"],
            "Psychiatry": ["Neurology", "General Medicine"],
            "Ophthalmology": ["Neurology", "General Medicine"],
            "General Medicine": ["Internal Medicine", "Family Medicine"],
            "Emergency Care": ["Emergency Medicine", "Critical Care"],
        }
        return mapping.get(field, ["Internal Medicine", "Family Medicine"])
