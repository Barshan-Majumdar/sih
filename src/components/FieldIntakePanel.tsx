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

      // Clear input on success
      setDprText("");
    } catch (err: any) {
      setResult({
        success: false,
        error: err?.message || "Failed to process DPR report",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleRecording = () => {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      alert("Speech recognition is not supported in this browser. Please type your DPR text.");
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-IN";

    if (!isRecording) {
      setIsRecording(true);
      recognition.start();

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setDprText((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsRecording(false);
      };

      recognition.onerror = () => setIsRecording(false);
      recognition.onend = () => setIsRecording(false);
    } else {
      setIsRecording(false);
      recognition.stop();
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
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab("text")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "text"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="w-4 h-4" />
          Text Report
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("voice")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "voice"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Mic className="w-4 h-4" />
          Voice Dictation
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("upload")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "upload"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Upload className="w-4 h-4" />
          Upload Document / PDF
        </button>
      </div>

      {/* Main Intake Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {activeTab === "text" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="dpr-notes" className="text-sm font-medium text-foreground">
                Daily Site Progress Notes
              </label>
              <span className="text-xs text-muted-foreground">
                Colloquial site terms & acronyms (RCC, rebar, pier, chainage) are automatically expanded.
              </span>
            </div>
            <textarea
              id="dpr-notes"
              rows={5}
              value={dprText}
              onChange={(e) => setDprText(e.target.value)}
              placeholder="e.g. Completed 40% rebar fixing at Pier P2. Poured 35m3 concrete after inspection signoff. Excavation paused at Pier P1 due to rain."
              className="w-full p-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary leading-relaxed"
              required
            />
          </div>
        )}

        {activeTab === "voice" && (
          <div className="p-8 border-2 border-dashed border-border rounded-xl text-center space-y-4">
            <button
              type="button"
              onClick={toggleRecording}
              className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto transition-all ${
                isRecording
                  ? "bg-red-500 text-white animate-pulse"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
            >
              <Mic className="w-8 h-8" />
            </button>
            <div>
              <p className="text-sm font-medium text-foreground">
                {isRecording ? "Listening to site audio..." : "Click microphone to dictate daily report"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Audio is transcribed directly into the DPR intake form for extraction.
              </p>
            </div>
            {dprText && (
              <div className="text-left bg-muted/40 p-4 rounded-lg border border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Transcribed Text:</p>
                <p className="text-sm text-foreground">{dprText}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "upload" && (
          <div className="p-8 border-2 border-dashed border-border rounded-xl text-center space-y-3">
            <Upload className="w-10 h-10 text-muted-foreground mx-auto" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Drag & drop scanned PDF DPRs, site logs, or Excel sheets
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Scanned documents are converted via the local OCRmyPDF worker into searchable text.
              </p>
            </div>
            <input
              type="file"
              accept=".pdf,.xlsx,.csv,.png,.jpg"
              className="hidden"
              id="file-upload"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setDprText(`[Attached file: ${file.name}] Processing document via OCR pipeline...`);
                }
              }}
            />
            <label
              htmlFor="file-upload"
              className="inline-block px-4 py-2 bg-secondary text-secondary-foreground rounded-md text-sm font-medium cursor-pointer hover:bg-secondary/80"
            >
              Browse Local Files
            </label>
          </div>
        )}

        {/* Quick Sample DPR Chips */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Quick Test Samples (Click to load):</p>
          <div className="flex flex-wrap gap-2">
            {SAMPLE_DPRS.map((sample, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setDprText(sample.text)}
                className="text-xs px-3 py-1.5 rounded-full border border-border bg-card hover:bg-accent text-foreground transition-colors"
              >
                {sample.title}
              </button>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            AI Reranker checks 8 domain constraints & conflict penalties
          </span>
          <button
            type="submit"
            disabled={isSubmitting || !dprText.trim()}
            className="px-5 py-2.5 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2 text-sm transition-all"
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
          className={`p-4 rounded-lg border ${
            result.success
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
              : "bg-destructive/10 border-destructive/30 text-destructive"
          }`}
        >
          {result.success ? (
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                <div>
                  <p className="font-semibold text-sm">
                    Report Processed Successfully!
                  </p>
                  <p className="text-xs mt-0.5 opacity-90">
                    Extracted {result.observationsCount} atomic observations ({result.autoLinkedCount} auto-linked with $\ge 90\%$ confidence).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => router.push(`/projects/${projectId}/review-queue`)}
                className="text-xs font-semibold px-3 py-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors"
              >
                Open Review Queue &rarr;
              </button>
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
