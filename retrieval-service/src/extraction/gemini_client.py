"""The only module that depends on the Gemini SDK."""

import base64
import json
import os
from typing import Any, Dict, List, Optional

DEFAULT_MODEL = "gemini-3.5-flash"

_RESPONSE_SCHEMA = {
    "type": "ARRAY",
    "items": {
        "type": "OBJECT",
        "properties": {
            "raw_text": {"type": "STRING"},
            "event_type": {
                "type": "STRING",
                "enum": ["STARTED", "COMPLETED", "PAUSED", "REWORK", "PROGRESS"],
            },
            "extracted_date": {"type": "STRING"},
            "progress_percent": {"type": "NUMBER", "nullable": True},
            "source_snippet": {"type": "STRING", "nullable": True},
        },
        "required": ["raw_text", "event_type", "extracted_date"],
    },
}


class GeminiExtractionClient:
    def __init__(self, api_key: Optional[str] = None, model_name: Optional[str] = None):
        key = api_key or os.environ.get("GEMINI_API_KEY")
        if not key:
            raise RuntimeError(
                "GEMINI_API_KEY is not set. The extraction engine cannot start without it."
            )

        from google import genai

        self._genai = genai
        self.client = genai.Client(api_key=key)
        self.model_name = model_name or os.environ.get("GEMINI_MODEL") or DEFAULT_MODEL

    def generate(
        self,
        prompt: str,
        document_base64: Optional[str] = None,
        document_mime_type: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        from google.genai import types

        parts: List[Any] = [types.Part.from_text(text=prompt)]

        if document_base64 and document_mime_type:
            parts.append(
                types.Part.from_bytes(
                    data=base64.b64decode(document_base64),
                    mime_type=document_mime_type,
                )
            )

        response = self.client.models.generate_content(
            model=self.model_name,
            contents=[types.Content(role="user", parts=parts)],
            config={
                "response_mime_type": "application/json",
                "response_schema": _RESPONSE_SCHEMA,
            },
        )

        parsed = getattr(response, "parsed", None)
        if isinstance(parsed, list):
            return parsed

        text = (getattr(response, "text", None) or "").strip()
        if not text:
            return []

        decoded = json.loads(text)
        return decoded if isinstance(decoded, list) else []
