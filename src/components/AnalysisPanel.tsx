import { useState, type FormEvent } from "react";
import {
  AlertCircle,
  ArrowUp,
  Check,
  Copy,
  Download,
  Eye,
  FileText,
  Layers,
  Palette,
  ScanText,
} from "lucide-react";
import type {
  ActiveImage,
  AnalysisMode,
  ChatMessage,
  NixAnalysis,
} from "../types/nix";
import { buildMarkdownReport } from "../utils/imageHelpers";

interface AnalysisPanelProps {
  activeImage: ActiveImage | null;
  mode: AnalysisMode;
  onModeChange: (mode: AnalysisMode) => void;
  customFocus: string;
  onCustomFocusChange: (focus: string) => void;
  analysis: NixAnalysis | null;
  isAnalyzing: boolean;
  error: string | null;
  onRunAnalysis: (overrideMode?: AnalysisMode) => void;
  chatMessages: ChatMessage[];
  isChatStreaming: boolean;
  onSendQuestion: (question: string) => void;
}

const MODES: Array<{ id: AnalysisMode; label: string; icon: typeof Eye }> = [
  { id: "overview", label: "Clear Overview", icon: Eye },
  { id: "ocr", label: "Text & OCR", icon: ScanText },
  { id: "design", label: "Design & Craft", icon: Palette },
  { id: "objects", label: "Object Scan", icon: Layers },
];

