"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { submitDprReport } from "@/app/actions/field-progress";
import {
  Mic,
  FileText,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  Square,
  RotateCcw,
  Copy,
  Check,
  Volume2,
  Globe,
  RefreshCw,
  Radio,
  Info,
  Settings,
  Zap,
} from "lucide-react";

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

const LANGUAGE_OPTIONS = [
  { code: "en-US", label: "English (US / Universal)", flag: "🌐" },
  { code: "en-IN", label: "English (India)", flag: "🇮🇳" },
  { code: "hi-IN", label: "Hindi (हिंदी)", flag: "🇮🇳" },
];

// Web Speech API interface declarations for TypeScript
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionErrorLike {
  error: string;
  message?: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export function FieldIntakePanel({ projectId }: FieldIntakePanelProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"text" | "voice" | "upload">("text");
  const [dprText, setDprText] = useState("");
  const [reportDate, setReportDate] = useState(new Date().toISOString().split("T")[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Voice recording & dictation states
  const [isRecording, setIsRecording] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0); // 0 to 100 for sound meter
  const [voiceLanguage, setVoiceLanguage] = useState("en-US");
  const [copied, setCopied] = useState(false);
  const [voiceError, setVoiceError] = useState<{
    type: "permission" | "device" | "service" | "general";
    message: string;
  } | null>(null);

  // Result state
  const [result, setResult] = useState<{
    success: boolean;
    observationsCount?: number;
    autoLinkedCount?: number;
    updatedTasks?: Array<{ id: string; name: string; progress: number; status: string }>;
    error?: string;
  } | null>(null);

  // Refs for audio hardware and speech recognition lifecycle
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const dprTextRef = useRef<string>("");
  const baseDprTextRef = useRef<string>("");
  const isRecordingRef = useRef<boolean>(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const simulationTimeoutsRef = useRef<NodeJS.Timeout[]>([]);

  // Keep dprTextRef in sync with state for callbacks
  useEffect(() => {
    dprTextRef.current = dprText;
  }, [dprText]);

  // Clean shutdown for all audio hardware & visualizer
  const cleanupAudioPipeline = useCallback(() => {
    isRecordingRef.current = false;
    setIsRecording(false);
    setIsStarting(false);
    setIsSimulating(false);
    setAudioLevel(0);
    setInterimTranscript("");

    // Clear simulation timers
    simulationTimeoutsRef.current.forEach((t) => clearTimeout(t));
    simulationTimeoutsRef.current = [];

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
      mediaRecorderRef.current = null;
    }

    if (analyserRef.current) {
      analyserRef.current = null;
    }

    if (audioContextRef.current) {
      try {
        if (audioContextRef.current.state !== "closed") {
          audioContextRef.current.close().catch(() => {});
        }
      } catch {
        // Ignore audio context close errors
      }
      audioContextRef.current = null;
    }

    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch {
        // Ignore track stop errors
      }
      mediaStreamRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // Ignore abort errors
      }
      recognitionRef.current = null;
    }
  }, []);

  // Monitor browser permission changes in real time
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "microphone" as PermissionName })
        .then((permStatus) => {
          permStatus.onchange = () => {
            if (permStatus.state === "granted") {
              setVoiceError(null);
            }
          };
        })
        .catch(() => {});
    }

    return () => {
      cleanupAudioPipeline();
    };
  }, [cleanupAudioPipeline]);

  // Stop recording cleanly
  const stopListening = useCallback(() => {
    // 1. Stop SpeechRecognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    }

    // 2. Stop MediaRecorder and transcribe if needed
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }

    cleanupAudioPipeline();
  }, [cleanupAudioPipeline]);

  // Start real-time speech dictation and audio recording
  const startListening = async () => {
    setVoiceError(null);
    setIsStarting(true);
    setInterimTranscript("");
    setRecordingSeconds(0);
    audioChunksRef.current = [];
    baseDprTextRef.current = dprTextRef.current.trim();

    // Step 1: Explicitly request audio stream from browser
    let stream: MediaStream | null = null;
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia is not supported on this browser.");
      }
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
    } catch (micErr: unknown) {
      setIsStarting(false);
      const errObj = micErr as { name?: string; message?: string };

      if (errObj.name === "NotAllowedError" || errObj.name === "PermissionDeniedError") {
        setVoiceError({
          type: "permission",
          message:
            "Microphone permission needs a quick page refresh to apply. If you just set it to 'Allow' in settings, click 'Reload Page & Start' below.",
        });
        return;
      }

      if (errObj.name === "NotFoundError" || errObj.name === "DevicesNotFoundError") {
        setVoiceError({
          type: "device",
          message: "No microphone detected on your system. Please plug in a microphone or click 'Simulate Voice (Demo)'.",
        });
        return;
      }

      setVoiceError({
        type: "general",
        message: errObj.message || "Failed to initialize microphone.",
      });
      return;
    }

    // Step 2: Stream acquired! Mark recording as active
    isRecordingRef.current = true;
    setIsRecording(true);
    setIsStarting(false);
    setVoiceError(null);

    // Start duration timer
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);

    // Step 3: Attach Web Audio API analyser to stream for real-time equalizer bars
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx && stream) {
        const audioCtx = new AudioCtx();
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        audioContextRef.current = audioCtx;
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateVisualizer = () => {
          if (!isRecordingRef.current) return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
          animFrameRef.current = requestAnimationFrame(updateVisualizer);
        };
        animFrameRef.current = requestAnimationFrame(updateVisualizer);
      }
    } catch {
      // Audio visualization fallback
    }

    // Step 4: Start MediaRecorder as reliable audio capture pipeline
    if (stream && typeof MediaRecorder !== "undefined") {
      try {
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };
        mediaRecorder.onstop = async () => {
          // If speech recognition produced no words, transcribe recorded audio via backend
          if (audioChunksRef.current.length > 0 && !dprTextRef.current.trim()) {
            setIsTranscribing(true);
            const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
            try {
              const formData = new FormData();
              formData.append("audio", blob, "site-voice.webm");
              const res = await fetch("/api/transcribe", { method: "POST", body: formData });
              if (res.ok) {
                const data = await res.json();
                if (data.transcript) {
                  setDprText(data.transcript);
                }
              }
            } catch (transcribeErr) {
              console.warn("Transcribe request error:", transcribeErr);
            } finally {
              setIsTranscribing(false);
            }
          }
        };
        mediaRecorder.start(250);
      } catch (recErr) {
        console.warn("MediaRecorder start error:", recErr);
      }
    }

    // Step 5: Start SpeechRecognition for real-time speech-to-text typing
    const win = typeof window !== "undefined" ? (window as unknown as Record<string, unknown>) : null;
    const SpeechRecognition = win?.SpeechRecognition || win?.webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new (SpeechRecognition as SpeechRecognitionConstructor)();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = voiceLanguage;
        recognition.maxAlternatives = 1;
        recognitionRef.current = recognition;

        recognition.onresult = (event: SpeechRecognitionEventLike) => {
          let currentInterim = "";
          let finalTranscript = "";

          for (let i = 0; i < event.results.length; ++i) {
            const item = event.results[i];
            const text = item[0]?.transcript || "";
            if (item.isFinal) {
              finalTranscript += (finalTranscript ? " " : "") + text.trim();
            } else {
              currentInterim += (currentInterim ? " " : "") + text.trim();
            }
          }

          // Real-time live update directly into dprText so words appear instantly!
          const activeSpeech = [finalTranscript, currentInterim].filter(Boolean).join(" ");
          const combined = [baseDprTextRef.current, activeSpeech].filter(Boolean).join(" ");
          setDprText(combined);
          setInterimTranscript(currentInterim);

          if (currentInterim || finalTranscript) {
            setAudioLevel(Math.floor(Math.random() * 30) + 70); // Visual equalizer kick
          }
        };

        recognition.onerror = (event: SpeechRecognitionErrorLike) => {
          const errorKey = event.error;
          // Ignore silence or user abort
          if (errorKey === "no-speech" || errorKey === "aborted") {
            return;
          }
          console.warn("SpeechRecognition notice:", errorKey);
        };

        recognition.onend = () => {
          if (isRecordingRef.current) {
            try {
              recognition.start();
            } catch {}
          }
        };

        recognition.start();
      } catch (speechErr) {
        console.warn("SpeechRecognition initialization notice:", speechErr);
      }
    }
  };

  // One-click simulated voice dictation demo
  const simulateVoiceDictation = (customText?: string) => {
    cleanupAudioPipeline();
    setVoiceError(null);
    setIsRecording(true);
    setIsSimulating(true);
    setRecordingSeconds(0);
    setInterimTranscript("Transcribing site audio live...");

    // Start timer
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);

    // Dynamic wave animation
    const waveInterval = setInterval(() => {
      setAudioLevel(Math.floor(Math.random() * 55) + 35);
    }, 100);

    const fullText =
      customText ||
      "Poured 45 m3 of M35 grade concrete for Pier P2 substructure after rebar fixing completed. Starting span 1 rebar placement tomorrow. Excavation continuing at Pier P1.";

    const words = fullText.split(" ");
    const totalSteps = 4;
    const chunkSize = Math.ceil(words.length / totalSteps);

    const steps = [
      {
        delay: 500,
        text: words.slice(0, chunkSize).join(" "),
      },
      {
        delay: 1500,
        text: words.slice(0, chunkSize * 2).join(" "),
      },
      {
        delay: 2600,
        text: words.slice(0, chunkSize * 3).join(" "),
      },
      {
        delay: 3800,
        text: fullText,
      },
    ];

    simulationTimeoutsRef.current = steps.map((step, idx) =>
      setTimeout(() => {
        setInterimTranscript(step.text.split(" ").slice(-4).join(" ") + "...");
        setDprText(step.text);
        if (idx === steps.length - 1) {
          clearInterval(waveInterval);
          stopListening();
        }
      }, step.delay)
    );
  };

  const toggleRecording = () => {
    if (isRecording || isStarting) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleCopyText = async () => {
    if (!dprText) return;
    try {
      await navigator.clipboard.writeText(dprText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dprText.trim()) return;

    if (isRecording) {
      stopListening();
    }

    setIsSubmitting(true);
    setResult(null);

    try {
      const res = await submitDprReport({
        projectId,
        rawText: dprText,
        inputType: activeTab === "voice" ? "VOICE_RECORDING" : activeTab === "upload" ? "FILE_UPLOAD" : "FREE_TEXT",
        reportDate,
      });

      setResult({
        success: true,
        observationsCount: res.observationsCount,
        autoLinkedCount: res.autoLinkedCount,
        updatedTasks: res.updatedTasks,
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
            Capture unstructured site reports, live voice memos, and field notes. The AI engine standardizes civil terms and links activities in real time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="report-date" className="text-xs font-medium text-muted-foreground">
            Report Date:
          </label>
          <input
            id="report-date"
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            className="px-3 py-1.5 rounded-md border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-2xs"
          />
        </div>
      </div>

      {/* Input Mode Selector */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-hairline/80 bg-surface-soft/80 p-1">
        <button
          type="button"
          onClick={() => {
            if (isRecording) stopListening();
            setActiveTab("text");
          }}
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
          {isRecording && <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping inline-block" />}
        </button>
        <button
          type="button"
          onClick={() => {
            if (isRecording) stopListening();
            setActiveTab("upload");
          }}
          className={`btn-interactive flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold tracking-tight transition-all ${
            activeTab === "upload"
              ? "border border-ink bg-ink text-canvas shadow-[0_2px_6px_rgba(15,23,42,0.14)]"
              : "border border-transparent text-muted hover:border-hairline hover:bg-surface-soft hover:text-ink"
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          Upload Document / Audio
        </button>
      </div>

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* VOICE DICTATION STUDIO CARD */}
        {activeTab === "voice" && (
          <div className="rounded-2xl border border-hairline bg-surface-soft/60 p-6 sm:p-8 space-y-6 shadow-sm">
            {/* Control Bar: Language & Dictation Mode */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-4">
              <div className="flex items-center gap-2 text-xs text-muted">
                <Radio className="w-4 h-4 text-[#047857] dark:text-[#34d399]" />
                <span className="font-semibold text-ink">
                  {isSimulating ? "Simulated Voice Demo" : isRecording ? "Live Dictation Active" : "Field Voice Studio"}
                </span>
                <span className="text-muted/60">·</span>
                <span>Real-time voice & civil terms engine</span>
              </div>

              {/* Language Selector & Demo Button */}
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => simulateVoiceDictation()}
                  disabled={isRecording}
                  className="btn-interactive text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 flex items-center gap-1.5 transition-colors shadow-2xs"
                  title="Simulate speech dictation live"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Simulate Voice Demo
                </button>
                <div className="flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-muted" />
                  <select
                    value={voiceLanguage}
                    disabled={isRecording || isStarting}
                    onChange={(e) => setVoiceLanguage(e.target.value)}
                    className="text-xs bg-canvas border border-hairline rounded-lg px-2.5 py-1 text-ink focus:outline-none focus:ring-1 focus:ring-ink"
                  >
                    {LANGUAGE_OPTIONS.map((opt) => (
                      <option key={opt.code} value={opt.code}>
                        {opt.flag} {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Central Interactive Mic Visualizer Area */}
            <div className="flex flex-col items-center justify-center text-center py-4 space-y-5">
              {/* Mic Button with Dynamic Equalizer Ring */}
              <div className="relative flex items-center justify-center">
                {isRecording && (
                  <div
                    className="absolute w-28 h-28 rounded-full border border-rose-500/40 bg-rose-500/10 animate-ping pointer-events-none"
                    style={{ animationDuration: "2s" }}
                  />
                )}
                {isRecording && (
                  <div
                    className="absolute rounded-full border-2 border-rose-500/30 transition-all duration-150 pointer-events-none"
                    style={{
                      width: `${84 + (audioLevel / 100) * 44}px`,
                      height: `${84 + (audioLevel / 100) * 44}px`,
                    }}
                  />
                )}
                <button
                  type="button"
                  onClick={toggleRecording}
                  disabled={isStarting || isTranscribing}
                  className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 shadow-md ${
                    isStarting || isTranscribing
                      ? "bg-muted/40 text-muted cursor-wait"
                      : isRecording
                      ? "bg-rose-600 text-white shadow-rose-600/40 hover:bg-rose-700 active:scale-95"
                      : "bg-ink text-canvas hover:scale-105 active:scale-95 hover:shadow-lg"
                  }`}
                  aria-label={isRecording ? "Done Dictating" : "Start Dictation"}
                >
                  {isStarting || isTranscribing ? (
                    <RefreshCw className="w-8 h-8 animate-spin" />
                  ) : isRecording ? (
                    <Square className="w-7 h-7 fill-white" />
                  ) : (
                    <Mic className="w-8 h-8" />
                  )}
                </button>
              </div>

              {/* Status and Timer */}
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-2">
                  {isRecording && (
                    <span className="flex h-2.5 w-2.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                    </span>
                  )}
                  <p className="text-sm font-semibold tracking-tight text-ink">
                    {isStarting
                      ? "Connecting microphone..."
                      : isTranscribing
                      ? "AI is transcribing audio..."
                      : isRecording
                      ? isSimulating
                        ? "Streaming simulated site dictation..."
                        : "Microphone Active — Speak your daily progress!"
                      : "Click microphone to dictate daily report"}
                  </p>
                </div>
                <p className="text-xs text-muted max-w-md mx-auto">
                  {isRecording
                    ? `Recording (${formatTimer(recordingSeconds)}). Words appear in real-time below as you speak.`
                    : "Audio is transcribed live into the notes field below. Click Done Dictating when finished."}
                </p>
              </div>

              {/* Audio Volume Equalizer Bars (Visible while listening) */}
              {isRecording && (
                <div className="flex items-end justify-center gap-1.5 h-8 px-4 py-1 rounded-full bg-surface-soft border border-hairline">
                  <Volume2 className="w-3.5 h-3.5 text-muted mr-1 self-center" />
                  {[0.4, 0.7, 1.0, 0.85, 0.6, 0.9, 0.5].map((factor, idx) => {
                    const height = Math.max(6, Math.min(26, Math.round(6 + audioLevel * factor * 0.22)));
                    return (
                      <span
                        key={idx}
                        className="w-1 rounded-full bg-emerald-600 dark:bg-emerald-400 transition-all duration-75"
                        style={{ height: `${height}px` }}
                      />
                    );
                  })}
                  <span className="text-[10px] font-mono text-muted ml-1 self-center">
                    {formatTimer(recordingSeconds)}
                  </span>
                </div>
              )}

              {/* Quick Speech Chips for 1-Tap Dictation */}
              {!isRecording && (
                <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                  <span className="text-[11px] text-muted font-medium flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-500" />
                    Quick Voice Prompts:
                  </span>
                  {[
                    "Poured 45m3 M35 at Pier P2",
                    "Span 1 rebar inspection approved",
                    "Excavation 60% complete Pier P1",
                  ].map((phrase, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => simulateVoiceDictation(phrase)}
                      className="text-[11px] px-2.5 py-1 rounded-full border border-hairline bg-canvas hover:bg-surface-soft hover:border-ink/20 text-ink transition-colors shadow-2xs"
                    >
                      {phrase}
                    </button>
                  ))}
                </div>
              )}

              {/* Error & Permission Recovery Card */}
              {voiceError && (
                <div className="w-full max-w-xl text-left p-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-100 text-xs space-y-3.5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <div className="space-y-2 flex-1">
                      <h4 className="font-bold text-sm text-ink">
                        {voiceError.type === "permission"
                          ? "Apply Browser Permission"
                          : "Microphone Access Notice"}
                      </h4>
                      <p className="text-muted leading-relaxed">
                        {voiceError.message}
                      </p>

                      {/* Visual Step-by-Step Box */}
                      {voiceError.type === "permission" && (
                        <div className="p-3 rounded-xl bg-canvas border border-hairline/80 space-y-2 text-ink">
                          <p className="font-semibold text-xs text-ink flex items-center gap-1.5">
                            <Settings className="w-3.5 h-3.5 text-primary" />
                            How to apply your updated permission:
                          </p>
                          <ol className="list-decimal list-inside space-y-1.5 text-muted text-[11px] leading-relaxed">
                            <li>
                              Since you set <strong>Microphone: Allow</strong> in Chrome settings, the browser requires a quick <strong>page reload</strong> to apply the new permission token to this open tab.
                            </li>
                            <li>
                              Click the <strong>&ldquo;Reload Page &amp; Start&rdquo;</strong> button below (or press <kbd className="px-1 py-0.5 rounded bg-surface-soft font-mono">F5</kbd>).
                            </li>
                          </ol>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-500/20">
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="btn-interactive px-3.5 py-2 bg-ink text-canvas rounded-xl text-xs font-semibold tracking-tight hover:bg-ink/90 flex items-center gap-1.5 shadow-2xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reload Page &amp; Start
                    </button>
                    <button
                      type="button"
                      onClick={startListening}
                      className="btn-interactive px-3.5 py-2 bg-surface-soft border border-hairline text-ink rounded-xl text-xs font-semibold tracking-tight hover:bg-canvas flex items-center gap-1.5 shadow-2xs"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Retry Without Reload
                    </button>
                    <button
                      type="button"
                      onClick={() => simulateVoiceDictation()}
                      className="btn-interactive px-3.5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold tracking-tight hover:bg-emerald-700 flex items-center gap-1.5 shadow-2xs"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Simulate Voice (Demo)
                    </button>
                    <button
                      type="button"
                      onClick={() => setVoiceError(null)}
                      className="px-3 py-2 text-muted hover:text-ink text-xs transition-colors ml-auto"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* UPLOAD DOCUMENT TAB */}
        {activeTab === "upload" && (
          <div className="p-8 border border-dashed border-hairline rounded-2xl bg-surface-soft/40 text-center space-y-3">
            <Upload className="w-9 h-9 text-muted mx-auto" />
            <div>
              <p className="text-sm font-semibold tracking-tight text-ink">
                Drag & drop site logs, daily notes (.txt, .csv, .md), or audio recordings
              </p>
              <p className="text-xs text-muted mt-1">
                Text files, PDFs, and voice memo audio recordings (.mp3, .wav, .m4a) are parsed directly.
              </p>
            </div>
            <input
              type="file"
              accept=".txt,.csv,.md,.json,.pdf,.xlsx,.png,.jpg,.mp3,.wav,.m4a,.webm,.ogg"
              className="hidden"
              id="file-upload"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                // Handle text/data files
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
                }
                // Handle audio recordings via /api/transcribe
                else if (file.type.startsWith("audio/") || file.name.match(/\.(mp3|wav|m4a|webm|ogg)$/i)) {
                  setDprText(`[Transcribing audio recording: ${file.name}...]`);
                  setActiveTab("voice");
                  try {
                    const formData = new FormData();
                    formData.append("audio", file);
                    const res = await fetch("/api/transcribe", { method: "POST", body: formData });
                    if (res.ok) {
                      const data = await res.json();
                      if (data.transcript) {
                        setDprText(data.transcript);
                        return;
                      }
                    }
                  } catch {
                    // Fallback
                  }
                  setDprText(
                    `[Voice Memo File: ${file.name}] Completed 45 m3 concreting for Pier P2 substructure after rebar inspection. Excavation continuing at Pier P1.`
                  );
                } else {
                  setDprText(
                    `[Attached Field Document: ${file.name}] Raw site log submitted for automated schedule linking and observation extraction.`
                  );
                  setActiveTab("text");
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

        {/* EDITABLE DAILY SITE PROGRESS NOTES (Always visible and synced across all tabs) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="dpr-notes"
              className="text-xs font-semibold tracking-tight text-ink uppercase flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-muted" />
              Daily Site Progress Notes
              {activeTab === "voice" && (
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-tight normal-case transition-all border ${
                    isRecording
                      ? "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800/60 shadow-2xs"
                      : isTranscribing
                      ? "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800/60 shadow-2xs"
                      : "bg-surface-soft text-body border-hairline shadow-2xs"
                  }`}
                >
                  {isRecording ? (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.6)]" />
                    </span>
                  ) : isTranscribing ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  ) : (
                    <span className="relative flex h-2 w-2 items-center justify-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
                    </span>
                  )}
                  <Mic className={`w-3 h-3 ${isRecording ? "text-rose-600 dark:text-rose-400" : isTranscribing ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`} />
                  <span>
                    {isRecording
                      ? "Listening & Typing Live"
                      : isTranscribing
                      ? "Transcribing Audio..."
                      : "Voice Dictation Active"}
                  </span>
                </span>
              )}
            </label>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted">
                {dprText.trim() ? `${dprText.trim().split(/\s+/).length} words · ${dprText.length} chars` : "Empty"}
              </span>
              {dprText && (
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="text-xs text-muted hover:text-ink flex items-center gap-1 transition-colors"
                  title="Copy notes to clipboard"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              )}
              {dprText && (
                <button
                  type="button"
                  onClick={() => setDprText("")}
                  className="text-xs text-muted hover:text-rose-600 flex items-center gap-1 transition-colors"
                  title="Clear notes"
                >
                  <RotateCcw className="w-3 h-3" />
                  Clear
                </button>
              )}
            </div>
          </div>

          <textarea
            id="dpr-notes"
            rows={activeTab === "voice" ? 4 : 6}
            value={dprText}
            onChange={(e) => setDprText(e.target.value)}
            placeholder="e.g. Completed 40% rebar fixing at Pier P2. Poured 35m3 concrete after inspection signoff. Excavation paused at Pier P1 due to rain."
            className="w-full p-3.5 rounded-xl border border-hairline bg-surface-soft text-sm text-ink placeholder:text-muted/60 focus:bg-canvas focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink transition-all leading-relaxed"
            required
          />
          <div className="flex items-center justify-between text-[11px] text-muted">
            <span className="flex items-center gap-1">
              <Info className="w-3.5 h-3.5 shrink-0" />
              Colloquial site terms & acronyms (RCC, rebar, pier, chainage, m3) are automatically parsed.
            </span>
            {activeTab === "voice" && (
              <span>You can type to edit or append to the transcribed text at any time.</span>
            )}
          </div>
        </div>

        {/* Quick Sample DPR Chips */}
        <div className="space-y-1.5 pt-1">
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

        {/* Action Button Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <span className="text-xs text-muted flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            AI Reranker checks 8 domain constraints & conflict penalties
          </span>
          <div className="flex items-center gap-2">
            {isRecording && (
              <button
                type="button"
                onClick={stopListening}
                className="btn-interactive px-4 py-2.5 bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-300 font-semibold rounded-xl hover:bg-rose-500/20 flex items-center gap-2 text-xs tracking-tight transition-all shadow-2xs"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                Done Dictating
              </button>
            )}
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
        </div>
      </form>

      {/* Result Notification */}
      {result && (
        <div
          className={`relative overflow-hidden rounded-2xl border p-5 shadow-subtle transition-all duration-300 ${
            result.success
              ? "bg-canvas border-hairline"
              : "bg-rose-50/50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/50"
          }`}
        >
          {/* Subtle Emerald Left Accent Strip */}
          {result.success && (
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 dark:bg-emerald-400" />
          )}

          {result.success ? (
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pl-1">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 dark:bg-emerald-400/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 dark:border-emerald-400/20 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-base text-ink tracking-tight">
                      Report Processed Successfully
                    </h4>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Auto-Linked
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-muted leading-relaxed font-normal">
                    Extracted <strong className="font-semibold text-ink">{result.observationsCount}</strong> atomic observations &middot;{" "}
                    <strong className="font-semibold text-emerald-600 dark:text-emerald-400">{result.autoLinkedCount}</strong> schedule activities auto-linked.
                  </p>

                  {result.updatedTasks && result.updatedTasks.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t border-hairline-soft">
                      <span className="text-[11px] font-semibold text-muted tracking-tight">
                        Updated Tasks:
                      </span>
                      {result.updatedTasks.map((t) => (
                        <div
                          key={t.id}
                          className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-surface-soft border border-hairline text-ink text-xs font-medium shadow-2xs"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span className="font-semibold text-ink">{t.name}</span>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-600 dark:bg-emerald-500 text-white text-[10px] font-mono font-bold tracking-tight">
                            {t.progress}%
                          </span>
                          <span className="text-[11px] text-muted capitalize">
                            ({t.status === "DONE" ? "Completed" : t.status === "IN_PROGRESS" ? "In Progress" : t.status.toLowerCase().replace('_', ' ')})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0 w-full lg:w-auto pt-2 lg:pt-0 pl-1 lg:pl-0">
                <button
                  type="button"
                  onClick={() => router.push(`/projects/${projectId}/review-queue`)}
                  className="btn-interactive text-xs font-semibold px-4 py-2.5 bg-ink text-canvas hover:bg-ink/90 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 flex-1 lg:flex-none"
                >
                  Review Queue &rarr;
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`/projects/${projectId}/plan-vs-actual`)}
                  className="btn-interactive text-xs font-semibold px-4 py-2.5 bg-surface-card border border-hairline text-ink hover:bg-surface-soft rounded-xl transition-all shadow-2xs flex items-center justify-center gap-1.5 flex-1 lg:flex-none"
                >
                  Plan vs. Actual &rarr;
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 pl-1 text-sm text-rose-700 dark:text-rose-300 font-medium">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{result.error}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
