from __future__ import annotations

import json
from abc import ABC, abstractmethod

import httpx

from app.core.settings import Settings


class ProviderError(RuntimeError):
    pass


class LLMProvider(ABC):
    @abstractmethod
    async def complete_json(self, prompt: str, timeout_seconds: float) -> dict:
        raise NotImplementedError


class OpenAIProvider(LLMProvider):
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def _resolve_openai_compatible_target(self) -> tuple[str, str]:
        api_key = (self._settings.llm_openai_api_key or "").strip()
        base_url = self._settings.llm_openai_base_url.rstrip("/")
        model = self._settings.llm_openai_model

        # Groq uses OpenAI-compatible chat completions with gsk_ keys.
        if api_key.startswith("gsk_"):
            if base_url == "https://api.openai.com/v1":
                base_url = "https://api.groq.com/openai/v1"
            if model == "gpt-4o-mini":
                model = "llama-3.3-70b-versatile"

        return base_url, model

    async def complete_json(self, prompt: str, timeout_seconds: float) -> dict:
        if not self._settings.llm_openai_api_key:
            raise ProviderError("OPENAI_API_KEY is not configured")

        base_url, model = self._resolve_openai_compatible_target()
        url = f"{base_url}/chat/completions"
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": "Return strict JSON only."},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.1,
            "response_format": {"type": "json_object"},
        }
        headers = {
            "Authorization": f"Bearer {self._settings.llm_openai_api_key}",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=timeout_seconds) as client:
                resp = await client.post(url, json=payload, headers=headers)
                resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            return json.loads(content)
        except Exception as exc:  # pragma: no cover - external dependency path
            raise ProviderError(str(exc)) from exc


class AnthropicProvider(LLMProvider):
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def complete_json(self, prompt: str, timeout_seconds: float) -> dict:
        if not self._settings.llm_anthropic_api_key:
            raise ProviderError("ANTHROPIC_API_KEY is not configured")

        url = f"{self._settings.llm_anthropic_base_url.rstrip('/')}/messages"
        payload = {
            "model": self._settings.llm_anthropic_model,
            "max_tokens": 500,
            "temperature": 0.1,
            "messages": [{"role": "user", "content": prompt}],
        }
        headers = {
            "x-api-key": self._settings.llm_anthropic_api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=timeout_seconds) as client:
                resp = await client.post(url, json=payload, headers=headers)
                resp.raise_for_status()
            blocks = resp.json().get("content", [])
            text_parts = [b.get("text", "") for b in blocks if isinstance(b, dict)]
            return json.loads("\n".join(text_parts).strip())
        except Exception as exc:  # pragma: no cover - external dependency path
            raise ProviderError(str(exc)) from exc


class GeminiProvider(LLMProvider):
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def complete_json(self, prompt: str, timeout_seconds: float) -> dict:
        if not self._settings.llm_gemini_api_key:
            raise ProviderError("GEMINI_API_KEY is not configured")

        base = self._settings.llm_gemini_base_url.rstrip('/')
        model = self._settings.llm_gemini_model
        url = (
            f"{base}/models/{model}:generateContent"
            f"?key={self._settings.llm_gemini_api_key}"
        )

        payload = {
            "generationConfig": {
                "temperature": 0.1,
                "responseMimeType": "application/json",
            },
            "contents": [{"parts": [{"text": prompt}]}],
        }

        try:
            async with httpx.AsyncClient(timeout=timeout_seconds) as client:
                resp = await client.post(url, json=payload)
                resp.raise_for_status()
            text = (
                resp.json()["candidates"][0]["content"]["parts"][0].get("text", "")
            )
            return json.loads(text)
        except Exception as exc:  # pragma: no cover - external dependency path
            raise ProviderError(str(exc)) from exc


def get_llm_provider(settings: Settings) -> LLMProvider:
    provider = (settings.llm_provider or "openai").strip().lower()
    if provider == "anthropic":
        return AnthropicProvider(settings)
    if provider == "gemini":
        return GeminiProvider(settings)
    return OpenAIProvider(settings)


def get_llm_provider_by_name(settings: Settings, provider_name: str) -> LLMProvider:
    provider = (provider_name or "openai").strip().lower()
    if provider == "anthropic":
        return AnthropicProvider(settings)
    if provider == "gemini":
        return GeminiProvider(settings)
    return OpenAIProvider(settings)


def get_llm_provider_chain(settings: Settings) -> list[LLMProvider]:
    ordered_names: list[str] = ["openai"]
    configured = (settings.llm_provider or "openai").strip().lower()
    if configured in {"openai", "anthropic", "gemini"} and configured not in ordered_names:
        ordered_names.append(configured)

    # Keep the sequence deterministic: OpenAI first, then other supported providers.
    for provider in ("anthropic", "gemini"):
        if provider not in ordered_names:
            ordered_names.append(provider)

    return [get_llm_provider_by_name(settings, name) for name in ordered_names]
