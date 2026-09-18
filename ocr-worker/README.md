# Agira OCR worker

This private worker uses OCRmyPDF and Tesseract to turn scanned PDFs and images
into searchable PDFs. It has no paid API dependency.

1. Set `OCR_SERVICE_TOKEN` to a long random value.
2. Run from the repository root:

   ```powershell
   $env:OCR_SERVICE_TOKEN="replace-with-a-long-random-token"
   docker compose -f docker-compose.ocr.yml up --build
   ```

3. Add the same token and `OCR_SERVICE_URL=http://localhost:8010` to the Next.js
   `.env` file.
4. Confirm `http://localhost:8010/health` returns `{"status":"ok"...}`.

The worker accepts at most 20 MB per request, processes one job per container,
does not persist source files, and should not be exposed publicly without TLS
and network-level access controls.
