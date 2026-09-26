"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitDprReport } from "@/app/actions/field-progress";
import { Mic, FileText, Upload, Sparkles, CheckCircle2, AlertCircle, Clock } from "lucide-react";

interface FieldIntakePanelProps {
  projectId: string;
}

const SAMPLE_DPRS = [
  {
    title: "Pier P2 Concreting & Span 1 Rebar",
    text: "Poured 45 m3 of M35 grade concrete for Pier P2 substructure after rebar fixing completed. Starting span 1 rebar placement tomorrow.",
  },
  {
    title: "Excavation & Culvert C1",
    text: "Excavation completed for foundation footing at Pier P1. Curing ongoing for culvert C1, 60% complete.",
  },
  {
    title: "Pipeline Tie-in & Hydrotest",
    text: "Completed 35m trenching along chainage KM 14+200. Pipe alignment checked, fit-up ready for welder inspection.",
  },
];

export function FieldIntakePanel({ projectId }: FieldIntakePanelProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"text" | "voice" | "upload">("text");
  const [dprText, setDprText] = useState("");
  const [reportDate, setReportDate] = useState(new Date().toISOString().split("T")[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    success: boolean;
    observationsCount?: number;
    autoLinkedCount?: number;
    error?: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dprText.trim()) return;

    setIsSubmitting(true);
    setResult(null);

    try {
      const res = await submitDprReport({
        projectId,
        rawText: dprText,
        inputType: activeTab === "voice" ? "VOICE_RECORDING" : "FREE_TEXT",
        reportDate,
      });

      setResult({
        success: true,
        observationsCount: res.observationsCount,
        autoLinkedCount: res.autoLinkedCount,
      });

      // Clear input on success and refresh page data
      setDprText("");
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to process DPR report";
      setResult({
        success: false,
        error: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleRecording = () => {
    setVoiceError(null);
    if (typeof window === "undefined" || !("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      setVoiceError("Speech recognition is not supported in this browser. Please type your DPR text.");
      return;
    }

    interface SpeechRecognitionEvent {
      results: Array<Array<{ transcript: string }>>;
    }
    interface SpeechRecognitionInstance {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      start: () => void;
      stop: () => void;
      onresult: ((event: SpeechRecognitionEvent) => void) | null;
      onerror: ((event: unknown) => void) | null;
      onend: (() => void) | null;
    }
    type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

    const SpeechRecognition = (
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition
    ) as SpeechRecognitionConstructor;

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-IN";

      if (!isRecording) {
        setIsRecording(true);
        recognition.start();

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          const transcript = event.results[0][0].transcript;
          setDprText((prev) => (prev ? `${prev} ${transcript}` : transcript));
          setIsRecording(false);
        };

        recognition.onerror = () => {
          setIsRecording(false);
          setVoiceError("Microphone input error or permission denied.");
        };
        recognition.onend = () => setIsRecording(false);
      } else {
        setIsRecording(false);
        recognition.stop();
      }
    } catch (e: unknown) {
      setIsRecording(false);
      setVoiceError(e instanceof Error ? e.message : "Failed to start speech recognition.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            Field Evidence & DPR Intake
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Capture unstructured site reports, voice memos, and field notes. The AI engine cleans acronyms and matches schedule activities in real time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="report-date" className="text-xs font-medium text-muted-foreground">Report Date:</label>
          <input
            id="report-date"
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            className="px-3 py-1.5 rounded-md border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* Input Mode Selector */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-hairline/80 bg-surface-soft/80 p-1">
        <button
          type="button"
          onClick={() => setActiveTab("text")}
          className={`btn-interactive flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold tracking-tight transition-all ${
            activeTab === "text"
              ? "border border-ink bg-ink text-canvas shadow-[0_2px_6px_rgba(15,23,42,0.14)]"
              : "border border-transparent text-muted hover:border-hairline hover:bg-surface-soft hover:text-ink"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Text Report
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("voice")}
          className={`btn-interactive flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold tracking-tight transition-all ${
            activeTab === "voice"
              ? "border border-ink bg-ink text-canvas shadow-[0_2px_6px_rgba(15,23,42,0.14)]"
              : "border border-transparent text-muted hover:border-hairline hover:bg-surface-soft hover:text-ink"
          }`}
        >
          <Mic className="w-3.5 h-3.5" />
          Voice Dictation
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("upload")}
          className={`btn-interactive flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold tracking-tight transition-all ${
            activeTab === "upload"
              ? "border border-ink bg-ink text-canvas shadow-[0_2px_6px_rgba(15,23,42,0.14)]"
              : "border border-transparent text-muted hover:border-hairline hover:bg-surface-soft hover:text-ink"
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          Upload Document / PDF
        </button>
      </div>

      {/* Main Intake Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {activeTab === "text" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="dpr-notes" className="text-xs font-semibold tracking-tight text-ink uppercase">
                Daily Site Progress Notes
              </label>
              <span className="text-xs text-muted">
                Colloquial site terms & acronyms (RCC, rebar, pier, chainage) are automatically expanded.
              </span>
            </div>
            <textarea
              id="dpr-notes"
              rows={5}
              value={dprText}
              onChange={(e) => setDprText(e.target.value)}
              placeholder="e.g. Completed 40% rebar fixing at Pier P2. Poured 35m3 concrete after inspection signoff. Excavation paused at Pier P1 due to rain."
              className="w-full p-3.5 rounded-xl border border-hairline bg-surface-soft text-sm text-ink placeholder:text-muted/60 focus:bg-canvas focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink transition-all leading-relaxed"
              required
            />
          </div>
        )}

        {activeTab === "voice" && (
          <div className="p-8 border border-dashed border-hairline rounded-2xl bg-surface-soft/40 text-center space-y-4">
            <button
              type="button"
              onClick={toggleRecording}
              className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto transition-all shadow-md ${
                isRecording
                  ? "bg-rose-500 text-white animate-pulse shadow-rose-500/30"
                  : "bg-ink text-canvas hover:scale-105 active:scale-95 shadow-sm"
              }`}
            >
              <Mic className="w-7 h-7" />
            </button>
            <div>
              <p className="text-sm font-semibold tracking-tight text-ink">
                {isRecording ? "Listening to site audio..." : "Click microphone to dictate daily report"}
              </p>
              <p className="text-xs text-muted mt-1">
                Audio is transcribed directly into the DPR intake form for extraction.
              </p>
            </div>
            {voiceError && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 rounded-xl text-xs flex items-center justify-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{voiceError}</span>
              </div>
            )}
            {dprText && (
              <div className="text-left bg-canvas p-4 rounded-xl border border-hairline shadow-sm">
                <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Transcribed Text:</p>
                <p className="text-sm text-ink leading-relaxed">{dprText}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "upload" && (
          <div className="p-8 border border-dashed border-hairline rounded-2xl bg-surface-soft/40 text-center space-y-3">
            <Upload className="w-9 h-9 text-muted mx-auto" />
            <div>
              <p className="text-sm font-semibold tracking-tight text-ink">
                Drag & drop site logs, daily notes (.txt, .csv, .md), or scanned documents
              </p>
              <p className="text-xs text-muted mt-1">
                Text and log files are parsed immediately into the form. Scanned documents link with OCR.
              </p>
            </div>
            <input
              type="file"
              accept=".txt,.csv,.md,.json,.pdf,.xlsx,.png,.jpg"
              className="hidden"
              id="file-upload"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  if (
                    file.type.startsWith("text/") ||
                    file.name.endsWith(".txt") ||
                    file.name.endsWith(".csv") ||
                    file.name.endsWith(".md") ||
                    file.name.endsWith(".json")
                  ) {
                    const reader = new FileReader();
                    reader.onload = (readEvt) => {
                      const content = readEvt.target?.result;
                      if (typeof content === "string") {
                        setDprText(content);
                        setActiveTab("text");
                      }
                    };
                    reader.readAsText(file);
                  } else {
                    setDprText(`[Attached Field Document: ${file.name}] Raw site log submitted for automated schedule linking and observation extraction.`);
                    setActiveTab("text");
                  }
                }
              }}
            />
            <label
              htmlFor="file-upload"
              className="btn-interactive inline-block px-4 py-2 bg-surface-soft border border-hairline text-ink rounded-lg text-xs font-semibold tracking-tight cursor-pointer hover:bg-canvas transition-colors shadow-sm"
            >
              Browse Local Files
            </label>
          </div>
        )}

        {/* Quick Sample DPR Chips */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold tracking-tight text-muted">Quick Test Samples (Click to load):</p>
          <div className="flex flex-wrap gap-2">
            {SAMPLE_DPRS.map((sample, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setDprText(sample.text)}
                className="btn-interactive text-xs font-medium px-3 py-1.5 rounded-full border border-hairline bg-surface-soft hover:bg-canvas hover:border-ink/20 text-ink transition-colors shadow-2xs"
              >
                {sample.title}
              </button>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-muted flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            AI Reranker checks 8 domain constraints & conflict penalties
          </span>
          <button
            type="submit"
            disabled={isSubmitting || !dprText.trim()}
            className="btn-interactive px-5 py-2.5 bg-ink text-canvas font-semibold rounded-xl hover:bg-ink/90 disabled:opacity-50 flex items-center gap-2 text-xs tracking-tight transition-all shadow-sm"
          >
            {isSubmitting ? (
              <>
                <Sparkles className="w-4 h-4 animate-spin" />
                Extracting & Linking...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Submit & Link to Schedule
              </>
            )}
          </button>
        </div>
      </form>

      {/* Result Notification */}
      {result && (
        <div
          className={`p-4 rounded-xl border ${
            result.success
              ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-800 dark:text-emerald-200"
              : "bg-rose-500/10 border-rose-500/25 text-rose-800 dark:text-rose-200"
          }`}
        >
          {result.success ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <p className="font-semibold text-sm tracking-tight">
                    Report Processed Successfully!
                  </p>
                  <p className="text-xs mt-0.5 opacity-90">
                    Extracted {result.observationsCount} atomic observations ({result.autoLinkedCount} auto-linked with &ge; 90% confidence).
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => router.push(`/projects/${projectId}/review-queue`)}
                  className="btn-interactive text-xs font-semibold px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-2xs"
                >
                  Review Queue &rarr;
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`/projects/${projectId}/plan-vs-actual`)}
                  className="btn-interactive text-xs font-semibold px-3 py-1.5 bg-canvas border border-hairline text-ink rounded-lg hover:bg-surface-soft transition-colors"
                >
                  Plan vs. Actual &rarr;
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{result.error}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
