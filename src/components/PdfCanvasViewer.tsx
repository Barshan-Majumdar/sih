"use client";

import { useEffect, useRef, useState } from "react";
import { reportException } from "@/lib/observability-core";
import { highlightPdfTextItem, type PdfViewerDocument } from "@/lib/pdf-viewer";

type PdfViewport = {
  width: number;
  height: number;
  scale: number;
  rotation: number;
  rawDims: { pageWidth: number; pageHeight: number; pageX: number; pageY: number };
};

type PdfPage = {
  getViewport: (options: { scale: number }) => PdfViewport;
  getTextContent: () => Promise<object>;
  render: (options: {
    canvas: HTMLCanvasElement;
    viewport: PdfViewport;
    transform?: number[];
  }) => { promise: Promise<void>; cancel: () => void };
};

type PdfDocument = {
  numPages: number;
  getPage: (page: number) => Promise<PdfPage>;
  destroy: () => Promise<void>;
};

type PdfJsRuntime = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (options: { url: string; withCredentials: boolean }) => {
    promise: Promise<PdfDocument>;
    destroy: () => Promise<void>;
  };
  TextLayer: new (options: {
    textContentSource: object;
    container: HTMLDivElement;
    viewport: PdfViewport;
  }) => { render: () => Promise<void>; cancel: () => void };
};

const PDFJS_RUNTIME_URL = "/pdfjs/pdf.mjs";
let runtimePromise: Promise<PdfJsRuntime> | null = null;

function loadPdfJs(): Promise<PdfJsRuntime> {
  runtimePromise ??= import(/* webpackIgnore: true */ PDFJS_RUNTIME_URL) as Promise<PdfJsRuntime>;
  return runtimePromise;
}

export function PdfCanvasViewer({
  document,
  page,
  onPageCountChange,
}: {
  document: PdfViewerDocument;
  page: number;
  onPageCountChange: (pageCount: number) => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [pdfDocument, setPdfDocument] = useState<PdfDocument | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const updateWidth = () => setWidth(Math.max(280, viewport.clientWidth - 32));
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    let loadingTask: ReturnType<PdfJsRuntime["getDocument"]> | null = null;

    void (async () => {
      try {
        const runtime = await loadPdfJs();
        runtime.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.mjs";
        loadingTask = runtime.getDocument({ url: document.url, withCredentials: true });
        const loadedDocument = await loadingTask.promise;
        if (!active) {
          await loadedDocument.destroy();
          return;
        }
        setPdfDocument(loadedDocument);
        onPageCountChange(loadedDocument.numPages);
      } catch (error) {
        if (active) {
          reportException(error, "pdf_viewer.load_failed", { surface: "pdf-viewer", operation: "load" });
          setStatus("error");
        }
      }
    })();

    return () => {
      active = false;
      if (loadingTask) void loadingTask.destroy().catch(() => undefined);
    };
  }, [document.url, onPageCountChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const textLayerContainer = textLayerRef.current;
    if (!pdfDocument || !canvas || !textLayerContainer) return;
    let active = true;
    let renderTask: ReturnType<PdfPage["render"]> | null = null;
    let textLayer: InstanceType<PdfJsRuntime["TextLayer"]> | null = null;

    void (async () => {
      try {
        const runtime = await loadPdfJs();
        const pdfPage = await pdfDocument.getPage(page);
        if (!active) return;
        const naturalViewport = pdfPage.getViewport({ scale: 1 });
        const scale = width / naturalViewport.width;
        const viewport = pdfPage.getViewport({ scale });
        const outputScale = Math.min(window.devicePixelRatio || 1, 2);

        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        textLayerContainer.replaceChildren();
        textLayerContainer.style.setProperty("--scale-factor", String(scale));
        textLayerContainer.style.setProperty("--total-scale-factor", String(scale));

        renderTask = pdfPage.render({
          canvas,
          viewport,
          transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
        });
        const textContent = await pdfPage.getTextContent();
        textLayer = new runtime.TextLayer({
          textContentSource: textContent,
          container: textLayerContainer,
          viewport,
        });
        await Promise.all([renderTask.promise, textLayer.render()]);
        if (!active) return;

        for (const span of textLayerContainer.querySelectorAll<HTMLElement>("span")) {
          span.innerHTML = highlightPdfTextItem(span.textContent ?? "", document.highlight);
        }
        setStatus("ready");
        window.requestAnimationFrame(() => {
          textLayerContainer
            .querySelector<HTMLElement>('[data-pdf-citation-highlight="true"]')
            ?.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
        });
      } catch (error) {
        if (active && (error as { name?: string }).name !== "RenderingCancelledException") {
          reportException(error, "pdf_viewer.render_failed", { surface: "pdf-viewer", operation: "render" });
          setStatus("error");
        }
      }
    })();

    return () => {
      active = false;
      renderTask?.cancel();
      textLayer?.cancel();
    };
  }, [document.highlight, page, pdfDocument, width]);

  return (
    <div ref={viewportRef} className="relative min-h-0 flex-1 overflow-auto bg-[#e8eaed] p-4">
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/pdfjs/pdf_viewer.css" />
      {status === "loading" && (
        <p className="absolute inset-x-4 top-12 text-center text-sm text-[#5f6368]">Loading PDF...</p>
      )}
      {status === "error" && (
        <p className="py-12 text-center text-sm text-error">This PDF could not be displayed.</p>
      )}
      <div
        className={`relative mx-auto overflow-hidden bg-white shadow-[0_2px_12px_rgba(17,17,17,0.18)] ${
          status === "error" ? "hidden" : ""
        }`}
        style={{ width }}
      >
        <canvas ref={canvasRef} className="block" aria-label={`PDF page ${page}`} />
        <div ref={textLayerRef} className="textLayer" />
      </div>
    </div>
  );
}
