import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const CLIP_PADDING_MILLISECONDS = 250;
const MAX_CLIP_MILLISECONDS = 10_000;

export const unclearAudioClipWindow = (
  startTimeMilliseconds: number,
  durationMilliseconds: number,
) => {
  const startMilliseconds = Math.max(
    0,
    Math.round(startTimeMilliseconds) - CLIP_PADDING_MILLISECONDS,
  );
  const leadingPaddingMilliseconds = Math.max(
    0,
    Math.round(startTimeMilliseconds) - startMilliseconds,
  );
  const clipDurationMilliseconds = Math.min(
    MAX_CLIP_MILLISECONDS,
    Math.max(
      1,
      Math.round(durationMilliseconds) +
        leadingPaddingMilliseconds +
        CLIP_PADDING_MILLISECONDS,
    ),
  );
  return { startMilliseconds, clipDurationMilliseconds };
};

export const extractUnclearAudioClip = async (input: {
  audio: Buffer;
  startTimeMilliseconds: number;
  durationMilliseconds: number;
}) => {
  const directory = await mkdtemp(path.join(tmpdir(), "childled-unclear-"));
  const inputPath = path.join(directory, "source-audio");
  const outputPath = path.join(directory, "clip.wav");
  const window = unclearAudioClipWindow(
    input.startTimeMilliseconds,
    input.durationMilliseconds,
  );
  try {
    await writeFile(inputPath, input.audio);
    await execFileAsync(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-ss",
        (window.startMilliseconds / 1_000).toFixed(3),
        "-i",
        inputPath,
        "-t",
        (window.clipDurationMilliseconds / 1_000).toFixed(3),
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-c:a",
        "pcm_s16le",
        "-f",
        "wav",
        "-y",
        outputPath,
      ],
      { timeout: 30_000, maxBuffer: 1024 * 1024 },
    );
    return {
      data: await readFile(outputPath),
      contentType: "audio/wav",
      durationMilliseconds: window.clipDurationMilliseconds,
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};
