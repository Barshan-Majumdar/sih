import hmac
import io
import json
import logging
import os
import subprocess
import tempfile
import time
import uuid
from pathlib import Path

import img2pdf
from fastapi import FastAPI, Header, HTTPException, Request, Response
from PIL import Image

MAX_INPUT_BYTES = 20 * 1024 * 1024
MAX_OUTPUT_BYTES = 50 * 1024 * 1024
SUPPORTED_TYPES = {"application/pdf", "image/png", "image/jpeg", "image/webp"}

app = FastAPI(title="Agira OCR", docs_url=None, redoc_url=None)
logger = logging.getLogger("agira-ocr")
logger.setLevel(logging.INFO)
logger.addHandler(logging.StreamHandler())


def log_event(severity: str, event: str, **metadata: object) -> None:
    logger.log(
        getattr(logging, severity, logging.INFO),
        json.dumps(
            {
                "severity": severity,
                "service": "agira-ocr",
                "event": event,
                **metadata,
            },
            separators=(",", ":"),
            default=str,
        ),
    )


@app.middleware("http")
async def observe_request(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    request.state.request_id = request_id
    started_at = time.monotonic()
    try:
        response = await call_next(request)
    except Exception as error:
        log_event(
            "ERROR",
            "ocr.http.failed",
            requestId=request_id,
            method=request.method,
            path=request.url.path,
            durationMs=round((time.monotonic() - started_at) * 1000),
            errorType=type(error).__name__,
        )
        raise
    response.headers["X-Request-ID"] = request_id
    log_event(
        "ERROR" if response.status_code >= 500 else "WARNING" if response.status_code >= 400 else "INFO",
        "ocr.http.completed",
        requestId=request_id,
        method=request.method,
        path=request.url.path,
        status=response.status_code,
        durationMs=round((time.monotonic() - started_at) * 1000),
    )
    return response


def require_token(authorization: str | None) -> None:
    expected = os.environ.get("OCR_SERVICE_TOKEN", "").strip()
    supplied = authorization.removeprefix("Bearer ").strip() if authorization else ""
    if not expected or not hmac.compare_digest(expected, supplied):
        raise HTTPException(status_code=401, detail="Unauthorized")


def image_to_pdf(source: Path, destination: Path) -> None:
    with Image.open(source) as image:
        if image.mode not in {"RGB", "L"}:
            image = image.convert("RGB")
        normalized = source.with_suffix(".normalized.png")
        image.save(normalized, format="PNG")
    destination.write_bytes(img2pdf.convert(str(normalized)))


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "engine": "ocrmypdf"}


@app.post("/v1/ocr")
async def ocr(
    request: Request,
    authorization: str | None = Header(default=None),
    x_file_name: str | None = Header(default=None),
) -> Response:
    started_at = time.monotonic()
    require_token(authorization)
    media_type = request.headers.get("content-type", "").split(";", 1)[0].lower()
    if media_type not in SUPPORTED_TYPES:
        raise HTTPException(status_code=415, detail="Unsupported file type")
    body = await request.body()
    if not body or len(body) > MAX_INPUT_BYTES:
        raise HTTPException(status_code=413, detail="File is empty or too large")
    log_event(
        "INFO",
        "ocr.processing.started",
        requestId=request.state.request_id,
        mediaType=media_type,
        inputSizeBytes=len(body),
    )

    suffix = {
        "application/pdf": ".pdf",
        "image/png": ".png",
        "image/jpeg": ".jpg",
        "image/webp": ".webp",
    }[media_type]
    with tempfile.TemporaryDirectory(prefix="agira-ocr-") as temp_dir:
        root = Path(temp_dir)
        source = root / f"source{suffix}"
        source.write_bytes(body)
        input_pdf = source if media_type == "application/pdf" else root / "image.pdf"
        if media_type != "application/pdf":
            try:
                image_to_pdf(source, input_pdf)
            except Exception as error:
                raise HTTPException(status_code=422, detail="Invalid image") from error

        output_pdf = root / "searchable.pdf"
        command = [
            "ocrmypdf",
            "--skip-text",
            "--rotate-pages",
            "--deskew",
            "--output-type",
            "pdf",
            "--jobs",
            "1",
            str(input_pdf),
            str(output_pdf),
        ]
        try:
            subprocess.run(command, check=True, capture_output=True, timeout=110)
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
            raise HTTPException(status_code=422, detail="OCR processing failed") from error
        result = output_pdf.read_bytes()
        if not result.startswith(b"%PDF-") or len(result) > MAX_OUTPUT_BYTES:
            raise HTTPException(status_code=422, detail="Invalid OCR output")

    safe_name = (x_file_name or "document").replace("\r", "").replace("\n", "")
    log_event(
        "INFO",
        "ocr.processing.completed",
        requestId=request.state.request_id,
        outputSizeBytes=len(result),
        durationMs=round((time.monotonic() - started_at) * 1000),
    )
    return Response(
        content=result,
        media_type="application/pdf",
        headers={
            "Cache-Control": "no-store",
            "X-OCR-Engine": "ocrmypdf",
            "X-Source-File": safe_name[:180],
        },
    )
