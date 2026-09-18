"""Orchestrates the LLM call, then repairs and validates what comes back."""

import logging
import time
from typing import Any, Dict, List, Optional, Protocol

from pydantic import ValidationError

from .prompt import build_extraction_prompt
from .schemas import ExtractedObservationItem, ExtractRequest, ExtractResponse

logger = logging.getLogger(__name__)


class ExtractionClient(Protocol):
    model_name: str

    def generate(
        self,
        prompt: str,
        document_base64: Optional[str] = None,
        document_mime_type: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        ...


class ExtractionService:
    def __init__(self, client: ExtractionClient, normalizer: Any = None):
        self.client = client
        self.normalizer = normalizer

    def extract(self, req: ExtractRequest) -> ExtractResponse:
        prompt = build_extraction_prompt(req.report_text, req.report_date)

        started = time.time()
        raw_items = self.client.generate(
            prompt=prompt,
            document_base64=req.document_base64,
            document_mime_type=req.document_mime_type,
        )
        elapsed_ms = (time.time() - started) * 1000

        items: List[ExtractedObservationItem] = []
        discarded = 0
        for index, raw in enumerate(raw_items or []):
            item = self._coerce(raw, req.report_date, index)
            if item is not None:
                items.append(item)
            else:
                discarded += 1

        return ExtractResponse(
            items=items,
            observations=items,
            model=self.client.model_name,
            elapsed_ms=round(elapsed_ms, 2),
            discarded=discarded,
        )

    def _coerce(
        self, raw: Dict[str, Any], report_date: Optional[str], index: int
    ) -> Optional[ExtractedObservationItem]:
        """A model that returns one bad item must not lose the good ones."""
        if not isinstance(raw, dict):
            logger.warning(
                "Discarding extraction item %d: expected an object, got %s",
                index,
                type(raw).__name__,
            )
            return None

        candidate = dict(raw)

        if not candidate.get("extracted_date") and report_date:
            candidate["extracted_date"] = report_date

        progress = candidate.get("progress_percent")
        if isinstance(progress, (int, float)):
            candidate["progress_percent"] = max(0.0, min(100.0, float(progress)))

        try:
            return ExtractedObservationItem(**candidate)
        except ValidationError as err:
            logger.warning("Discarding extraction item %d: %s", index, err)
            return None
