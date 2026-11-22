import { useState } from "react";
import { Image as ImageIcon, Plus, Search, Trash2, X } from "lucide-react";
import type { HistoryEntry } from "../types/nix";
import { formatShortTime } from "../utils/imageHelpers";

interface HistorySidebarProps {
  entries: HistoryEntry[];
  activeEntryId: string | null;
  onSelectEntry: (entry: HistoryEntry) => void;
  onDeleteEntry: (id: string) => void;
  onClearAll: () => void;
  onNewUpload: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const MODE_LABELS: Record<HistoryEntry["mode"], string> = {
  overview: "Overview",
  ocr: "Text & OCR",
  design: "Design",
  objects: "Objects",
};

export function HistorySidebar({
  entries,
  activeEntryId,
  onSelectEntry,
  onDeleteEntry,
  onClearAll,
  onNewUpload,
  mobileOpen,
  onCloseMobile,
}: HistorySidebarProps) {
  const [query, setQuery] = useState("");

  const filtered = entries.filter((entry) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      entry.analysis.title.toLowerCase().includes(q) ||
      entry.image.metadata.name.toLowerCase().includes(q) ||
      entry.analysis.summary.toLowerCase().includes(q)
    );
  });

  const content = (
    <div className="flex h-full flex-col bg-white border-r border-neutral-200">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-neutral-200">
        <span className="text-xs font-semibold tracking-wide text-neutral-500">
          Session History
        </span>
        <div className="flex items-center gap-2">
          {entries.length > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close history drawer"
            className="lg:hidden p-1.5 text-neutral-500 hover:text-neutral-900 rounded-md cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-3 border-b border-neutral-200 space-y-2.5">
        <button
          type="button"
          onClick={() => {
            onNewUpload();
            onCloseMobile();
          }}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-neutral-900 bg-neutral-100 hover:bg-neutral-200/80 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>New Image</span>
        </button>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter analyses..."
            aria-label="Filter session analyses"
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-md text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-[#2563EB]"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-neutral-100">
        {filtered.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <ImageIcon className="w-5 h-5 text-neutral-300 mx-auto mb-2" />
            <p className="text-xs font-medium text-neutral-600">
              {entries.length === 0 ? "No analyses yet" : "No matching entries"}
            </p>
            <p className="text-xs text-neutral-400 mt-1">
              {entries.length === 0
                ? "Upload an image or pick a sample to start."
                : "Try another search term."}
            </p>
          </div>
        ) : (
          filtered.map((entry) => {
            const isActive = entry.id === activeEntryId;
            return (
              <div
                key={entry.id}
                className={`group relative flex items-start gap-3 px-3.5 py-3 transition-colors ${
                  isActive ? "bg-[#2563EB]/[0.06]" : "hover:bg-neutral-50"
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelectEntry(entry);
                    onCloseMobile();
                  }}
                  className="flex flex-1 min-w-0 items-start gap-3 text-left cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-md overflow-hidden bg-neutral-100 border border-neutral-200 shrink-0">
                    <img
                      src={entry.image.dataUrl}
                      alt={entry.analysis.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-xs font-semibold truncate ${
                        isActive ? "text-[#1D4ED8]" : "text-neutral-900"
                      }`}
                    >
                      {entry.analysis.title}
                    </p>
                    <p className="text-[11px] text-neutral-500 truncate mt-0.5">
                      {MODE_LABELS[entry.mode]} ·{" "}
                      <span className="font-mono tabular-nums">
                        {formatShortTime(entry.createdAt)}
                      </span>
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteEntry(entry.id)}
                  aria-label={`Remove ${entry.analysis.title}`}
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 text-neutral-400 hover:text-red-600 rounded transition-opacity cursor-pointer shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-[264px] shrink-0 h-full">{content}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-neutral-950/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-[280px] max-w-[85vw] h-full shadow-xl">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
