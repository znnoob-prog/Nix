import { useState, type DragEvent } from "react";
import {
  ImagePlus,
  Maximize2,
  Minimize2,
  RefreshCw,
  Upload,
} from "lucide-react";
import { SAMPLE_IMAGES } from "../data/samples";
import type { ActiveImage, SampleImage } from "../types/nix";
import { formatAspectRatio, formatBytes } from "../utils/imageHelpers";

interface ImageViewportProps {
  activeImage: ActiveImage | null;
  isAnalyzing: boolean;
  onSelectFile: (file: File) => void;
  onSelectSample: (sample: SampleImage) => void;
  onOpenFilePicker: () => void;
}

export function ImageViewport({
  activeImage,
  isAnalyzing,
  onSelectFile,
  onSelectSample,
  onOpenFilePicker,
}: ImageViewportProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [zoomActual, setZoomActual] = useState(false);
  const [failedSampleIds, setFailedSampleIds] = useState<Record<string, boolean>>({});
  const [mainImageError, setMainImageError] = useState(false);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setMainImageError(false);
      onSelectFile(file);
    }
  };

  return (
    <section
      aria-label="Image inspection viewport"
      className="flex flex-col gap-4"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        className={`relative rounded-xl border transition-colors overflow-hidden ${
          isDragging
            ? "border-[#2563EB] bg-[#2563EB]/[0.04]"
            : activeImage
            ? "border-neutral-200 bg-[#141619]"
            : "border-dashed border-neutral-300 bg-white"
        }`}
      >
        {!activeImage ? (
          <div className="flex flex-col items-center justify-center text-center px-6 py-16 sm:py-24">
            <div className="w-12 h-12 rounded-xl bg-neutral-100 border border-neutral-200 flex items-center justify-center mb-4">
              <ImagePlus className="w-5 h-5 text-neutral-700" />
            </div>
            <h2 className="text-lg font-semibold text-neutral-900 text-balance">
              Drop an image for Nix to inspect
            </h2>
            <p className="text-sm text-neutral-500 max-w-md mt-1.5 leading-relaxed">
              Upload a photograph, screenshot, document, or design asset. Supports PNG, JPEG, WEBP, and GIF up to 20 MB, or paste directly from your clipboard.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={onOpenFilePicker}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Upload className="w-4 h-4" />
                <span>Choose Image</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#1B1E23] border-b border-white/10 text-xs text-neutral-300">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-medium text-white truncate max-w-[220px] sm:max-w-[300px]">
                  {activeImage.metadata.name}
                </span>
                <span aria-hidden="true" className="text-neutral-500">
                  ·
                </span>
                <span className="font-mono tabular-nums text-neutral-400 whitespace-nowrap">
                  {activeImage.metadata.width} × {activeImage.metadata.height}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setZoomActual((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-neutral-200 hover:text-white bg-white/10 hover:bg-white/15 rounded-md transition-colors cursor-pointer whitespace-nowrap"
                >
                  {zoomActual ? (
                    <>
                      <Minimize2 className="w-3.5 h-3.5" />
                      <span>Fit</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>Actual</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={onOpenFilePicker}
                  disabled={isAnalyzing}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-neutral-200 hover:text-white bg-white/10 hover:bg-white/15 disabled:opacity-50 rounded-md transition-colors cursor-pointer whitespace-nowrap"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Replace</span>
                </button>
              </div>
            </div>

            <div
              className={`relative flex items-center justify-center p-4 sm:p-6 min-h-[320px] max-h-[540px] ${
                zoomActual ? "overflow-auto" : "overflow-hidden"
              }`}
            >
              {mainImageError ? (
                <div className="flex flex-col items-center justify-center text-neutral-400 py-12">
                  <ImagePlus className="w-8 h-8 mb-2 opacity-60" />
                  <p className="text-sm font-medium text-neutral-200">
                    {activeImage.metadata.name}
                  </p>
                  <p className="text-xs text-neutral-400 mt-1">
                    Preview unavailable for this file
                  </p>
                </div>
              ) : (
                <img
                  src={activeImage.dataUrl}
                  alt={activeImage.metadata.name}
                  referrerPolicy="no-referrer"
                  onError={() => setMainImageError(true)}
                  className={
                    zoomActual
                      ? "max-w-none rounded-sm shadow-lg"
                      : "max-h-[480px] w-auto max-w-full object-contain rounded-sm shadow-lg"
                  }
                />
              )}

              {isDragging && (
                <div className="absolute inset-0 bg-[#2563EB]/20 backdrop-blur-[2px] flex items-center justify-center">
                  <div className="px-4 py-2.5 rounded-lg bg-neutral-900/90 text-white text-sm font-medium">
                    Drop to replace active image
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-[#1B1E23] border-t border-white/10 text-xs text-neutral-400">
              <div className="flex items-center gap-2 font-mono tabular-nums">
                <span>
                  {formatAspectRatio(
                    activeImage.metadata.width,
                    activeImage.metadata.height
                  )}{" "}
                  ratio
                </span>
                <span aria-hidden="true">·</span>
                <span>{formatBytes(activeImage.metadata.sizeBytes)}</span>
                <span aria-hidden="true">·</span>
                <span>
                  {activeImage.metadata.mimeType.replace("image/", "").toUpperCase()}
                </span>
              </div>
              <span className="text-neutral-400">
                Paste with Ctrl/Cmd + V anytime
              </span>
            </div>
          </div>
        )}
      </div>

      <div id="samples-strip" className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-neutral-600">
            Sample Images
          </h3>
          <span className="text-xs text-neutral-400">
            Click any scene to analyze with Nix
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {SAMPLE_IMAGES.map((sample) => {
            const isFailed = Boolean(failedSampleIds[sample.id]);
            const isSelected = activeImage?.metadata.name === sample.title;
            return (
              <button
                key={sample.id}
                type="button"
                disabled={isAnalyzing}
                onClick={() => {
                  setMainImageError(false);
                  onSelectSample(sample);
                }}
                className={`group text-left rounded-lg border overflow-hidden transition-colors cursor-pointer disabled:opacity-60 ${
                  isSelected
                    ? "border-[#2563EB] bg-[#2563EB]/[0.04]"
                    : "border-neutral-200 bg-white hover:border-neutral-300"
                }`}
              >
                <div className="aspect-[4/3] w-full bg-neutral-100 overflow-hidden relative">
                  {isFailed ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-neutral-100 to-neutral-200 text-neutral-500 p-3 text-center">
                      <ImagePlus className="w-5 h-5 mb-1.5" />
                      <span className="text-xs font-medium">{sample.title}</span>
                    </div>
                  ) : (
                    <img
                      src={sample.src}
                      alt={sample.title}
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setFailedSampleIds((prev) => ({
                          ...prev,
                          [sample.id]: true,
                        }))
                      }
                      className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                    />
                  )}
                </div>
                <div className="p-2.5">
                  <p className="text-xs font-semibold text-neutral-900 truncate">
                    {sample.title}
                  </p>
                  <p className="text-[11px] text-neutral-500 truncate mt-0.5">
                    {sample.caption}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
