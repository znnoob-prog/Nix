export type AnalysisMode = "overview" | "ocr" | "design" | "objects";

export interface ObservationItem {
  label: string;
  detail: string;
}

export interface ExtractedTextItem {
  region: string;
  text: string;
}

export interface PaletteColor {
  hex: string;
  name: string;
  role: string;
}

export interface NixAnalysis {
  title: string;
  summary: string;
  detailedAnalysis: string;
  observations: ObservationItem[];
  extractedText: ExtractedTextItem[];
  palette: PaletteColor[];
  suggestedQuestions: string[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  error?: boolean;
}

export interface ImageMetadata {
  name: string;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
}

export interface ActiveImage {
  id: string;
  dataUrl: string;
  base64: string;
  metadata: ImageMetadata;
}

export interface HistoryEntry {
  id: string;
  createdAt: number;
  mode: AnalysisMode;
  image: ActiveImage;
  analysis: NixAnalysis;
  chatHistory: ChatMessage[];
}

export interface SampleImage {
  id: string;
  title: string;
  caption: string;
  recommendedMode: AnalysisMode;
  src: string;
}
