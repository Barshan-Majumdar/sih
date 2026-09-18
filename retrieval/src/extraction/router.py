"""FastAPI surface for the extraction engine."""

from typing import Callable, Optional

from fastapi import APIRouter, HTTPException

from .schemas import ExtractRequest, ExtractResponse
from .service import ExtractionService


def default_service_factory() -> ExtractionService:
    from .gemini_client import GeminiExtractionClient

    return ExtractionService(client=GeminiExtractionClient())


def build_extraction_router(
    service_factory: Callable[[], ExtractionService] = default_service_factory,
) -> APIRouter:
    router = APIRouter(prefix="/api/extraction", tags=["extraction"])

    cached: dict = {}

    def get_service() -> ExtractionService:
        if "service" not in cached:
            cached["service"] = service_factory()
        return cached["service"]

    @router.get("/health")
    def health():
        try:
            service = get_service()
        except Exception as err:
            return {"status": "unconfigured", "model": None, "error": str(err)}
        return {"status": "online", "model": service.client.model_name}

    @router.post("/analyze", response_model=ExtractResponse)
    def analyze(req: ExtractRequest):
        try:
            service = get_service()
        except Exception as err:
            raise HTTPException(status_code=503, detail=str(err))

        try:
            return service.extract(req)
        except Exception as err:
            raise HTTPException(status_code=502, detail=f"Extraction failed: {err}")

    return router
