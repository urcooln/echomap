import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const KNOWLEDGE_SOURCE_ADAPTER_VERSION = "uploaded-document-v1";
export const MAX_KNOWLEDGE_SOURCE_BYTES = 12 * 1024 * 1024;
export const MAX_EXTRACTED_SOURCE_CHARS = 700_000;

export type KnowledgeSourceKind = "pdf" | "docx" | "text" | "markdown" | "html";
export type ExtractedKnowledgeChunk = {
  ordinal: number;
  page: number | null;
  section: string | null;
  text: string;
};

export class KnowledgeSourceProcessingError extends Error {
  constructor(
    public readonly code:
      | "UNSUPPORTED_SOURCE"
      | "INVALID_SOURCE_DATA"
      | "SOURCE_TOO_LARGE"
      | "SOURCE_UNREADABLE"
      | "SOURCE_EMPTY",
    message: string,
  ) {
    super(message);
    this.name = "KnowledgeSourceProcessingError";
  }
}

const knownContentTypes: Record<string, KnowledgeSourceKind> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "text",
  "text/markdown": "markdown",
  "text/html": "html",
};

export const knowledgeSourceKindFor = (contentType: string) =>
  knownContentTypes[contentType.toLowerCase().split(";")[0]?.trim() ?? ""] ?? null;

export const decodeKnowledgeSourceUpload = (
  encodedSource: string,
  contentType: string,
) => {
  const dataUrl = encodedSource.match(/^data:([^,]+);base64,([\s\S]*)$/i);
  const normalizedContentType =
    contentType.toLowerCase().split(";")[0]?.trim() ?? "";
  if (
    dataUrl &&
    dataUrl[1]?.toLowerCase().split(";")[0]?.trim() !== normalizedContentType
  ) {
    throw new KnowledgeSourceProcessingError(
      "INVALID_SOURCE_DATA",
      "The selected document format does not match the uploaded file.",
    );
  }
  const base64 = (dataUrl?.[2] ?? encodedSource).replace(/\s/g, "");
  if (!base64 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64) || base64.length % 4 !== 0) {
    throw new KnowledgeSourceProcessingError(
      "INVALID_SOURCE_DATA",
      "The selected document could not be read. Please choose the original source file and try again.",
    );
  }
  const source = Buffer.from(base64, "base64");
  if (!source.length) {
    throw new KnowledgeSourceProcessingError(
      "SOURCE_EMPTY",
      "The selected document is empty.",
    );
  }
  if (source.length > MAX_KNOWLEDGE_SOURCE_BYTES) {
    throw new KnowledgeSourceProcessingError(
      "SOURCE_TOO_LARGE",
      "Knowledge sources must be 12 MB or smaller.",
    );
  }
  return source;
};

const decodeXml = (value: string) =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const plainTextFromHtml = (value: string) =>
  decodeXml(
    value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  );

const normalizeExtractedText = (value: string) =>
  value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const temporaryPath = (extension: string) =>
  join(tmpdir(), `childled-knowledge-${randomUUID()}.${extension}`);

const extractPdf = async (source: Buffer) => {
  const inputPath = temporaryPath("pdf");
  await writeFile(inputPath, source);
  try {
    const { stdout } = await execFileAsync(
      "pdftotext",
      ["-enc", "UTF-8", "-layout", inputPath, "-"],
      { maxBuffer: MAX_EXTRACTED_SOURCE_CHARS * 4 },
    );
    return stdout;
  } catch {
    throw new KnowledgeSourceProcessingError(
      "SOURCE_UNREADABLE",
      "ChildLed could not extract readable text from this PDF. Try exporting a text-searchable PDF or upload the source document.",
    );
  } finally {
    await unlink(inputPath).catch(() => {});
  }
};

