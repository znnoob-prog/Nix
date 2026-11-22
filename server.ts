import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";
import type { GenerateContentResponse } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

type AnalysisMode = "overview" | "ocr" | "design" | "objects";

interface AnalyzeRequestBody {
  imageBase64?: string;
  mimeType?: string;
  mode?: AnalysisMode;
  customFocus?: string;
}

interface ChatHistoryItem {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequestBody {
  imageBase64?: string;
  mimeType?: string;
  question?: string;
  history?: ChatHistoryItem[];
  analysisContext?: string;
}

function getGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    const err = new Error("GEMINI_API_KEY is not configured on the server.");
    (err as Error & { statusCode?: number }).statusCode = 500;
    throw err;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function normalizeMimeType(mimeType: string): string {
  const lowered = mimeType.toLowerCase().trim();
  return lowered === "image/jpg" ? "image/jpeg" : lowered;
}

function stripDataUrlPrefix(input: string): string {
  const commaIdx = input.indexOf(",");
  if (input.startsWith("data:") && commaIdx !== -1) {
    return input.slice(commaIdx + 1);
  }
  return input;
}

function buildModePrompt(mode: AnalysisMode, customFocus?: string): string {
  const focusClause = customFocus?.trim()
    ? `\n\nThe user specifically wants you to focus on: "${customFocus.trim()}". Address this directly and thoroughly in both the summary and detailed analysis.`
    : "";

  switch (mode) {
    case "ocr":
      return (
        "Perform a thorough text and document reading analysis of this image. " +
        "Transcribe all visible text verbatim in `extractedText`, noting where each piece appears (e.g., signage, dial, notebook, label, header). " +
        "If text is handwritten, stylized, or partially obscured, note confidence accurately without guessing missing words. " +
        "In `detailedAnalysis`, explain the context, layout, and meaning of the text within the scene." +
        focusClause
      );
    case "design":
      return (
        "Perform a visual design, composition, and craft analysis of this image. " +
        "Examine framing, perspective, focal hierarchy, light direction and quality (hard vs. diffused, warm vs. cool), surface materials, textures, and color harmony. " +
        "Include accurate dominant hex color codes in `palette` and explain how the visual elements guide the viewer's eye." +
        focusClause
      );
    case "objects":
      return (
        "Perform a systematic object and spatial inventory of this image. " +
        "Identify primary subjects, secondary props, tools, architectural elements, and background details, explaining their spatial relationships (foreground, midground, background, left/right) and physical condition. " +
        "Also transcribe any readable markings or labels." +
        focusClause
      );
    case "overview":
    default:
      return (
        "Provide a clear, complete, and well-structured visual analysis of this image. " +
        "Describe what is happening, who or what is pictured, the setting, lighting, notable details, any visible text or numbers, and color palette. " +
        "Keep every observation grounded strictly in what is visible in the frame." +
        focusClause
      );
  }
}

const NIX_SYSTEM_INSTRUCTION =
  "You are Nix, a precision visual intelligence assistant built for crystal-clear image analysis. " +
  "Your writing is direct, observant, structured, and easy to scan—never vague, bloated, or overly theatrical. " +
  "Describe only what you can actually observe in the image. If an area is too small, cropped, or out of focus to verify, state that plainly rather than guessing. " +
  "Use natural prose, exact spatial directions (foreground, upper left, center), and concrete material or typographic details.";

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const isTransient =
        message.includes("503") ||
        message.includes("500") ||
        message.includes("UNAVAILABLE") ||
        message.includes("ECONNRESET");
      if (!isTransient || attempt === maxAttempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
    }
  }
  throw lastError;
}

