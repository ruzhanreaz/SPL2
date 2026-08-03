from __future__ import annotations

import asyncio
from collections.abc import AsyncGenerator

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from app.core.security import InMemoryRateLimiter, client_ip, sanitize_symptoms
from app.core.settings import get_settings
from app.schemas.triage import TriageRequest, TriageResult, TriageStreamEvent
from app.services.triage import TriageService

settings = get_settings()
router = APIRouter(tags=["triage"])
_rate_limiter = InMemoryRateLimiter(settings.triage_requests_per_minute)


def _enforce_security(request: Request, payload: TriageRequest) -> TriageRequest:
    _rate_limiter.check(client_ip(request))
    return TriageRequest(symptoms=sanitize_symptoms(payload.symptoms))


@router.post("/triage", response_model=TriageResult)
async def triage(
    payload: TriageRequest,
    request: Request,
) -> TriageResult:
    sanitized = _enforce_security(request, payload)
    service = TriageService()
    return await service.triage(sanitized.symptoms)


@router.post("/triage/stream")
async def triage_stream(
    payload: TriageRequest,
    request: Request,
) -> StreamingResponse:
    sanitized = _enforce_security(request, payload)
    service = TriageService()

    async def event_stream() -> AsyncGenerator[str, None]:
        triage_task = asyncio.create_task(service.triage(sanitized.symptoms))
        started = TriageStreamEvent(event="progress", message="triage_started")
        yield f"data: {started.model_dump_json()}\n\n"

        while not triage_task.done():
            keepalive = TriageStreamEvent(event="progress", message="processing")
            yield f"data: {keepalive.model_dump_json()}\n\n"
            await asyncio.sleep(1)

        result = await triage_task
        done = TriageStreamEvent(event="result", message="triage_completed", result=result)
        yield f"data: {done.model_dump_json()}\n\n"
        yield "data: [DONE]\n\n"

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    return StreamingResponse(event_stream(), media_type="text/event-stream", headers=headers)