const extractDocx = async (source: Buffer) => {
  const inputPath = temporaryPath("docx");
  await writeFile(inputPath, source);
  try {
    const { stdout } = await execFileAsync(
      "unzip",
      ["-p", inputPath, "word/document.xml"],
      { maxBuffer: MAX_EXTRACTED_SOURCE_CHARS * 4 },
    );
    const paragraphs = stdout
      .split(/<\/w:p>/u)
      .map((paragraph) =>
        [...paragraph.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/gu)]
          .map((match) => decodeXml(match[1] ?? ""))
          .join(" "),
      )
      .filter(Boolean);
    return paragraphs.join("\n\n");
  } catch {
    throw new KnowledgeSourceProcessingError(
      "SOURCE_UNREADABLE",
      "ChildLed could not extract readable text from this document. Try saving it as a DOCX or text-searchable PDF.",
    );
  } finally {
    await unlink(inputPath).catch(() => {});
  }
};

export const extractKnowledgeSourceText = async (
  source: Buffer,
  contentType: string,
) => {
  const kind = knowledgeSourceKindFor(contentType);
  if (!kind) {
    throw new KnowledgeSourceProcessingError(
      "UNSUPPORTED_SOURCE",
      "Use a PDF, DOCX, plain-text, Markdown, or HTML source.",
    );
  }
  const extracted =
    kind === "pdf"
      ? await extractPdf(source)
      : kind === "docx"
        ? await extractDocx(source)
        : kind === "html"
          ? plainTextFromHtml(source.toString("utf8"))
          : source.toString("utf8");
  const normalized = normalizeExtractedText(extracted);
  if (!normalized) {
    throw new KnowledgeSourceProcessingError(
      "SOURCE_EMPTY",
      "ChildLed could not find readable text in this source.",
    );
  }
  if (normalized.length > MAX_EXTRACTED_SOURCE_CHARS) {
    throw new KnowledgeSourceProcessingError(
      "SOURCE_TOO_LARGE",
      "This source contains more readable text than ChildLed can safely process at once. Split it into smaller materials and try again.",
    );
  }
  return { kind, text: normalized, checksum: createHash("sha256").update(source).digest("hex") };
};

const headingFor = (value: string) => {
  const firstLine = value.split("\n")[0]?.trim() ?? "";
  return firstLine.length > 4 && firstLine.length < 120 && !/[.!?]$/.test(firstLine)
    ? firstLine
    : null;
};

/**
 * The chunk boundary intentionally favors paragraphs and preserves PDF page
 * labels. This is a deterministic replacement for embeddings while the source
 * corpus is small; the retrieval contract can be swapped later without
 * changing source or insight records.
 */
export const chunkKnowledgeSource = (
  extractedText: string,
  targetSize = 1_100,
): ExtractedKnowledgeChunk[] => {
  const pages = extractedText.split("\f").map((page) => page.trim()).filter(Boolean);
  const chunks: ExtractedKnowledgeChunk[] = [];
  let ordinal = 0;
  pages.forEach((pageText, pageIndex) => {
    const paragraphs = pageText.split(/\n{2,}/u).map((part) => part.trim()).filter(Boolean);
    let current = "";
    let section: string | null = null;
    const flush = () => {
      const text = current.trim();
      if (!text) return;
      chunks.push({
        ordinal: ordinal++,
        page: pages.length > 1 ? pageIndex + 1 : null,
        section,
        text,
      });
      current = "";
    };
    for (const paragraph of paragraphs) {
      const heading = headingFor(paragraph);
      if (heading && paragraph.length < 150) section = heading;
      const next = current ? `${current}\n\n${paragraph}` : paragraph;
      if (next.length > targetSize && current) flush();
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
    flush();
  });
  return chunks;
};

export const safeKnowledgeProcessingFailure = (error: unknown) => {
  if (error instanceof KnowledgeSourceProcessingError) {
    return { code: error.code, message: error.message };
  }
  return {
    code: "SOURCE_UNREADABLE" as const,
    message:
      "ChildLed could not process this source. The original file was kept private; try a text-searchable PDF, DOCX, or plain-text export.",
  };
};