export function AnalysisPanel({
  activeImage,
  mode,
  onModeChange,
  customFocus,
  onCustomFocusChange,
  analysis,
  isAnalyzing,
  error,
  onRunAnalysis,
  chatMessages,
  isChatStreaming,
  onSendQuestion,
}: AnalysisPanelProps) {
  const [questionInput, setQuestionInput] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((curr) => (curr === id ? null : curr)), 1800);
    } catch {
      // Clipboard blocked in restricted context; ignore silently.
    }
  };

  const handleDownloadJson = () => {
    if (!analysis || !activeImage) return;
    const payload = JSON.stringify(
      {
        image: activeImage.metadata,
        mode,
        analysis,
      },
      null,
      2
    );
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${activeImage.metadata.name.replace(/\.[^.]+$/, "")}-nix.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const handleChatSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = questionInput.trim();
    if (!trimmed || isChatStreaming || !activeImage) return;
    setQuestionInput("");
    onSendQuestion(trimmed);
  };

  return (
    <section
      aria-label="Nix visual analysis output"
      className="flex flex-col bg-white border border-neutral-200 rounded-xl overflow-hidden"
    >
      <div className="p-4 sm:p-5 border-b border-neutral-200 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">
              Nix Inspection
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Select a lens and run a focused analysis on the active image.
            </p>
          </div>
          {analysis && activeImage && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() =>
                  handleCopy(
                    buildMarkdownReport(analysis, activeImage.metadata.name, mode),
                    "report"
                  )
                }
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200/80 rounded-md transition-colors cursor-pointer whitespace-nowrap"
              >
                {copiedId === "report" ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedId === "report" ? "Copied" : "Copy Report"}</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadJson}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200/80 rounded-md transition-colors cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>JSON</span>
              </button>
            </div>
          )}
        </div>

        <div
          role="tablist"
          aria-label="Analysis mode"
          className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-neutral-100 rounded-lg"
        >
          {MODES.map((m) => {
            const Icon = m.icon;
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={active}
                disabled={isAnalyzing}
                onClick={() => {
                  onModeChange(m.id);
                  if (activeImage) {
                    onRunAnalysis(m.id);
                  }
                }}
                className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? "bg-white text-neutral-900 shadow-xs"
                    : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{m.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={customFocus}
            onChange={(e) => onCustomFocusChange(e.target.value)}
            placeholder="Optional focus (e.g. read the watch dial, describe light direction)..."
            aria-label="Optional analysis focus"
            className="flex-1 px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-[#2563EB]"
          />
          <button
            type="button"
            disabled={!activeImage || isAnalyzing}
            onClick={() => onRunAnalysis()}
            className="px-4 py-2 text-sm font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-neutral-300 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            {isAnalyzing ? "Analyzing..." : "Analyze Image"}
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-6 flex-1 space-y-6">
        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 p-3.5 rounded-lg border border-red-200 bg-red-50 text-red-900"
          >
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              <p className="font-semibold">Analysis could not be completed</p>
              <p className="text-red-700 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {!activeImage && !isAnalyzing && (
          <div className="py-12 text-center">
            <FileText className="w-6 h-6 text-neutral-300 mx-auto mb-2.5" />
            <p className="text-sm font-medium text-neutral-700">
              Ready to inspect an image
            </p>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto mt-1 leading-relaxed">
              Upload any photo or pick one of the three sample scenes on the left. Nix will provide a clear breakdown, extract visible text, map colors, and answer follow-up questions.
            </p>
          </div>
        )}

        {isAnalyzing && (
          <div className="space-y-5" aria-busy="true" aria-label="Analyzing image">
            <div className="space-y-2">
              <div className="h-5 w-48 bg-neutral-100 rounded" />
              <div className="h-4 w-full bg-neutral-100 rounded" />
              <div className="h-4 w-5/6 bg-neutral-100 rounded" />
            </div>
            <div className="h-px bg-neutral-100" />
            <div className="space-y-2">
              <div className="h-4 w-full bg-neutral-100 rounded" />
              <div className="h-4 w-full bg-neutral-100 rounded" />
              <div className="h-4 w-3/4 bg-neutral-100 rounded" />
            </div>
            <div className="h-px bg-neutral-100" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="h-14 bg-neutral-100 rounded-lg" />
              <div className="h-14 bg-neutral-100 rounded-lg" />
              <div className="h-14 bg-neutral-100 rounded-lg" />
              <div className="h-14 bg-neutral-100 rounded-lg" />
            </div>
          </div>
        )}

        {!isAnalyzing && analysis && (
          <div className="space-y-7">
            <div>
              <h3 className="text-xl font-semibold text-neutral-900 tracking-tight text-balance">
                {analysis.title}
              </h3>
              <p className="text-[15px] text-neutral-700 leading-relaxed mt-2">
                {analysis.summary}
              </p>
            </div>

            <div className="h-px bg-neutral-200" />

            <div className="space-y-2.5">
              <h4 className="text-xs font-semibold text-neutral-500">
                Detailed Breakdown
              </h4>
              <div className="space-y-3 text-sm text-neutral-700 leading-[1.65]">
                {analysis.detailedAnalysis
                  .split(/\n{2,}/)
                  .map((p) => p.trim())
                  .filter(Boolean)
                  .map((paragraph, idx) => (
                    <p key={idx}>{paragraph}</p>
                  ))}
              </div>
            </div>

            {analysis.observations.length > 0 && (
              <>
                <div className="h-px bg-neutral-200" />
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-neutral-500">
                    Key Observations
                  </h4>
                  <dl className="divide-y divide-neutral-100 border-t border-b border-neutral-100">
                    {analysis.observations.map((obs, idx) => (
                      <div
                        key={idx}
                        className="py-2.5 grid grid-cols-1 sm:grid-cols-[150px_1fr] gap-1 sm:gap-4"
                      >
                        <dt className="text-xs font-semibold text-neutral-900">
                          {obs.label}
                        </dt>
                        <dd className="text-xs text-neutral-600 leading-relaxed">
                          {obs.detail}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </>
            )}

            {analysis.extractedText.length > 0 && (
              <>
                <div className="h-px bg-neutral-200" />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-neutral-500">
                      Extracted Text
                    </h4>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(
                          analysis.extractedText
                            .map((t) => `${t.region}: ${t.text}`)
                            .join("\n"),
                          "all-ocr"
                        )
                      }
                      className="text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] cursor-pointer whitespace-nowrap"
                    >
                      {copiedId === "all-ocr" ? "Copied all" : "Copy all text"}
                    </button>
                  </div>
                  <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-lg bg-neutral-50/60">
                    {analysis.extractedText.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-start justify-between gap-3 px-3.5 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium text-neutral-500">
                            {item.region}
                          </p>
                          <p className="text-xs font-mono text-neutral-900 mt-0.5 break-words">
                            {item.text}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(item.text, `ocr-${idx}`)}
                          aria-label={`Copy text from ${item.region}`}
                          className="p-1.5 text-neutral-400 hover:text-neutral-900 rounded cursor-pointer shrink-0"
                        >
                          {copiedId === `ocr-${idx}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {analysis.palette.length > 0 && (
              <>
                <div className="h-px bg-neutral-200" />
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-neutral-500">
                    Observed Color Palette
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {analysis.palette.map((swatch, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleCopy(swatch.hex, `hex-${idx}`)}
                        className="flex items-center gap-3 p-2 rounded-lg border border-neutral-200 hover:border-neutral-300 bg-white text-left transition-colors cursor-pointer"
                      >
                        <span
                          className="w-8 h-8 rounded-md border border-black/10 shrink-0"
                          style={{ backgroundColor: swatch.hex }}
                          aria-hidden="true"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-neutral-900 truncate">
                              {swatch.name}
                            </span>
                            <span className="text-[11px] font-mono tabular-nums text-neutral-500 shrink-0">
                              {copiedId === `hex-${idx}` ? "Copied" : swatch.hex}
                            </span>
                          </div>
                          <p className="text-[11px] text-neutral-500 truncate">
                            {swatch.role}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="h-px bg-neutral-200" />

            <div className="space-y-3.5">
              <div>
                <h4 className="text-xs font-semibold text-neutral-500">
                  Ask Nix About This Image
                </h4>
              </div>

              {analysis.suggestedQuestions.length > 0 && chatMessages.length === 0 && (
                <div className="flex flex-wrap gap-2">
                  {analysis.suggestedQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      disabled={isChatStreaming}
                      onClick={() => onSendQuestion(q)}
                      className="px-3 py-1.5 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200/80 rounded-lg transition-colors text-left cursor-pointer"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {chatMessages.length > 0 && (
                <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                  {chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`text-sm leading-relaxed rounded-lg px-3.5 py-2.5 ${
                        msg.role === "user"
                          ? "bg-neutral-100 text-neutral-900 ml-8"
                          : msg.error
                          ? "bg-red-50 border border-red-200 text-red-800 mr-4"
                          : "bg-[#2563EB]/[0.05] border border-[#2563EB]/15 text-neutral-800 mr-4"
                      }`}
                    >
                      <p className="text-[11px] font-semibold text-neutral-500 mb-1">
                        {msg.role === "user" ? "You" : "Nix"}
                      </p>
                      <p className="whitespace-pre-wrap text-[13px]">
                        {msg.content || (isChatStreaming ? "Thinking..." : "")}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleChatSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={questionInput}
                  onChange={(e) => setQuestionInput(e.target.value)}
                  disabled={isChatStreaming || !activeImage}
                  placeholder="Ask a follow-up question about any detail..."
                  aria-label="Follow-up question for Nix"
                  className="flex-1 px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-[#2563EB]"
                />
                <button
                  type="submit"
                  disabled={!questionInput.trim() || isChatStreaming || !activeImage}
                  aria-label="Send question to Nix"
                  className="inline-flex items-center justify-center w-10 h-10 text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-neutral-300 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
