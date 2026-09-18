"""
Unified OCR and Document Searchable PDF Router.
Allows the Python microservice on Port 8000 to handle both AI Retrieval and OCR/PDF conversion.
"""

import hmac
import logging
import os
import shutil
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Header, HTTPException, Request, Response

logger = logging.getLogger("agira-ocr")
router = APIRouter(tags=["OCR & Document Conversion"])

MAX_INPUT_BYTES = 25 * 1024 * 1024
MAX_OUTPUT_BYTES = 60 * 1024 * 1024
SUPPORTED_TYPES = {"application/pdf", "image/png", "image/jpeg", "image/webp"}

try:
    from PIL import Image
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

try:
    import img2pdf
    HAS_IMG2PDF = True
except ImportError:
    HAS_IMG2PDF = False

HAS_OCRMYPDF = shutil.which("ocrmypdf") is not None


def check_token(authorization: Optional[str]) -> None:
    expected = os.environ.get("OCR_SERVICE_TOKEN", "dev-local-ocr-token").strip()
    if not expected:
        return
    supplied = authorization.removeprefix("Bearer ").strip() if authorization else ""
    if not hmac.compare_digest(expected, supplied):
        raise HTTPException(status_code=401, detail="Unauthorized")


def image_to_pdf(source: Path, destination: Path) -> None:
    """Convert an image to PDF using img2pdf or Pillow."""
    if not HAS_PIL:
        raise HTTPException(status_code=503, detail="Pillow is not installed. Please run: pip install Pillow")
    if HAS_IMG2PDF:
        with Image.open(source) as image:
            if image.mode not in {"RGB", "L"}:
                image = image.convert("RGB")
            normalized = source.with_suffix(".normalized.png")
            image.save(normalized, format="PNG")
        pdf_bytes = img2pdf.convert(str(normalized))
        if pdf_bytes is None:
            raise RuntimeError("Failed to convert image to PDF")
        destination.write_bytes(pdf_bytes)
    else:
        with Image.open(source) as image:
            rgb_image = image.convert("RGB")
            rgb_image.save(destination, format="PDF")


@router.post("/v1/ocr")
async def process_ocr(
    request: Request,
    authorization: Optional[str] = Header(default=None),
    x_file_name: Optional[str] = Header(default=None),
) -> Response:
    """
    Unified OCR endpoint that converts images and scanned documents into searchable PDFs.
    Matches the schema expected by Next.js ocr-service.ts.
    """
    started_at = time.monotonic()
    check_token(authorization)

    media_type = request.headers.get("content-type", "").split(";", 1)[0].lower()
    if media_type not in SUPPORTED_TYPES:
        raise HTTPException(status_code=415, detail="Unsupported file type")

    body = await request.body()
    if not body or len(body) > MAX_INPUT_BYTES:
        raise HTTPException(status_code=413, detail="File is empty or exceeds size limit")

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
                logger.error(f"Failed to convert image to PDF: {error}")
                raise HTTPException(status_code=422, detail="Invalid image file") from error

        output_pdf = root / "searchable.pdf"

        if HAS_OCRMYPDF:
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
            except Exception as err:
                logger.warning(f"ocrmypdf encountered an issue, falling back to input PDF: {err}")
                output_pdf = input_pdf
        else:
            output_pdf = input_pdf

        result = output_pdf.read_bytes()
        if not result.startswith(b"%PDF-") or len(result) > MAX_OUTPUT_BYTES:
            raise HTTPException(status_code=422, detail="Invalid PDF output generated")

    safe_name = (x_file_name or "document").replace("\r", "").replace("\n", "")
    elapsed_ms = round((time.monotonic() - started_at) * 1000)
    logger.info(f"OCR request completed in {elapsed_ms}ms ({len(result)} bytes)")

    return Response(
        content=result,
        media_type="application/pdf",
        headers={
            "Cache-Control": "no-store",
            "X-OCR-Engine": "ocrmypdf" if HAS_OCRMYPDF else "pillow-pdf",
            "X-Source-File": safe_name[:180],
        },
    )