function mapApiError(error: unknown): { status: number; message: string } {
  const errObj = error as { status?: number; statusCode?: number; message?: string };
  const rawMessage = errObj?.message || "Unexpected server error while analyzing the image.";

  if (errObj?.statusCode) {
    return { status: errObj.statusCode, message: rawMessage };
  }
  if (rawMessage.includes("API_KEY_INVALID") || rawMessage.includes("PERMISSION_DENIED") || errObj?.status === 403) {
    return {
      status: 403,
      message: "Gemini API key was rejected. Please verify GEMINI_API_KEY in Settings > Secrets.",
    };
  }
  if (rawMessage.includes("RESOURCE_EXHAUSTED") || errObj?.status === 429) {
    return {
      status: 429,
      message: "Rate limit or quota reached for the Gemini API key. Please try again shortly or review your quota.",
    };
  }
  if (rawMessage.includes("NOT_FOUND") || errObj?.status === 404) {
    return {
      status: 404,
      message: "Requested Gemini model could not be found. Check model configuration.",
    };
  }
  if (errObj?.status === 400 || rawMessage.includes("INVALID_ARGUMENT")) {
    return {
      status: 400,
      message: "Invalid image payload or request format. Please upload a standard PNG, JPEG, WEBP, or GIF image.",
    };
  }
  return { status: 500, message: rawMessage };
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: "25mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "nix-vision", model: "gemini-4-hydrogen" });
  });

  app.post("/api/analyze", async (req, res) => {
    try {
      const body = req.body as AnalyzeRequestBody;
      const rawBase64 = body?.imageBase64;
      const rawMime = body?.mimeType;
      const mode: AnalysisMode =
        body?.mode && ["overview", "ocr", "design", "objects"].includes(body.mode)
          ? body.mode
          : "overview";

      if (!rawBase64 || typeof rawBase64 !== "string") {
        res.status(400).json({ error: "Missing image data." });
        return;
      }
      if (!rawMime || typeof rawMime !== "string" || !ALLOWED_MIME_TYPES.has(rawMime.toLowerCase())) {
        res.status(400).json({ error: "Unsupported image format. Use PNG, JPEG, WEBP, or GIF." });
        return;
      }

      const cleanBase64 = stripDataUrlPrefix(rawBase64);
      if (cleanBase64.length > 20 * 1024 * 1024 * 1.37) {
        res.status(400).json({ error: "Image exceeds the 20MB limit." });
        return;
      }

      const ai = getGenAIClient();
      const mimeType = normalizeMimeType(rawMime);
      const prompt = buildModePrompt(mode, body.customFocus);

      const response: GenerateContentResponse = await withRetry(() =>
        ai.models.generateContent({
          model: "gemini-4-hydrogen",
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: cleanBase64,
                },
              },
              { text: prompt },
            ],
          },
          config: {
            systemInstruction: NIX_SYSTEM_INSTRUCTION,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: {
                  type: Type.STRING,
                  description: "A concise 3 to 6 word descriptive title for the image.",
                },
                summary: {
                  type: Type.STRING,
                  description: "A crisp 1 to 2 sentence plain-English summary of what the image shows.",
                },
                detailedAnalysis: {
                  type: Type.STRING,
                  description:
                    "Clear multi-paragraph explanation of the image tailored to the requested mode, using plain paragraphs separated by double newlines.",
                },
                observations: {
                  type: Type.ARRAY,
                  description: "4 to 7 distinct, verifiable visual observations.",
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      label: {
                        type: Type.STRING,
                        description: "Short 2 to 4 word topic label (e.g., Lighting Direction, Main Subject).",
                      },
                      detail: {
                        type: Type.STRING,
                        description: "Specific, concrete observation about that aspect of the image.",
                      },
                    },
                    required: ["label", "detail"],
                  },
                },
                extractedText: {
                  type: Type.ARRAY,
                  description: "All readable text, signage, labels, or handwriting found in the image. Empty array if no readable text is present.",
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      region: {
                        type: Type.STRING,
                        description: "Where in the image the text appears (e.g., Wooden Menu Board, Watch Dial).",
                      },
                      text: {
                        type: Type.STRING,
                        description: "Exact transcribed text.",
                      },
                    },
                    required: ["region", "text"],
                  },
                },
                palette: {
                  type: Type.ARRAY,
                  description: "4 to 5 dominant or defining colors visible in the image.",
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      hex: {
                        type: Type.STRING,
                        description: "Standard 6-digit hex color code starting with #, e.g. #2B3A42.",
                      },
                      name: {
                        type: Type.STRING,
                        description: "Descriptive color name (e.g., Slate Charcoal, Warm Oak).",
                      },
                      role: {
                        type: Type.STRING,
                        description: "Brief note on where this color appears in the image.",
                      },
                    },
                    required: ["hex", "name", "role"],
                  },
                },
                suggestedQuestions: {
                  type: Type.ARRAY,
                  description: "Exactly 3 specific, useful follow-up questions a user might ask Nix about this particular image.",
                  items: { type: Type.STRING },
                },
              },
              required: [
                "title",
                "summary",
                "detailedAnalysis",
                "observations",
                "extractedText",
                "palette",
                "suggestedQuestions",
              ],
            },
          },
        })
      );

      const jsonText = (response.text ?? "").trim();
      if (!jsonText) {
        res.status(502).json({ error: "Nix returned an empty response. Please try again." });
        return;
      }

      const parsed = JSON.parse(jsonText);
      res.json({ analysis: parsed, model: "gemini-4-hydrogen" });
    } catch (error) {
      const mapped = mapApiError(error);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const body = req.body as ChatRequestBody;
      const rawBase64 = body?.imageBase64;
      const rawMime = body?.mimeType;
      const question = body?.question?.trim();

      if (!rawBase64 || typeof rawBase64 !== "string") {
        res.status(400).json({ error: "Missing image data for follow-up question." });
        return;
      }
      if (!rawMime || !ALLOWED_MIME_TYPES.has(rawMime.toLowerCase())) {
        res.status(400).json({ error: "Unsupported image MIME type." });
        return;
      }
      if (!question) {
        res.status(400).json({ error: "Please enter a question for Nix." });
        return;
      }

      const ai = getGenAIClient();
      const mimeType = normalizeMimeType(rawMime);
      const cleanBase64 = stripDataUrlPrefix(rawBase64);

      const historyLines = Array.isArray(body.history)
        ? body.history
            .slice(-8)
            .map((h) => `${h.role === "user" ? "User" : "Nix"}: ${h.content}`)
            .join("\n")
        : "";

      const promptParts = [
        body.analysisContext
          ? `Prior visual summary for context:\n${body.analysisContext}\n`
          : "",
        historyLines ? `Recent conversation:\n${historyLines}\n` : "",
        `Current user question about the image:\n${question}\n\nAnswer clearly, concisely, and directly based on what is visible in the image.`,
      ]
        .filter(Boolean)
        .join("\n");

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await ai.models.generateContentStream({
        model: "gemini-4-hydrogen",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: cleanBase64,
              },
            },
            { text: promptParts },
          ],
        },
        config: {
          systemInstruction: NIX_SYSTEM_INSTRUCTION,
        },
      });

      for await (const chunk of stream) {
        const text = chunk.text;
        if (text) {
          res.write(`data: ${JSON.stringify({ chunk: text })}\n\n`);
        }
      }
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      const mapped = mapApiError(error);
      if (!res.headersSent) {
        res.status(mapped.status).json({ error: mapped.message });
      } else {
        res.write(`data: ${JSON.stringify({ error: mapped.message })}\n\n`);
        res.end();
      }
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, "dist");
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Nix server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start Nix server:", err);
  process.exit(1);
});
