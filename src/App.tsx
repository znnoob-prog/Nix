import { useCallback, useEffect, useRef, useState } from "react";
import { Menu } from "lucide-react";
import { AnalysisPanel } from "./components/AnalysisPanel";
import { HistorySidebar } from "./components/HistorySidebar";
import { ImageViewport } from "./components/ImageViewport";
import type {
  ActiveImage,
  AnalysisMode,
  ChatMessage,
  HistoryEntry,
  NixAnalysis,
  SampleImage,
  ThinkingDuration,
} from "./types/nix";
import { fileToActiveImage, urlToActiveImage } from "./utils/imageHelpers";

const STORAGE_KEY = "nix_session_history_v1";
const MAX_HISTORY_ITEMS = 8;

function loadStoredHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredHistory(entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(entries.slice(0, MAX_HISTORY_ITEMS))
    );
  } catch {
    // Ignore storage quota errors for large image payloads.
  }
}

export default function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [history, setHistory] = useState<HistoryEntry[]>(() => loadStoredHistory());
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState<ActiveImage | null>(null);
  const [mode, setMode] = useState<AnalysisMode>("overview");
  const [highThinking, setHighThinking] = useState(false);
  const [thinkingDuration, setThinkingDuration] = useState<ThinkingDuration>("medium");
  const [lastAnalyzedThinkingKey, setLastAnalyzedThinkingKey] = useState<string | null>(null);
  const [customFocus, setCustomFocus] = useState("");
  const [analysis, setAnalysis] = useState<NixAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatStreaming, setIsChatStreaming] = useState(false);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);

  useEffect(() => {
    saveStoredHistory(history);
  }, [history]);

  const currentThinkingKey = highThinking ? "xhigh" : thinkingDuration;

  const runAnalysisForImage = useCallback(
    async (
      targetImage: ActiveImage,
      targetMode: AnalysisMode,
      focusText: string,
      useHighThinking: boolean,
      duration: ThinkingDuration
    ) => {
      setIsAnalyzing(true);
      setError(null);
      setChatMessages([]);

      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: targetImage.base64,
            mimeType: targetImage.metadata.mimeType,
            mode: targetMode,
            customFocus: focusText,
            highThinking: useHighThinking,
            thinkingDuration: duration,
          }),
        });

        const payload = await res.json();
        if (!res.ok) {
          throw new Error(payload?.error || `Request failed (${res.status}).`);
        }

        const nextAnalysis = payload.analysis as NixAnalysis;
        setAnalysis(nextAnalysis);
        setLastAnalyzedThinkingKey(useHighThinking ? "xhigh" : duration);

        const newEntryId = `entry-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const newEntry: HistoryEntry = {
          id: newEntryId,
          createdAt: Date.now(),
          mode: targetMode,
          highThinking: useHighThinking,
          thinkingDuration: duration,
          image: targetImage,
          analysis: nextAnalysis,
          chatHistory: [],
        };

        setActiveEntryId(newEntryId);
        setHistory((prev) => [newEntry, ...prev].slice(0, MAX_HISTORY_ITEMS));
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "Unable to analyze image right now.";
        setError(msg);
      } finally {
        setIsAnalyzing(false);
      }
    },
    []
  );

  const handleSelectFile = useCallback(
    async (file: File) => {
      try {
        setError(null);
        const loaded = await fileToActiveImage(file);
        setActiveImage(loaded);
        setAnalysis(null);
        setActiveEntryId(null);
        setChatMessages([]);
        await runAnalysisForImage(loaded, mode, customFocus, highThinking, thinkingDuration);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to open image.");
      }
    },
    [customFocus, highThinking, mode, runAnalysisForImage, thinkingDuration]
  );

  const handleSelectSample = useCallback(
    async (sample: SampleImage) => {
      try {
        setError(null);
        const loaded = await urlToActiveImage(sample.src, sample.title);
        const nextMode = sample.recommendedMode;
        setMode(nextMode);
        setCustomFocus("");
        setActiveImage(loaded);
        setAnalysis(null);
        setActiveEntryId(null);
        setChatMessages([]);
        await runAnalysisForImage(loaded, nextMode, "", highThinking, thinkingDuration);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load sample.");
      }
    },
    [highThinking, runAnalysisForImage, thinkingDuration]
  );

  const handleSelectHistoryEntry = useCallback((entry: HistoryEntry) => {
    const entryHighThinking = Boolean(entry.highThinking);
    const entryDuration: ThinkingDuration = entry.thinkingDuration ?? "medium";
    setActiveEntryId(entry.id);
    setActiveImage(entry.image);
    setMode(entry.mode);
    setHighThinking(entryHighThinking);
    setThinkingDuration(entryDuration);
    setLastAnalyzedThinkingKey(entryHighThinking ? "xhigh" : entryDuration);
    setAnalysis(entry.analysis);
    setChatMessages(entry.chatHistory || []);
    setError(null);
  }, []);

  const handleDeleteHistoryEntry = useCallback(
    (id: string) => {
      setHistory((prev) => prev.filter((item) => item.id !== id));
      if (activeEntryId === id) {
        setActiveEntryId(null);
      }
    },
    [activeEntryId]
  );

  const handleClearWorkspace = useCallback(() => {
    setActiveEntryId(null);
    setActiveImage(null);
    setAnalysis(null);
    setLastAnalyzedThinkingKey(null);
    setChatMessages([]);
    setCustomFocus("");
    setError(null);
  }, []);

  const handleSendQuestion = useCallback(
    async (question: string) => {
      if (!activeImage || isChatStreaming) return;

      const userMsg: ChatMessage = {
        id: `msg-u-${Date.now()}`,
        role: "user",
        content: question,
      };
      const assistantMsgId = `msg-a-${Date.now() + 1}`;
      const assistantPlaceholder: ChatMessage = {
        id: assistantMsgId,
        role: "assistant",
        content: "",
      };

      const priorHistory = chatMessages.filter((m) => !m.error);
      setChatMessages((prev) => [...prev, userMsg, assistantPlaceholder]);
      setIsChatStreaming(true);

      let accumulated = "";
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: activeImage.base64,
            mimeType: activeImage.metadata.mimeType,
            question,
            history: priorHistory.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            analysisContext: analysis
              ? `${analysis.title}: ${analysis.summary}`
              : undefined,
            highThinking,
            thinkingDuration,
          }),
        });

        if (!res.ok) {
          const errPayload = await res.json().catch(() => ({}));
          throw new Error(
            errPayload?.error || `Chat request failed (${res.status}).`
          );
        }

        const reader = res.body?.getReader();
        if (!reader) {
          throw new Error("Streaming response unavailable.");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() ?? "";

          for (const block of lines) {
            const dataLine = block
              .split("\n")
              .find((l) => l.startsWith("data: "));
            if (!dataLine) continue;
            const json = JSON.parse(dataLine.slice(6));
            if (json.error) {
              throw new Error(json.error);
            }
            if (json.chunk) {
              accumulated += json.chunk;
              setChatMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId ? { ...m, content: accumulated } : m
                )
              );
            }
          }
        }

        if (activeEntryId) {
          const finalMessages: ChatMessage[] = [
            ...priorHistory,
            userMsg,
            { id: assistantMsgId, role: "assistant", content: accumulated },
          ];
          setHistory((prev) =>
            prev.map((entry) =>
              entry.id === activeEntryId
                ? { ...entry, chatHistory: finalMessages }
                : entry
            )
          );
        }
      } catch (err) {
        const errMsg =
          err instanceof Error ? err.message : "Failed to get answer from Nix.";
        setChatMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: errMsg, error: true }
              : m
          )
        );
      } finally {
        setIsChatStreaming(false);
      }
    },
    [activeEntryId, activeImage, analysis, chatMessages, highThinking, isChatStreaming, thinkingDuration]
  );

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            handleSelectFile(file);
            break;
          }
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [handleSelectFile]);

  const openFilePicker = () => fileInputRef.current?.click();

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFB] text-neutral-900">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleSelectFile(file);
          }
          e.target.value = "";
        }}
      />

      <header className="sticky top-0 z-30 bg-white border-b border-neutral-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-8">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            handleClearWorkspace();
          }}
          className="text-lg font-display font-bold tracking-tight text-neutral-900 whitespace-nowrap shrink-0"
        >
          Nix
        </a>

        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-neutral-600"
        >
          <button
            type="button"
            onClick={handleClearWorkspace}
            className="hover:text-neutral-900 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            New Workspace
          </button>
          <a
            href="#samples-strip"
            className="hover:text-neutral-900 transition-colors whitespace-nowrap shrink-0"
          >
            Sample Scenes
          </a>
          <button
            type="button"
            onClick={() => {
              setMode("ocr");
              if (activeImage) runAnalysisForImage(activeImage, "ocr", customFocus, highThinking, thinkingDuration);
            }}
            className="hover:text-neutral-900 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Text & OCR
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("design");
              if (activeImage) runAnalysisForImage(activeImage, "design", customFocus, highThinking, thinkingDuration);
            }}
            className="hover:text-neutral-900 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Design & Craft
          </button>
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setMobileHistoryOpen(true)}
            aria-label="Open session history"
            className="lg:hidden p-2 text-neutral-600 hover:text-neutral-900 rounded-lg border border-neutral-200 cursor-pointer"
          >
            <Menu className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={openFilePicker}
            className="px-4 py-2 text-xs sm:text-sm font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Upload Image
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <HistorySidebar
          entries={history}
          activeEntryId={activeEntryId}
          onSelectEntry={handleSelectHistoryEntry}
          onDeleteEntry={handleDeleteHistoryEntry}
          onClearAll={() => {
            setHistory([]);
            setActiveEntryId(null);
          }}
          onNewUpload={openFilePicker}
          mobileOpen={mobileHistoryOpen}
          onCloseMobile={() => setMobileHistoryOpen(false)}
        />

        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">
          <div className="max-w-[1280px] mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
              <div>
                <h1 className="text-2xl sm:text-3xl font-display font-semibold text-neutral-900 tracking-tight text-balance">
                  Clear Visual Intelligence
                </h1>
                <p className="text-sm text-neutral-500 mt-1">
                  Inspect subjects, extract verbatim text, map color palettes, and ask Nix follow-up questions about any image.
                </p>
              </div>
              <p className="text-xs text-neutral-500 whitespace-nowrap shrink-0">
                Model · gemini-4-hydrogen
              </p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] gap-6 items-start">
              <ImageViewport
                activeImage={activeImage}
                isAnalyzing={isAnalyzing}
                onSelectFile={handleSelectFile}
                onSelectSample={handleSelectSample}
                onOpenFilePicker={openFilePicker}
              />

              <AnalysisPanel
                activeImage={activeImage}
                mode={mode}
                onModeChange={setMode}
                highThinking={highThinking}
                onHighThinkingChange={setHighThinking}
                thinkingDuration={thinkingDuration}
                onThinkingDurationChange={(nextDuration) => {
                  setThinkingDuration(nextDuration);
                  setHighThinking(false);
                }}
                currentThinkingKey={currentThinkingKey}
                lastAnalyzedThinkingKey={lastAnalyzedThinkingKey}
                customFocus={customFocus}
                onCustomFocusChange={setCustomFocus}
                analysis={analysis}
                isAnalyzing={isAnalyzing}
                error={error}
                onRunAnalysis={(overrideMode) => {
                  if (activeImage) {
                    runAnalysisForImage(
                      activeImage,
                      overrideMode ?? mode,
                      customFocus,
                      highThinking,
                      thinkingDuration
                    );
                  }
                }}
                chatMessages={chatMessages}
                isChatStreaming={isChatStreaming}
                onSendQuestion={handleSendQuestion}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
