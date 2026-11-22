import type { ActiveImage, AnalysisMode, NixAnalysis } from "../types/nix";

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatAspectRatio(width: number, height: number): string {
  if (!width || !height) return "—";
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(width, height);
  const w = Math.round(width / divisor);
  const h = Math.round(height / divisor);
  if (w > 24 || h > 24) {
    return `${(width / height).toFixed(2)}:1`;
  }
  return `${w}:${h}`;
}

export function formatShortTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function measureImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Could not decode image dimensions."));
    img.src = dataUrl;
  });
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to read image file."));
      }
    };
    reader.onerror = () => reject(new Error("Error reading image file."));
    reader.readAsDataURL(blob);
  });
}

export async function fileToActiveImage(file: File): Promise<ActiveImage> {
  const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
  const mime = file.type.toLowerCase();
  if (!allowed.includes(mime)) {
    throw new Error("Unsupported file type. Please choose a PNG, JPEG, WEBP, or GIF image.");
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error("Image exceeds the 20 MB maximum size.");
  }

  const dataUrl = await readBlobAsDataUrl(file);
  const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  const dims = await measureImageDimensions(dataUrl);

  return {
    id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    dataUrl,
    base64,
    metadata: {
      name: file.name,
      mimeType: mime === "image/jpg" ? "image/jpeg" : mime,
      sizeBytes: file.size,
      width: dims.width,
      height: dims.height,
    },
  };
}

export async function urlToActiveImage(src: string, name: string): Promise<ActiveImage> {
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error(`Unable to load sample image (${response.status}).`);
  }
  const blob = await response.blob();
  const dataUrl = await readBlobAsDataUrl(blob);
  const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  const dims = await measureImageDimensions(dataUrl);
  const mime = blob.type && blob.type.startsWith("image/") ? blob.type : "image/jpeg";

  return {
    id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    dataUrl,
    base64,
    metadata: {
      name,
      mimeType: mime === "image/jpg" ? "image/jpeg" : mime,
      sizeBytes: blob.size,
      width: dims.width,
      height: dims.height,
    },
  };
}

export function buildMarkdownReport(
  analysis: NixAnalysis,
  fileName: string,
  mode: AnalysisMode
): string {
  const lines: string[] = [
    `# ${analysis.title}`,
    `Source: ${fileName} | Mode: ${mode}`,
    "",
    "## Summary",
    analysis.summary,
    "",
    "## Detailed Analysis",
    analysis.detailedAnalysis,
    "",
    "## Key Observations",
    ...analysis.observations.map((o) => `- **${o.label}**: ${o.detail}`),
  ];

  if (analysis.extractedText.length > 0) {
    lines.push(
      "",
      "## Extracted Text",
      ...analysis.extractedText.map((t) => `- **${t.region}**: ${t.text}`)
    );
  }

  if (analysis.palette.length > 0) {
    lines.push(
      "",
      "## Color Palette",
      ...analysis.palette.map((c) => `- \`${c.hex}\` ${c.name} (${c.role})`)
    );
  }

  return lines.join("\n");
}
