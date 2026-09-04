import {
  ensureCompatibleFormat,
  speechToTextWithSpeakers,
} from "@workspace/integrations-openai-ai-server/audio";
import {
  intelligibilityFrom,
  type SpeakerSegment,
  type SpeakerConfidence,
  type SpeechIntelligibility,
} from "./session-transcription";

/**
 * Provider boundary for voice diarization.
 *
 * The active provider returns temporary labels only. EchoMap never treats
 * those labels as a person's identity or as a clinical role.
 */
export type SpeakerDiarizationProvider = {
  id: string;
  /**
   * Implementations may use diarization, acoustic similarity, timestamps, and
   * conversational turn-taking to build temporary Speaker A/B/C clusters.
   * They must return confidence as review guidance only and must never infer a
   * person's identity or clinical role.
   */
  diarize: (audioBuffer: Buffer) => Promise<SpeakerSegment[]>;
};

export type SpeakerDiarizationAvailability = {
  status: "disabled" | "available";
  provider: string | null;
};

const confidenceValues = new Set<SpeakerConfidence>(["high", "medium", "low"]);

export const parseProviderTurns = (raw: string): SpeakerSegment[] => {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "");
  try {
    const parsed = JSON.parse(cleaned) as {
      turns?: Array<{
        speaker?: unknown;
        text?: unknown;
        confidence?: unknown;
        confidenceScore?: unknown;
        intelligibility?: unknown;
        transcriptionConfidenceScore?: unknown;
        startTimeMilliseconds?: unknown;
        durationMilliseconds?: unknown;
      }>;
    };
    if (!Array.isArray(parsed.turns) || parsed.turns.length === 0) return [];
    const labels = new Map<string, string>();
    return parsed.turns.flatMap((turn, position) => {
      if (
        typeof turn.speaker !== "string"
        || typeof turn.text !== "string"
        || typeof turn.confidence !== "string"
        || !confidenceValues.has(turn.confidence as SpeakerConfidence)
        || typeof turn.confidenceScore !== "number"
        || !Number.isInteger(turn.confidenceScore)
        || turn.confidenceScore < 0
        || turn.confidenceScore > 100
      ) return [];
      const sourceLabel = turn.speaker.trim().toLocaleLowerCase();
      const text = turn.text.trim();
      const intelligibility = intelligibilityFrom(turn.intelligibility, text);
      if (!sourceLabel || (!text && intelligibility !== "unintelligible")) return [];
      const transcriptionConfidenceScore =
        typeof turn.transcriptionConfidenceScore === "number"
        && Number.isInteger(turn.transcriptionConfidenceScore)
        && turn.transcriptionConfidenceScore >= 0
        && turn.transcriptionConfidenceScore <= 100
          ? turn.transcriptionConfidenceScore
          : undefined;
      const startTimeMilliseconds =
        typeof turn.startTimeMilliseconds === "number"
        && Number.isInteger(turn.startTimeMilliseconds)
        && turn.startTimeMilliseconds >= 0
          ? turn.startTimeMilliseconds
          : undefined;
      const durationMilliseconds =
        typeof turn.durationMilliseconds === "number"
        && Number.isInteger(turn.durationMilliseconds)
        && turn.durationMilliseconds >= 0
          ? turn.durationMilliseconds
          : undefined;
      const speakerLabel = labels.get(sourceLabel) ?? `Speaker ${String.fromCharCode(65 + labels.size)}`;
      labels.set(sourceLabel, speakerLabel);
      return [{
        speakerLabel,
        text,
        position,
        confidence: turn.confidence as SpeakerConfidence,
        confidenceScore: turn.confidenceScore,
        intelligibility: intelligibility as SpeechIntelligibility,
        ...(transcriptionConfidenceScore === undefined ? {} : { transcriptionConfidenceScore }),
        ...(startTimeMilliseconds === undefined ? {} : { startTimeMilliseconds }),
        ...(durationMilliseconds === undefined ? {} : { durationMilliseconds }),
      }];
    });
  } catch {
    return [];
  }
};

const openAiSpeakerDiarizationProvider: SpeakerDiarizationProvider = {
  id: "Replit OpenAI audio diarization",
  diarize: async (audioBuffer) => {
    const compatible = await ensureCompatibleFormat(audioBuffer);
    const labeledTranscript = await speechToTextWithSpeakers(
      compatible.buffer,
      compatible.format,
      [
        "Analyze this therapy-session recording for temporary speaker turns.",
        'Return JSON only in this exact shape: {"turns":[{"speaker":"Speaker A","text":"words spoken or empty when unintelligible","confidence":"high","confidenceScore":96,"intelligibility":"intelligible","transcriptionConfidenceScore":98,"startTimeMilliseconds":1200,"durationMilliseconds":900}]}.',
        "Use stable placeholder labels Speaker A, Speaker B, and so on.",
        "Never identify a person, infer a clinical role, or include names.",
        "Set confidenceScore from 0 through 100 for the temporary cluster assignment. Use high only for scores 90 or above when the turn boundary is clear; otherwise use medium or low.",
        "Include every audible vocal turn, including unintelligible vocalizations.",
        "Use intelligibility values intelligible, partially_intelligible, or unintelligible. For partial speech, put only clearly supported suggested words in text and lower transcriptionConfidenceScore. For unintelligible speech, use empty text and do not guess words.",
        "Provide start and duration milliseconds for each turn when available.",
      ].join(" "),
    );
    return parseProviderTurns(labeledTranscript);
  },
};

const resolveActiveProvider = (): SpeakerDiarizationProvider =>
  openAiSpeakerDiarizationProvider;

export const speakerDiarizationAvailability: SpeakerDiarizationAvailability = {
  status: resolveActiveProvider() ? "available" : "disabled",
  provider: resolveActiveProvider()?.id ?? null,
};

export const getSpeakerDiarizationProvider = (): SpeakerDiarizationProvider | null =>
  resolveActiveProvider();